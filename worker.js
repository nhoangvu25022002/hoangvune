export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API cho người dùng nộp bài làm
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
        return new Response(JSON.stringify({ success: true }), { 
          headers: { 'content-type': 'application/json' } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400 });
      }
    }

    // 2. API cho Admin lấy danh sách bài làm (/api/admin/results)
    if (url.pathname === '/api/admin/results') {
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
        return new Response(JSON.stringify(results), { 
          headers: { 'content-type': 'application/json' } 
        });
      }

      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (id) await env.KANA_DB.delete(`result:${id}`);
        return new Response(JSON.stringify({ success: true }), { 
          headers: { 'content-type': 'application/json' } 
        });
      }
    }

    // 3. API Xuất file Excel cho Admin (/api/admin/export)
    if (url.pathname === '/api/admin/export') {
      const adminPw = request.headers.get('x-admin-password');
      if (adminPw !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 });
      }

      const list = await env.KANA_DB.list({ prefix: 'result:' });
      const results = [];
      for (const key of list.keys) {
        const val = await env.KANA_DB.get(key.name, { type: 'json' });
        if (val) results.push(val);
      }
      results.sort((a, b) => b.ts - a.ts);

      let csv = '\uFEFFThoi gian,Ho va ten,So dien thoại,Phan thi,Diem,Phan tram,Cac chu sai\n';
      results.forEach(r => {
        const timeStr = new Date(r.ts).toLocaleString('vi-VN');
        csv += `"${timeStr}","${r.name || ''}","${r.phone || ''}","${r.part || ''}","${r.score}/${r.total}","${r.pct}%","${(r.wrong || '').replace(/"/g, '""')}"\n`;
      });

      return new Response(csv, {
        headers: {
          'content-type': 'text/csv;charset=utf-8',
          'content-disposition': 'attachment; filename="ket-qua-kana.csv"'
        }
      });
    }

    // 4. Phục vụ trang Admin HTML
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url), request));
    }

    // 5. Mặc định phục vụ các file tĩnh khác
    return env.ASSETS.fetch(request);
  }
};