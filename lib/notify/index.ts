import 'server-only';
import { env, integrations } from '../env';
import { db } from '../supabase/admin';
import { getRefData, getTicket } from '../data';
import type { NotifyKind } from '../flow';
import { build, type BuildCtx, type EmailMsg, type TgMsg } from './templates';
import { sendEmail } from './email';
import { sendMessage } from './telegram';

type Payload = { email: EmailMsg } | { telegram: TgMsg };

async function log(ticketId: string, kind: string, channel: 'email' | 'telegram', target: string, status: 'sent' | 'failed' | 'skipped', payload: Payload, error?: string) {
  await db().from('notifications').insert({ ticket_id: ticketId, kind, channel, target, status, error: error ?? null, payload });
}

async function deliver(ticketId: string, kind: string, p: Payload) {
  if ('email' in p) {
    const target = p.email.to.join(', ');
    if (!integrations.email) return log(ticketId, kind, 'email', target, 'skipped', p, 'SMTP belum dikonfigurasi');
    try { await sendEmail(p.email); await log(ticketId, kind, 'email', target, 'sent', p); }
    catch (e) { await log(ticketId, kind, 'email', target, 'failed', p, (e as Error).message); }
  } else {
    const target = p.telegram.chatId;
    if (!integrations.telegram) return log(ticketId, kind, 'telegram', target, 'skipped', p, 'Bot Telegram belum dikonfigurasi');
    try { await sendMessage(p.telegram.chatId, p.telegram.text, p.telegram.buttons); await log(ticketId, kind, 'telegram', target, 'sent', p); }
    catch (e) { await log(ticketId, kind, 'telegram', target, 'failed', p, (e as Error).message); }
  }
}

async function approverChats(): Promise<string[]> {
  const { data } = await db().from('admins').select('telegram_user_id').in('role', ['super_admin', 'approver']).eq('aktif', true).not('telegram_user_id', 'is', null);
  return (data ?? []).map(a => String(a.telegram_user_id));
}

/**
 * Kirim semua notifikasi untuk kejadian ini. Dipanggil lewat `after()`
 * sehingga tidak memperlambat respons. Galat dicatat, tidak dilempar.
 */
export async function dispatch(ticketId: string, kinds: NotifyKind[], extra: Partial<BuildCtx> = {}) {
  if (!kinds.length) return;
  try {
    const t = await getTicket(ticketId);
    if (!t) return;
    const ref = await getRefData();
    const needsApprovers = kinds.some(k => k === 'approval' || k === 'escalation');
    const ctx: BuildCtx = {
      baseUrl: env.baseUrl, opsEmail: ref.settings.ops_email || env.opsEmail, approverChats: needsApprovers ? await approverChats() : [],
      threshold: ref.settings.approval_threshold, autoCloseDays: ref.settings.auto_close_days, ...extra,
    };
    for (const kind of kinds) {
      const b = build(kind, t, ctx);
      if (!t.team.telegram_chat_id && kind !== 'rejected') {
        // Tetap tercatat agar admin tahu grup tim belum diatur.
        if (['new', 'reassigned', 'scheduled', 'done', 'reopened', 'metoo', 'escalation'].includes(kind)) {
          await log(ticketId, kind, 'telegram', `grup ${t.team.nama}`, 'skipped', { telegram: { chatId: '', text: '', buttons: [] } }, 'Chat ID grup tim belum diisi');
        }
      }
      for (const email of b.emails) await deliver(ticketId, kind, { email });
      for (const telegram of b.telegrams) await deliver(ticketId, kind, { telegram });
    }
  } catch (e) {
    console.error('NOTIFY', ticketId, kinds, e);
  }
}

/** Kirim ulang notifikasi yang tercatat (dari panel admin). */
export async function resend(notificationId: string) {
  const { data } = await db().from('notifications').select('*').eq('id', notificationId).maybeSingle();
  if (!data) throw new Error('Notifikasi tidak ditemukan.');
  const p = data.payload as Payload;
  if ('telegram' in p && !p.telegram.chatId) throw new Error('Chat ID grup tim belum diisi. Atur di Master data → Tim.');
  await deliver(data.ticket_id, data.kind, p);
}
