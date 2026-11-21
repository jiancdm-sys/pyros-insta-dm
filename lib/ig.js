// Chamadas à API do Instagram com login unificado (Unified Login):
// host graph.facebook.com + token de usuário do sistema (não expira).
import { getIgId, getToken } from './store.js';

const VERSAO = process.env.IG_API_VERSION || 'v27.0';

// Tokens do tipo Instagram (começam com "IG") só funcionam em graph.instagram.com;
// os de usuário do sistema funcionam em graph.facebook.com.
const base = (token) =>
  `https://graph.${token.startsWith('IG') ? 'instagram' : 'facebook'}.com/${VERSAO}`;

async function chamar(metodo, caminho, corpo, params = {}, tokenFixo) {
  const token = tokenFixo || (await getToken());
  if (!token) throw new Error('Token do Instagram não configurado');
  const url = new URL(base(token) + caminho);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = new Error(`IG ${metodo} ${caminho}: ${j.error?.message || r.status}`);
    e.detalhe = j.error;
    throw e;
  }
  return j;
}

export const tokenInstagram = (token) => String(token || '').startsWith('IG');

async function mensagens(corpo) {
  if (tokenInstagram(await getToken())) return chamar('POST', '/me/messages', corpo);
  const id = await getIgId();
  if (!id) throw new Error('ID da conta do Instagram não configurado');
  return chamar('POST', `/${id}/messages`, corpo);
}

const quickReplies = (titulo, payload) => [
  { content_type: 'text', title: titulo.slice(0, 20), payload },
];

/** Resposta privada a um comentário (1 por comentário, até 7 dias). */
export function respostaPrivada(commentId, texto, botao) {
  const message = { text: texto };
  if (botao) message.quick_replies = quickReplies(botao.titulo, botao.payload);
  return mensagens({ recipient: { comment_id: commentId }, message });
}

/** Resposta privada já com botão de link. Se o template falhar, manda texto com o link. */
export async function respostaPrivadaLink(commentId, texto, url, titulo) {
  try {
    return await mensagens({
      recipient: { comment_id: commentId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: texto.slice(0, 640),
            buttons: [{ type: 'web_url', url, title: (titulo || 'Acessar').slice(0, 20) }],
          },
        },
      },
    });
  } catch (e) {
    console.warn('botão de link na resposta privada falhou, enviando texto:', e.message);
    return respostaPrivada(commentId, `${texto}\n\n${url}`);
  }
}

/** Mensagem comum (dentro da janela de 24h após a pessoa interagir na DM). */
export function enviarTexto(igsid, texto, botao) {
  const message = { text: texto };
  if (botao) message.quick_replies = quickReplies(botao.titulo, botao.payload);
  return mensagens({ recipient: { id: igsid }, message });
}

/** Mensagem com botão de link. Se o template falhar, manda texto com o link. */
export async function enviarLink(igsid, texto, url, titulo) {
  try {
    return await mensagens({
      recipient: { id: igsid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: texto.slice(0, 640),
            buttons: [{ type: 'web_url', url, title: (titulo || 'Acessar').slice(0, 20) }],
          },
        },
      },
    });
  } catch (e) {
    console.warn('button template falhou, enviando texto:', e.message);
    return enviarTexto(igsid, `${texto}\n\n${url}`);
  }
}

/** Resposta pública no comentário. */
export function responderComentario(commentId, texto) {
  return chamar('POST', `/${commentId}/replies`, null, { message: texto });
}

/** Perfil de quem conversou com a conta (inclui se segue a conta). */
export function perfil(igsid) {
  return chamar('GET', `/${igsid}`, null, { fields: 'username,name,is_user_follow_business' });
}

/** Dados da conta (também testa se o token funciona). */
export async function minhaConta(token, igId) {
  const t = token || (await getToken());
  if (tokenInstagram(t)) return chamar('GET', '/me', null, { fields: 'user_id,username' }, t);
  const id = igId || (await getIgId());
  if (!id) throw new Error('ID da conta do Instagram não configurado');
  return chamar('GET', `/${id}`, null, { fields: 'id,username' }, t);
}

/** O que o token enxerga, segundo a Meta. Nunca devolve o token. */
export async function diagnostico(token, igId) {
  const tenta = async (caminho, params) => {
    try {
      return await chamar('GET', caminho, null, params, token);
    } catch (e) {
      return { erro: e.message };
    }
  };
  const d = await tenta('/debug_token', { input_token: token });
  const info = d.data || d;
  return {
    prefixo: token.slice(0, 3),
    app_id: info.app_id,
    tipo: info.type,
    valido: info.is_valid,
    expira: info.expires_at,
    permissoes: info.scopes,
    contas_liberadas: info.granular_scopes,
    erro_debug: info.erro,
    me: await tenta('/me', { fields: 'id,name' }),
    paginas: await tenta('/me/accounts', { fields: 'id,name,instagram_business_account{id,username}' }),
    instagram_do_token: await tenta('/me/instagram_accounts', { fields: 'id,username' }),
    paginas_atribuidas: await tenta('/me/assigned_pages', { fields: 'id,name' }),
    so_id: await tenta(`/${igId}`, { fields: 'id' }),
    midias: await tenta(`/${igId}/media`, { fields: 'id', limit: '1' }),
    conversas: await tenta(`/${igId}/conversations`, { platform: 'instagram', limit: '1', fields: 'id' }),
  };
}

/** Ativa o envio de webhooks desta conta para o app. */
export async function assinarWebhooks(token, igId) {
  const t = token || (await getToken());
  const id = tokenInstagram(t) ? 'me' : igId || (await getIgId());
  return chamar('POST', `/${id}/subscribed_apps`, null, { subscribed_fields: 'comments,messages,messaging_postbacks' }, t);
}
