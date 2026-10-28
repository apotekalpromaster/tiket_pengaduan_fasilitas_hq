import { NextResponse } from 'next/server';
import { env, integrations } from '@/lib/env';
import { db } from '@/lib/supabase/admin';
import { runAction } from '@/lib/tickets';
import { FlowError, type Action } from '@/lib/flow';
import { answerCallback, clearButtons, sendMessage } from '@/lib/notify/telegram';
import { esc } from '@/lib/notify/templates';
import type { Admin } from '@/lib/types';

export const runtime = 'nodejs';

interface TgUser { id: number; first_name?: string }
interface TgChat { id: number; type: string; title?: string }
interface Update {
  message?: { message_id: number; chat: TgChat; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: TgChat } };
}

const ok = () => NextResponse.json({ ok: true });

export async function POST(req: Request) {
  if (!integrations.telegram || !env.telegram.secret || req.headers.get('x-telegram-bot-api-secret-token') !== env.telegram.secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const u = (await req.json().catch(() => ({}))) as Update;
  try {
    if (u.callback_query) await onCallback(u.callback_query);
    else if (u.message?.text) await onMessage(u.message as Required<Update>['message'] & { text: string });
  } catch (e) {
    console.error('TELEGRAM_WEBHOOK', e);
  }
  // Selalu 200 agar Telegram tidak mengulang kiriman.
  return ok();
}

async function onMessage(m: { chat: TgChat; from?: TgUser; text: string }) {
  const [cmd, arg] = m.text.trim().split(/\s+/, 2);
  const c = cmd.toLowerCase().replace(/@.*$/, '');
  if (c === '/id') {
    await sendMessage(String(m.chat.id), `Chat ID ${m.chat.type === 'private' ? 'pribadi' : 'grup ' + esc(m.chat.title ?? '')}: <code>${m.chat.id}</code>\nSalin ke Master data → Tim di panel admin.`);
  } else if (c === '/link') {
    if (m.chat.type !== 'private' || !m.from) {
      await sendMessage(String(m.chat.id), 'Kirim /link KODE lewat chat pribadi ke bot, bukan di grup.');
      return;
    }
    const code = (arg ?? '').trim().toUpperCase();
    const { data: a } = code ? await db().from('admins').select('id, nama').eq('link_code', code).maybeSingle() : { data: null };
    if (!a) { await sendMessage(String(m.chat.id), 'Kode tidak dikenali. Buat kode baru di Profil pada panel admin.'); return; }
    await db().from('admins').update({ telegram_user_id: null }).eq('telegram_user_id', m.from.id);
    await db().from('admins').update({ telegram_user_id: m.from.id, link_code: null }).eq('id', a.id);
    await sendMessage(String(m.chat.id), `Akun Telegram terhubung ke ${esc(a.nama)}. Tombol Terima dan Setujui di notifikasi sekarang bisa dipakai.`);
  } else if (c === '/start' || c === '/help') {
    await sendMessage(String(m.chat.id), 'Bot Tiket Fasilitas HQ.\n/id: tampilkan chat ID (untuk grup tim)\n/link KODE: hubungkan akun admin (kode dari menu Profil)');
  }
}

async function onCallback(q: Required<Update>['callback_query']) {
  const [verb, ticketId] = (q.data ?? '').split(':');
  if (!ticketId || !/^[0-9a-f-]{36}$/i.test(ticketId)) { await answerCallback(q.id, 'Tombol tidak dikenali.'); return; }
  const { data: admin } = await db().from('admins').select('*').eq('telegram_user_id', q.from.id).eq('aktif', true).maybeSingle();
  if (!admin) {
    await answerCallback(q.id, 'Akun Telegram Anda belum terhubung. Buka Profil di panel admin lalu kirim /link KODE ke bot.', true);
    return;
  }
  const a = admin as Admin;
  const action: Action | null =
    verb === 'accept' ? { type: 'accept' } :
    verb === 'take' ? { type: 'accept', assigneeName: a.nama, assigneeAdminId: a.role === 'teknisi' ? a.id : null } :
    verb === 'approve' ? { type: 'approve' } :
    verb === 'deny' ? { type: 'deny', note: 'Ditolak lewat Telegram' } : null;
  if (!action) { await answerCallback(q.id, 'Tombol tidak dikenali.'); return; }
  try {
    const r = await runAction(ticketId, action, { type: 'admin', admin: a, via: 'telegram' });
    await answerCallback(q.id, r.label ? `Berhasil: ${r.label}` : 'Berhasil');
    if (q.message) await clearButtons(q.message.chat.id, q.message.message_id, [[{ text: 'Buka di panel', url: `${env.baseUrl}/admin/tiket/${ticketId}` }]]).catch(() => {});
  } catch (e) {
    const msg = e instanceof FlowError ? e.message : 'Gagal memproses. Coba dari panel admin.';
    await answerCallback(q.id, msg, true);
  }
}
