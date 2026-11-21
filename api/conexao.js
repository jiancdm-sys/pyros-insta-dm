// Aba "Conexão" do painel: status e cadastro das credenciais do Instagram.
// Os segredos nunca são devolvidos para o navegador.
import { autorizado, negado } from '../lib/auth.js';
import * as ig from '../lib/ig.js';
import { getAppSecret, getIgId, getToken, setAppSecret, setIgId, setToken, storeAtivo } from '../lib/store.js';

async function status(request) {
  const origem = new URL(request.url).origin;
  const igId = await getIgId();
  const out = {
    storeAtivo,
    webhookUrl: `${origem}/api/webhook`,
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || null,
    appSecret: Boolean(await getAppSecret()),
    igId: igId || null,
    token: false,
    conta: null,
    erroConta: null,
    webhooksAssinados: null,
    tipoToken: null,
  };
  const tokenSalvo = await getToken();
  if (tokenSalvo) {
    out.token = true;
    out.tipoToken = ig.tokenInstagram(tokenSalvo) ? 'instagram' : 'sistema';
    if (igId || out.tipoToken === 'instagram') {
      try {
        out.conta = await ig.minhaConta();
      } catch (e) {
        out.erroConta = e.message;
      }
    }
  }
  return out;
}

export async function GET(request) {
  if (!autorizado(request)) return negado();
  return Response.json(await status(request));
}

export async function PUT(request) {
  if (!autorizado(request)) return negado();
  if (!storeAtivo) return Response.json({ erro: 'Banco (Upstash Redis) não conectado.' }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const appSecret = String(body.appSecret || '').trim();
  const igId = String(body.igId || '').trim();

  if (igId && !/^\d{5,30}$/.test(igId)) {
    return Response.json({ erro: 'O ID da conta do Instagram tem só números.' }, { status: 400 });
  }
  if (appSecret && !/^[a-f0-9]{32}$/i.test(appSecret)) {
    return Response.json({ erro: 'App secret inválido (são 32 caracteres, letras a-f e números).' }, { status: 400 });
  }

  const tokenFinal = token || (await getToken());
  const idFinal = igId || (await getIgId());
  if (token && !idFinal) {
    return Response.json({ erro: 'Informe também o ID da conta do Instagram.' }, { status: 400 });
  }

  // Valida antes de gravar qualquer coisa.
  if ((token || igId) && tokenFinal && idFinal) {
    try {
      await ig.minhaConta(tokenFinal, idFinal);
    } catch (e) {
      const tipo = ig.tokenInstagram(tokenFinal) ? 'Instagram' : 'usuário do sistema/Facebook';
      const diag = await ig.diagnostico(tokenFinal, idFinal).catch((x) => ({ erro: x.message }));
      return Response.json({ erro: `O Instagram recusou o token ou o ID (tipo de token: ${tipo}): ${e.message} | Diagnóstico: ${JSON.stringify(diag)}` }, { status: 400 });
    }
  }

  if (igId) await setIgId(igId);
  if (token) await setToken(token);
  if (appSecret) await setAppSecret(appSecret);

  let erroAssinatura = null;
  let assinados = null;
  if ((token || igId) && tokenFinal && idFinal) {
    try {
      await ig.assinarWebhooks(tokenFinal, idFinal);
      assinados = true;
    } catch (e) {
      assinados = false;
      erroAssinatura = e.message;
      console.warn('subscribed_apps falhou', e.message);
    }
  }

  return Response.json({ ...(await status(request)), webhooksAssinados: assinados, erroAssinatura });
}
