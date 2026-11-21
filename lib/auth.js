import crypto from 'node:crypto';

/** Confere a senha do painel (header Authorization: Bearer ... ou ?chave=...). */
export function autorizado(request) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return false;
  const h = request.headers.get('authorization') || '';
  const dado = h.startsWith('Bearer ') ? h.slice(7) : new URL(request.url).searchParams.get('chave') || '';
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const negado = () => Response.json({ erro: 'Senha inválida' }, { status: 401 });
