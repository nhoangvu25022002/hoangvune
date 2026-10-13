import type { Config, Context } from "@netlify/functions";
import { createHash, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "../../db/index.js";
import { attempts } from "../../db/schema.js";

const PART_LABEL: Record<string, string> = { hiragana: "Hiragana", katakana: "Katakana" };

function rate(p: number) {
  if (p >= 90) return "Xuất sắc";
  if (p >= 75) return "Tốt";
  if (p >= 60) return "Đạt";
  return "Cần ôn thêm";
}

function checkPassword(req: Request): Response | null {
  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (!expected) return Response.json({ error: "not_configured" }, { status: 503 });
  const given = req.headers.get("x-admin-password") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

async function exportXlsx() {
  const rows = await db.select().from(attempts).orderBy(desc(attempts.createdAt));
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Bài làm", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Mã", key: "id", width: 8 },
    { header: "Thời gian", key: "time", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Họ và tên", key: "name", width: 28 },
    { header: "Số điện thoại", key: "phone", width: 16 },
    { header: "Phần thi", key: "part", width: 12 },
    { header: "Số câu đúng", key: "score", width: 12 },
    { header: "Tổng số câu", key: "total", width: 12 },
    { header: "Tỉ lệ đúng (%)", key: "pct", width: 14 },
    { header: "Xếp loại", key: "rate", width: 14 },
    { header: "Chữ làm sai", key: "wrong", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: "A1", to: "J1" };
  for (const r of rows) {
    // Excel không lưu múi giờ: đổi sang giờ Việt Nam (UTC+7) trước khi ghi.
    const local = new Date(r.createdAt.getTime() + 7 * 3600 * 1000);
    ws.addRow({
      id: r.id, time: local, name: r.name, phone: r.phone,
      part: PART_LABEL[r.part] ?? r.part, score: r.score, total: r.total, pct: r.pct,
      rate: rate(r.pct), wrong: r.wrong,
    });
  }
  // Giữ số điện thoại ở dạng chữ để Excel không bỏ số 0 đầu.
  ws.getColumn("phone").numFmt = "@";
  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ket-qua-kana-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export default async (req: Request, context: Context) => {
  const denied = checkPassword(req);
  if (denied) return denied;
  const action = context.params.action;

  if (action === "export" && req.method === "GET") return exportXlsx();

  if (action === "results" && req.method === "GET") {
    const rows = await db.select().from(attempts).orderBy(desc(attempts.createdAt));
    return Response.json(
      rows.map((r) => ({ ...r, ts: r.createdAt.getTime() })),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "results" && req.method === "DELETE") {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "invalid_argument" }, { status: 400 });
    await db.delete(attempts).where(eq(attempts.id, id));
    return new Response(null, { status: 204 });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: "/api/admin/:action",
};
