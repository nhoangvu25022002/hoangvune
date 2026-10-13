import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { attempts } from "../../db/schema.js";
import { PARTS, hash, maskPhone } from "../lib/attempts.js";

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.select().from(attempts).orderBy(desc(attempts.createdAt)).limit(500);
    // Danh sách công khai cho trang thống kê: không trả số điện thoại đầy đủ.
    return Response.json(
      rows.map((r) => ({
        id: r.id, mid: r.mid, name: r.name, phoneMask: maskPhone(r.phone),
        part: r.part, score: r.score, total: r.total, pct: r.pct,
        wrong: r.wrong, ts: r.createdAt.getTime(),
      })),
    );
  }

  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
    const name = String(body?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    const phone = String(body?.phone ?? "");
    const part = String(body?.part ?? "");
    const total = Number(body?.total);
    const score = Number(body?.score);
    if (
      name.length < 2 || !/^0\d{9}$/.test(phone) || !(PARTS as readonly string[]).includes(part) ||
      !Number.isInteger(total) || total < 1 || total > 100 ||
      !Number.isInteger(score) || score < 0 || score > total
    ) {
      return Response.json({ error: "invalid_argument" }, { status: 400 });
    }
    const [row] = await db.insert(attempts).values({
      mid: "m" + hash(phone), name, phone, part, score, total,
      pct: Math.round((score / total) * 100),
      wrong: String(body?.wrong ?? "").slice(0, 80),
    }).returning({ id: attempts.id, createdAt: attempts.createdAt });
    return Response.json({ id: row.id, ts: row.createdAt.getTime() }, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/results",
};
