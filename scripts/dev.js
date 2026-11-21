// Servidor local para testar o painel: node scripts/dev.js  ->  http://localhost:3000/admin
// Senha local: teste
import http from 'node:http';
import fs from 'node:fs/promises';

process.env.DEV_MEMORY = '1';
process.env.ADMIN_TOKEN ||= 'teste';

const rotas = {
  '/api/campanhas': await import('../api/campanhas.js'),
  '/api/leads': await import('../api/leads.js'),
  '/api/webhook': await import('../api/webhook.js'),
  '/api/conexao': await import('../api/conexao.js'),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  try {
    if (url.pathname === '/' || url.pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await fs.readFile(new URL('../public/admin.html', import.meta.url)));
    }
    const mod = rotas[url.pathname];
    const fn = mod?.[req.method];
    if (!fn) { res.writeHead(404); return res.end('not found'); }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end(String(e));
  }
}).listen(3000, () => console.log('http://localhost:3000/admin  (senha: teste)'));
