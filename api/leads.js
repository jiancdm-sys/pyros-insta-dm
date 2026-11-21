// Leads: /api/leads (JSON, usado pelo painel) ou /api/leads?formato=csv
import { autorizado, negado } from '../lib/auth.js';
import { liberar, listarLeads } from '../lib/store.js';

const COLS = ['username', 'campanha', 'status', 'erro', 'segue', 'comentario', 'comentou_em', 'link_em', 'media_id', 'comment_id', 'igsid'];
const esc = (v = '') => `"${String(v).replace(/"/g, '""')}"`;

// DELETE /api/leads?igsid=...&campanha=... libera a pessoa para receber a campanha de novo.
export async function DELETE(request) {
  if (!autorizado(request)) return negado();
  const u = new URL(request.url).searchParams;
  const igsid = u.get('igsid');
  const campanha = u.get('campanha');
  if (!igsid || !campanha) return Response.json({ erro: 'Informe igsid e campanha.' }, { status: 400 });
  await liberar(`camp:${campanha}:${igsid}`);
  return Response.json({ ok: true });
}

export async function GET(request) {
  if (!autorizado(request)) return negado();
  const leads = (await listarLeads()).sort((a, b) => (b.comentou_em || '').localeCompare(a.comentou_em || ''));

  if (new URL(request.url).searchParams.get('formato') !== 'csv') return Response.json({ leads });

  const csv = '﻿' + [COLS.join(';'), ...leads.map((l) => COLS.map((c) => esc(l[c])).join(';'))].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-pyros-instagram.csv"',
    },
  });
}
