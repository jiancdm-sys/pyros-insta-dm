// Integração com o Pyros CRM: cada comentário que aciona uma campanha
// vira um lead no CRM (origem "instagram_comment"). Melhor esforço: se
// o CRM estiver fora, o robô segue funcionando normalmente.
//
// Variáveis: CRM_API_URL (ex.: https://pyros-crm.vercel.app),
// CRM_API_KEY (chave da API do CRM com escopo contacts:write),
// CRM_WHATSAPP (número do WhatsApp do CRM, só dígitos com 55).

export async function enviarLeadCRM(lead) {
  const url = process.env.CRM_API_URL;
  const key = process.env.CRM_API_KEY;
  if (!url || !key) return;
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/v1/leads?async=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'instagram_comment', ...lead }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn('CRM recusou o lead', r.status, (await r.text()).slice(0, 200));
  } catch (e) {
    console.warn('CRM indisponível ao enviar lead:', e.message);
  }
}

/** Link do WhatsApp com mensagem pronta que identifica a pessoa no CRM. */
export function linkWhatsapp(username, palavra) {
  const num = (process.env.CRM_WHATSAPP || '').replace(/\D/g, '');
  if (!num) return '';
  const texto = `Oi! Vim pelo Instagram (@${username || 'instagram'})${palavra ? ` - ${palavra}` : ''}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

/** Acrescenta o convite para o WhatsApp a uma mensagem, respeitando o limite do Instagram. */
export function comConviteWhatsapp(texto, username, palavra, limite = 640) {
  const link = linkWhatsapp(username, palavra);
  if (!link) return texto;
  const convite = `\n\n💬 Quer tirar dúvidas? Chama a gente no WhatsApp: ${link}`;
  if (texto.length + convite.length <= limite) return texto + convite;
  return texto.slice(0, Math.max(0, limite - convite.length - 1)) + '…' + convite;
}
