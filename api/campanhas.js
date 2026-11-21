// API do painel: GET lista as campanhas, PUT salva todas.
import { autorizado, negado } from '../lib/auth.js';
import { carregarCampanhas, salvarCampanhas, validarCampanhas } from '../lib/config.js';
import { storeAtivo } from '../lib/store.js';

export async function GET(request) {
  if (!autorizado(request)) return negado();
  return Response.json({ campanhas: await carregarCampanhas(), storeAtivo });
}

export async function PUT(request) {
  if (!autorizado(request)) return negado();
  if (!storeAtivo) {
    return Response.json({ erro: 'Banco (Upstash Redis) não conectado na Vercel — não dá para salvar.' }, { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }
  const { lista, erros } = validarCampanhas(body.campanhas);
  if (erros.length) return Response.json({ erro: 'Corrija antes de salvar', detalhes: erros }, { status: 422 });
  await salvarCampanhas(lista);
  return Response.json({ ok: true, campanhas: lista });
}
