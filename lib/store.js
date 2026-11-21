// Armazenamento em Redis (Upstash) via REST, sem dependências.
// Aceita as variáveis criadas pela integração Upstash da Vercel (KV_* ou UPSTASH_*).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = Boolean(URL_ && TOKEN);
// DEV_MEMORY=1 libera salvar em memória (só para testes locais)
export const storeAtivo = redis || process.env.DEV_MEMORY === '1';

// memória local (fallback para testes sem Redis — NÃO persiste em produção)
const mem = new Map();

// O banco Upstash é compartilhado com aqua-calendario e aqua-insta-dm (plano free = 1 banco).
// TODAS as chaves daqui ganham o prefixo "pdm:" (Pyros DM), separado do "dm:" da Aqua.
const PREFIXO = process.env.REDIS_PREFIX || 'pdm:';

async function cmd(op, chave, ...resto) {
  const args = [op, PREFIXO + chave, ...resto];
  if (!redis) return memCmd(args);
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(`Redis: ${j.error}`);
  return j.result;
}

function memCmd([op, key, ...rest]) {
  op = op.toUpperCase();
  if (op === 'SET') {
    const nx = rest.includes('NX');
    if (nx && mem.has(key)) return null;
    mem.set(key, rest[0]);
    return 'OK';
  }
  if (op === 'GET') return mem.get(key) ?? null;
  if (op === 'HSET') {
    const h = mem.get(key) || {};
    for (let i = 0; i < rest.length; i += 2) h[rest[i]] = rest[i + 1];
    mem.set(key, h);
    return 1;
  }
  if (op === 'HGETALL') {
    const h = mem.get(key) || {};
    return Object.entries(h).flat();
  }
  if (op === 'SADD') {
    const s = mem.get(key) || new Set();
    s.add(rest[0]);
    mem.set(key, s);
    return 1;
  }
  if (op === 'SMEMBERS') return [...(mem.get(key) || [])];
  if (op === 'DEL') return mem.delete(key) ? 1 : 0;
  throw new Error('op não suportada no fallback: ' + op);
}

const DIAS = 86400;

/** Marca um evento como processado. Retorna true se é a 1ª vez. */
export async function primeiraVez(chave, ttlDias = 30) {
  const r = await cmd('SET', `dedupe:${chave}`, '1', 'NX', 'EX', String(ttlDias * DIAS));
  return r === 'OK';
}

/** Desfaz uma marca de primeiraVez, permitindo processar de novo. */
export async function liberar(chave) {
  await cmd('DEL', `dedupe:${chave}`);
}

export async function salvarLead(igsid, campos) {
  const flat = [];
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null) flat.push(k, String(v));
  if (!flat.length) return;
  await cmd('HSET', `lead:${igsid}`, ...flat);
  await cmd('SADD', 'leads', igsid);
}

export async function lerLead(igsid) {
  const arr = (await cmd('HGETALL', `lead:${igsid}`)) || [];
  const o = {};
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

export async function listarLeads() {
  const ids = (await cmd('SMEMBERS', 'leads')) || [];
  const out = [];
  for (const id of ids) out.push({ igsid: id, ...(await lerLead(id)) });
  return out;
}

export async function getJSON(chave) {
  const v = await cmd('GET', chave);
  return v ? JSON.parse(v) : null;
}

export async function setJSON(chave, valor) {
  await cmd('SET', chave, JSON.stringify(valor));
}

export async function getToken() {
  return (await cmd('GET', 'ig:token')) || process.env.IG_ACCESS_TOKEN;
}

export async function setToken(t) {
  await cmd('SET', 'ig:token', t);
}

export async function getIgId() {
  return (await cmd('GET', 'ig:id')) || process.env.IG_ACCOUNT_ID;
}

export async function setIgId(id) {
  await cmd('SET', 'ig:id', id);
}

export async function getAppSecret() {
  return (await cmd('GET', 'ig:appsecret')) || process.env.IG_APP_SECRET;
}

export async function setAppSecret(s) {
  await cmd('SET', 'ig:appsecret', s);
}
