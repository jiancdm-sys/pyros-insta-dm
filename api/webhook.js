// Webhook do Instagram: verificação (GET) + eventos (POST).
import crypto from 'node:crypto';
import { tratarComentario, tratarMensagem } from '../lib/fluxo.js';
import { getAppSecret } from '../lib/store.js';

export async function GET(request) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

function assinaturaValida(raw, header, secret) {
  if (!secret) return true; // sem secret configurado, não valida (só para teste)
  if (!header?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(header.slice(7), 'hex');
  const b = Buffer.from(esperado, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  const raw = await request.text();
  if (!assinaturaValida(raw, request.headers.get('x-hub-signature-256'), await getAppSecret())) {
    console.warn('assinatura inválida');
    return new Response('invalid signature', { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const log = [];
  for (const entry of body.entry || []) {
    const contaId = entry.id;

    for (const ch of entry.changes || []) {
      if (ch.field !== 'comments' && ch.field !== 'live_comments') continue;
      try {
        log.push(await tratarComentario(contaId, ch.value || {}));
      } catch (e) {
        console.error('erro comentário', e);
        log.push('erro: ' + e.message);
      }
    }

    for (const ev of entry.messaging || []) {
      try {
        log.push(await tratarMensagem(contaId, ev));
      } catch (e) {
        console.error('erro mensagem', e);
        log.push('erro: ' + e.message);
      }
    }
  }

  console.log('webhook', JSON.stringify(log));
  // sempre 200 para a Meta não ficar reenviando
  return new Response('EVENT_RECEIVED', { status: 200 });
}
