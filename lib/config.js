// Campanhas: lidas do Redis (editadas pelo painel /admin).
// Se o painel ainda não salvou nada, usa o padrão de campanhas.js.
import { CAMPANHAS } from '../campanhas.js';
import { getJSON, setJSON } from './store.js';

export async function carregarCampanhas() {
  return (await getJSON('config:campanhas')) ?? CAMPANHAS;
}

export async function salvarCampanhas(lista) {
  await setJSON('config:campanhas', lista);
}

const txt = (v, max = 1000) => String(v ?? '').trim().slice(0, max);

/** Limpa e valida. Retorna { lista, erros }. */
export function validarCampanhas(entrada) {
  const erros = [];
  if (!Array.isArray(entrada)) return { lista: [], erros: ['Formato inválido'] };
  const ids = new Set();

  const lista = entrada.map((c, i) => {
    const nome = txt(c.nome || c.id, 80) || `Campanha ${i + 1}`;
    const id = txt(c.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || `c${Date.now().toString(36)}${i}`;
    const d = c.dm || {};
    const limpa = {
      id,
      nome,
      ativa: Boolean(c.ativa),
      palavras: [...new Set((c.palavras || []).map((p) => txt(p, 60)).filter(Boolean))],
      posts: (c.posts || []).map((p) => txt(p, 40)).filter(Boolean),
      linkDireto: Boolean(c.linkDireto),
      // Com o link na 1ª mensagem não há como checar o follow antes de entregar.
      exigirSeguir: Boolean(c.exigirSeguir) && !c.linkDireto,
      respostasPublicas: (c.respostasPublicas || []).map((r) => txt(r, 300)).filter(Boolean),
      dm: {
        abertura: txt(d.abertura),
        botao: txt(d.botao, 20) || 'Quero o link',
        naoSegue: txt(d.naoSegue),
        entrega: txt(d.entrega, 640),
        link: txt(d.link, 1000),
        tituloLink: txt(d.tituloLink, 20) || 'Acessar',
      },
    };

    const e = (m) => erros.push(`"${nome}": ${m}`);
    if (ids.has(id)) e('ID duplicado');
    ids.add(id);
    if (!limpa.palavras.length) e('adicione ao menos 1 palavra-chave');
    if (!limpa.dm.abertura) e('escreva a 1ª mensagem do direct');
    if (limpa.linkDireto && limpa.dm.abertura.length > 640) e('com o link na 1ª mensagem, ela pode ter até 640 caracteres');
    if (!limpa.linkDireto && !limpa.dm.entrega) e('escreva a mensagem que acompanha o link');
    if (!/^https?:\/\/\S+\.\S+/.test(limpa.dm.link)) e('link inválido (precisa começar com https://)');
    if (limpa.exigirSeguir && !limpa.dm.naoSegue) e('escreva a mensagem para quem ainda não segue');
    return limpa;
  });

  return { lista, erros };
}
