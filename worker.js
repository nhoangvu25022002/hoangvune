import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API nhận kết quả bài làm từ người dùng
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      try {
        const data = await request.json();
        const id = Date.now();
        const record = {
          id,
          name: data.name,
          phone: data.phone,
          part: data.part,
          score: data.score,
          total: data.total,
          pct: Math.round((data.score / data.total) * 100),
          wrong: data.wrong || '',
          ts: id
        };
        await env.KANA_DB.put(`result:${id}`, JSON.stringify(record));
        return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400 });
      }
    }

    // 2. API cho trang Admin lấy danh sách / xóa bài làm
    if (url.pathname.startsWith('/api/admin/results')) {
      const adminPw = request.headers.get('x-admin-password');
      if (adminPw !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 });
      }

      if (request.method === 'GET') {
        const list = await env.KANA_DB.list({ prefix: 'result:' });
        const results = [];
        for (const key of list.keys) {
          const val = await env.KANA_DB.get(key.name, { type: 'json' });
          if (val) results.push(val);
        }
        results.sort((a, b) => b.ts - a.ts);
        return new Response(JSON.stringify(results), { headers: { 'content-type': 'application/json' } });
      }

      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (id) await env.KANA_DB.delete(`result:${id}`);
        return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
      }
    }

    // 3. Phục vụ các file tĩnh (index.html, admin.html và các tài nguyên khác trong thư mục public)
    try {
      // Nếu truy cập /admin thì trả về admin.html
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        return await getAssetFromKV(
          { request: new Request(new URL('/admin.html', request.url), request), waitUntil: ctx.waitUntil.bind(ctx) },
          { ASSET_NAMESPACE: env.__STATIC_CONTENT }
        );
      }
      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  },
};