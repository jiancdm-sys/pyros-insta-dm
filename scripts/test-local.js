// Teste local sem Instagram: simula webhooks e intercepta as chamadas à API.
process.env.IG_ACCESS_TOKEN = 'fake';
process.env.IG_ACCOUNT_ID = '111';
const chamadas = [];
let segue = false;
let recusarBotao = false;
let recusarDM = false;
let recusarTemplate = false;
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  chamadas.push(`${opt.method || 'GET'} ${u.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+/, '')} ${opt.body || ''}`);
  const privada = (opt.body || '').includes('comment_id');
  if (privada && (recusarDM || (recusarBotao && opt.body.includes('quick_replies')) || (recusarTemplate && opt.body.includes('attachment')))) {
    return new Response(JSON.stringify({ error: { message: 'recusado' } }), { status: 400 });
  }
  const json = u.includes('fields=') ? { username: 'fulana', is_user_follow_business: segue } : { recipient_id: '999', message_id: 'm1' };
  return new Response(JSON.stringify(json), { status: 200 });
};

const { POST, GET } = await import('../api/webhook.js');
const enviar = (body) =>
  POST(new Request('http://x/api/webhook', { method: 'POST', body: JSON.stringify(body) }));

const CONTA = '111';
const comentario = (id, texto, de = '999') => ({
  entry: [{ id: CONTA, changes: [{ field: 'comments', value: { id, text: texto, from: { id: de, username: 'fulana' }, media: { id: 'M1' } } }] }],
});
const toque = (mid) => ({
  entry: [{ id: CONTA, messaging: [{ sender: { id: '999' }, recipient: { id: CONTA }, message: { mid, text: 'Quero o link', quick_reply: { payload: 'LINK:exemplo' } } }] }],
});

const passo = async (nome, fn) => {
  chamadas.length = 0;
  await fn();
  console.log(`\n### ${nome}\n` + (chamadas.join('\n') || '(nenhuma chamada)'));
};

process.env.WEBHOOK_VERIFY_TOKEN = 'abc';
const v = await GET(new Request('http://x/api/webhook?hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42'));
console.log('verificação:', v.status, await v.text());

await passo('comentário sem palavra-chave', () => enviar(comentario('c1', 'que lindo!')));
await passo('comentário "quero!!" -> DM + resposta pública', () => enviar(comentario('c2', 'Quéro!! 😍')));
await passo('mesmo comentário reenviado pela Meta -> nada', () => enviar(comentario('c2', 'Quéro!! 😍')));
await passo('mesma pessoa comenta de novo -> nada', () => enviar(comentario('c3', 'quero')));
await passo('comentário da própria conta -> nada', () => enviar(comentario('c4', 'quero', CONTA)));
await passo('toca no botão sem seguir -> pede follow', () => enviar(toque('m1')));
segue = true;
await passo('toca "Já segui" seguindo -> link', () => enviar(toque('m2')));

recusarBotao = true;
await passo('botão recusado exigindo follow -> erro, sem resposta pública', () => enviar(comentario('c5', 'quero', '555')));
const { carregarCampanhas, salvarCampanhas } = await import('../lib/config.js');
await salvarCampanhas((await carregarCampanhas()).map((c) => ({ ...c, exigirSeguir: false })));
await passo('botão recusado sem exigir follow -> reenvia só texto com link + resposta pública', () => enviar(comentario('c8', 'quero', '777')));
recusarBotao = false;
recusarDM = true;
await passo('DM recusada -> sem resposta pública', () => enviar(comentario('c6', 'quero', '666')));
recusarDM = false;
await passo('mesma pessoa comenta de novo após falha -> tenta de novo', () => enviar(comentario('c7', 'quero', '666')));

await salvarCampanhas((await carregarCampanhas()).map((c) => ({ ...c, linkDireto: true })));
await passo('link direto -> 1 mensagem com botão de link + resposta pública', () => enviar(comentario('c9', 'quero', '888')));
recusarTemplate = true;
await passo('link direto com template recusado -> texto com link', () => enviar(comentario('c10', 'quero', '889')));
recusarTemplate = false;
recusarDM = true;
await passo('link direto com DM recusada -> sem resposta pública', () => enviar(comentario('c11', 'quero', '890')));
recusarDM = false;

const { listarLeads } = await import('../lib/store.js');
console.log('\nstatus:', (await listarLeads()).filter((l) => ['888', '889', '890'].includes(l.igsid)).map((l) => `${l.igsid}=${l.status}`).join(' '));
