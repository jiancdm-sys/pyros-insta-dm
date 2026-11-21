// Lógica da automação: comentário -> DM -> (verifica follow) -> link.
import { carregarCampanhas } from './config.js';
import * as ig from './ig.js';
import { liberar, primeiraVez, salvarLead } from './store.js';
import { enviarLeadCRM, comConviteWhatsapp } from './crm.js';

const PREFIXO = 'LINK:';

export const normalizar = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const temPalavra = (texto, palavra) => {
  const p = normalizar(palavra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(normalizar(texto));
};

export function acharCampanha(lista, texto, mediaId) {
  return lista.find(
    (c) =>
      c.ativa &&
      (!c.posts?.length || c.posts.includes(mediaId)) &&
      c.palavras.some((p) => temPalavra(texto, p)),
  );
}

const preencher = (t, vars) => t.replace(/\{nome\}/g, vars.nome ? `@${vars.nome}` : '');
const sortear = (arr) => arr[Math.floor(Math.random() * arr.length)];
const agora = () => new Date().toISOString();

// ---------- 1) Comentário ----------
export async function tratarComentario(contaId, v) {
  const commentId = v.id;
  const autorId = v.from?.id;
  const username = v.from?.username;
  const texto = v.text || '';

  if (!commentId || !autorId) return 'ignorado: sem dados';
  if (autorId === contaId) return 'ignorado: comentário da própria conta';

  const camp = acharCampanha(await carregarCampanhas(), texto, v.media?.id);
  if (!camp) return 'ignorado: sem palavra-chave';

  if (!(await primeiraVez(`comment:${commentId}`))) return 'ignorado: já processado';
  // evita mandar a mesma campanha 2x para a mesma pessoa (ex.: comentou 3 vezes)
  if (!(await primeiraVez(`camp:${camp.id}:${autorId}`, 7))) {
    return 'ignorado: pessoa já recebeu esta campanha';
  }

  const vars = { nome: username };
  const d = camp.dm;
  let resultado = 'ok';
  let status = 'dm_enviada';
  let erro = '';

  try {
    if (camp.linkDireto) {
      await ig.respostaPrivadaLink(
        commentId,
        comConviteWhatsapp(preencher(d.abertura, vars), username, camp.palavras[0]),
        d.link,
        d.tituloLink,
      );
      status = 'link_entregue';
    } else if (camp.exigirSeguir || d.botao) {
      try {
        await ig.respostaPrivada(commentId, preencher(d.abertura, vars), {
          titulo: d.botao || 'Quero o link',
          payload: PREFIXO + camp.id,
        });
      } catch (e) {
        // Sem exigir follow, o link pode ir direto no texto se o botão for recusado.
        if (camp.exigirSeguir) throw e;
        console.warn('resposta privada com botão falhou, tentando só texto:', e.message);
        await ig.respostaPrivada(commentId, `${preencher(d.abertura, vars)}\n\n${d.link}`);
        status = 'link_entregue';
      }
    } else {
      await ig.respostaPrivada(
        commentId,
        comConviteWhatsapp(`${preencher(d.entrega, vars)}\n\n${d.link}`, username, camp.palavras[0]),
      );
    }
  } catch (e) {
    console.error('falha na resposta privada', e.message, e.detalhe);
    resultado = 'erro DM: ' + e.message;
    status = 'erro_dm';
    erro = e.message;
    // A pessoa não recebeu nada: um novo comentário dela pode tentar de novo.
    await liberar(`camp:${camp.id}:${autorId}`);
  }

  // Só diz "te mandei no direct" se o direct saiu de fato.
  if (resultado === 'ok' && camp.respostasPublicas?.length) {
    try {
      await ig.responderComentario(commentId, preencher(sortear(camp.respostasPublicas), vars));
    } catch (e) {
      console.error('falha na resposta pública', e.message);
    }
  }

  await salvarLead(autorId, {
    username,
    campanha: camp.id,
    comentario: texto,
    comment_id: commentId,
    media_id: v.media?.id,
    comentou_em: agora(),
    status,
    erro,
    link_em: status === 'link_entregue' ? agora() : undefined,
  });

  await enviarLeadCRM({
    instagram: username,
    name: username,
    campaign: camp.nome || camp.id,
    external_id: commentId,
    comentario: texto,
    media_id: v.media?.id,
    status_dm: status,
  });

  return resultado;
}

// ---------- 2) Toque no botão / mensagem na DM ----------
export async function tratarMensagem(contaId, ev) {
  const igsid = ev.sender?.id;
  if (!igsid || igsid === contaId) return 'ignorado';
  if (ev.message?.is_echo) return 'ignorado: eco';

  const payload = ev.message?.quick_reply?.payload || ev.postback?.payload;
  if (!payload?.startsWith(PREFIXO)) return 'ignorado: sem payload';

  const mid = ev.message?.mid || ev.postback?.mid;
  if (mid && !(await primeiraVez(`mid:${mid}`, 2))) return 'ignorado: já processado';

  const camp = (await carregarCampanhas()).find((c) => c.id === payload.slice(PREFIXO.length));
  if (!camp) return 'ignorado: campanha não existe';
  const d = camp.dm;

  let p = {};
  try {
    p = await ig.perfil(igsid);
  } catch (e) {
    console.warn('não consegui ler o perfil', e.message);
  }
  const vars = { nome: p.username };

  if (camp.exigirSeguir && p.is_user_follow_business !== true) {
    await ig.enviarTexto(igsid, preencher(d.naoSegue, vars), {
      titulo: 'Já segui ✅',
      payload: PREFIXO + camp.id,
    });
    await salvarLead(igsid, { username: p.username, status: 'aguardando_follow', atualizado_em: agora() });
    return 'pediu follow';
  }

  await ig.enviarLink(
    igsid,
    comConviteWhatsapp(preencher(d.entrega, vars), p.username, camp.palavras[0]),
    d.link,
    d.tituloLink,
  );
  await salvarLead(igsid, {
    username: p.username,
    campanha: camp.id,
    segue: p.is_user_follow_business,
    status: 'link_entregue',
    link_em: agora(),
  });
  return 'link entregue';
}
