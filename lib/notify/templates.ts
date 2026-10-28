/**
 * Isi notifikasi (murni, tanpa I/O): email HTML + teks dan pesan Telegram.
 * Bahasa Indonesia, tanpa emoji, sesuai pedoman copy Aset Kantor.
 */
import type { NotifyKind } from '../flow';
import type { TicketView } from '../types';
import { locationLabel } from '../labels';
import { fmtDateTime, fmtDay, fmtRp, fmtTime } from '../format';

export interface EmailMsg { to: string[]; subject: string; html: string; text: string }
export interface TgButton { text: string; data?: string; url?: string }
export interface TgMsg { chatId: string; text: string; buttons: TgButton[][] }
export interface Built { emails: EmailMsg[]; telegrams: TgMsg[] }

export interface BuildCtx {
  baseUrl: string;
  opsEmail: string;
  /** Chat Telegram pribadi approver/super admin untuk permintaan approval. */
  approverChats: string[];
  actorName?: string;
  note?: string;
  meTooName?: string;
  threshold: number;
  autoCloseDays: number;
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const issueOf = (t: TicketView) => t.issue || t.category.nama;
const where = (t: TicketView) => locationLabel(t.location);
const who = (t: TicketView) => (t.exec_type === 'vendor' ? `${t.vendor_name} (vendor)` : t.assignee_name || `Tim ${t.team.nama}`);

function emailHtml(title: string, intro: string, rows: [string, string][], cta: { label: string; url: string }) {
  const tr = rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;color:#0f172a;font-weight:600">${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html lang="id"><body style="margin:0;background:#f8fafc;font-family:'Plus Jakarta Sans',Inter,Arial,sans-serif;font-size:14px;line-height:20px;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
<div style="padding:16px 20px;border-bottom:2px solid #f97316;font-weight:800;font-size:16px">Tiket Fasilitas HQ · Apotek Alpro</div>
<div style="padding:20px">
<h1 style="margin:0 0 8px;font-size:18px;line-height:24px">${esc(title)}</h1>
<p style="margin:0 0 16px;color:#334155">${esc(intro)}</p>
<table style="border-collapse:collapse;font-size:13px;line-height:18px;margin-bottom:20px">${tr}</table>
<a href="${esc(cta.url)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:12px">${esc(cta.label)}</a>
</div></div>
<p style="color:#64748b;font-size:12px;margin:12px 4px">Email otomatis dari Tiket Fasilitas HQ. Jangan balas email ini.</p>
</div></body></html>`;
}
const emailText = (title: string, intro: string, rows: [string, string][], url: string) =>
  `${title}\n\n${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${url}`;

function mail(to: string[], subject: string, title: string, intro: string, rows: [string, string][], cta: { label: string; url: string }): EmailMsg {
  return { to: [...new Set(to.filter(Boolean))], subject, html: emailHtml(title, intro, rows, cta), text: emailText(title, intro, rows, cta.url) };
}

export function build(kind: NotifyKind, t: TicketView, c: BuildCtx): Built {
  const adminUrl = `${c.baseUrl}/admin/tiket/${t.id}`;
  const statusUrl = `${c.baseUrl}/t/${t.public_token}`;
  const teamEmails = [c.opsEmail, ...(t.team.email_extra ?? [])];
  const reporter = t.reporter_email ? [t.reporter_email] : [];
  const subj = `[${t.code}] ${t.location.nama} Lt ${t.location.lantai} · ${issueOf(t)}`;
  const chat = t.team.telegram_chat_id;
  const tg = (text: string, buttons: TgButton[][] = []): TgMsg[] => (chat ? [{ chatId: chat, text, buttons }] : []);
  const open: TgButton = { text: 'Buka di panel', url: adminUrl };
  const head = (title: string) => `<b>${esc(title)}</b>\n${esc(where(t))}\n${esc(t.category.nama)} · ${esc(issueOf(t))}`;
  const out: Built = { emails: [], telegrams: [] };

  switch (kind) {
    case 'new':
      out.emails.push(mail(teamEmails, `Laporan baru ${subj}`, `Laporan baru ${t.code}`, `Ada laporan fasilitas baru untuk Tim ${t.team.nama}.`, [
        ['Lokasi', where(t)], ['Kategori', t.category.nama], ['Jenis', t.jenis], ['Masalah', issueOf(t)], ['Deskripsi', t.description || '-'],
        ['Tim', t.team.nama], ['Pelapor', `${t.reporter_name} · ${t.reporter_division ?? '-'} · ${t.reporter_wa}`],
      ], { label: 'Buka tiket', url: adminUrl }));
      out.telegrams.push(...tg(`${head(`Tiket baru ${t.code}`)}\n${t.description ? `"${esc(t.description)}"\n` : ''}Pelapor: ${esc(t.reporter_name)} (${esc(t.reporter_division ?? '-')}) · ${esc(t.reporter_wa)}`,
        [[{ text: 'Terima', data: `accept:${t.id}` }, { text: 'Ambil tiket', data: `take:${t.id}` }], [open]]));
      break;
    case 'reassigned':
      out.emails.push(mail(teamEmails, `Tiket dialihkan ke ${t.team.nama} ${subj}`, `Tiket ${t.code} dialihkan`, `Tiket ini sekarang ditangani Tim ${t.team.nama}.`, [
        ['Lokasi', where(t)], ['Masalah', issueOf(t)], ['Deskripsi', t.description || '-'], ['Dialihkan oleh', c.actorName ?? '-'],
      ], { label: 'Buka tiket', url: adminUrl }));
      out.telegrams.push(...tg(`${head(`Tiket dialihkan ke ${t.team.nama}: ${t.code}`)}\nOleh ${esc(c.actorName ?? '-')}`,
        [[{ text: 'Terima', data: `accept:${t.id}` }, { text: 'Ambil tiket', data: `take:${t.id}` }], [open]]));
      break;
    case 'accepted':
      out.telegrams.push(...tg(`<b>${esc(t.code)} diterima</b>\nDitangani ${esc(c.actorName ?? '-')}${t.assignee_name ? `, pelaksana ${esc(t.assignee_name)}` : ''}.`));
      break;
    case 'scheduled':
      if (t.schedule_at) {
        out.telegrams.push(...tg(`<b>${esc(t.code)} dijadwalkan</b>\n${esc(fmtDay(t.schedule_at))} pukul ${esc(fmtTime(t.schedule_at))}\nPelaksana: ${esc(who(t))}${t.cost_estimate ? `\nEstimasi biaya: ${esc(fmtRp(t.cost_estimate))}` : ''}`, [[open]]));
        if (reporter.length) out.emails.push(mail(reporter, `Laporan Anda dijadwalkan: ${t.code}`, 'Laporan Anda sudah dijadwalkan',
          `Halo ${t.reporter_name}, laporan Anda di ${where(t)} sudah dijadwalkan.`,
          [['Masalah', issueOf(t)], ['Jadwal', `${fmtDay(t.schedule_at)}, ${fmtTime(t.schedule_at)} WIB`], ['Pelaksana', who(t)]], { label: 'Lihat status', url: statusUrl }));
      }
      break;
    case 'approval': {
      const rows: [string, string][] = [['Lokasi', where(t)], ['Masalah', issueOf(t)], ['Pelaksana', who(t)], ['Estimasi biaya', fmtRp(t.cost_estimate)], ['Diajukan oleh', c.actorName ?? '-']];
      out.emails.push(mail([c.opsEmail], `Perlu persetujuan biaya ${fmtRp(t.cost_estimate)}: ${t.code}`, `Persetujuan biaya ${t.code}`,
        `Estimasi biaya melebihi ambang ${fmtRp(c.threshold)} dan perlu persetujuan Ops Manager.`, rows, { label: 'Tinjau', url: adminUrl }));
      const text = `<b>Persetujuan biaya ${esc(t.code)}</b>\n${esc(where(t))} · ${esc(issueOf(t))}\nPelaksana: ${esc(who(t))}\nEstimasi: ${esc(fmtRp(t.cost_estimate))}\nDiajukan: ${esc(c.actorName ?? '-')}`;
      const btns = [[{ text: 'Setujui', data: `approve:${t.id}` }, { text: 'Tolak', data: `deny:${t.id}` }], [open]];
      for (const chatId of c.approverChats) out.telegrams.push({ chatId, text, buttons: btns });
      out.telegrams.push(...tg(`<b>${esc(t.code)} menunggu approval</b>\nEstimasi ${esc(fmtRp(t.cost_estimate))} diajukan ke Ops Manager.`));
      break;
    }
    case 'approved':
      out.telegrams.push(...tg(`<b>Biaya ${esc(t.code)} disetujui</b>\n${esc(fmtRp(t.cost_estimate))} disetujui ${esc(c.actorName ?? '-')}.`));
      break;
    case 'denied':
      out.telegrams.push(...tg(`<b>Biaya ${esc(t.code)} ditolak</b>\n${esc(c.actorName ?? '-')} menolak estimasi ${esc(fmtRp(t.cost_estimate))}.${c.note ? `\n"${esc(c.note)}"` : ''}\nCari alternatif lalu jadwalkan ulang.`, [[open]]));
      break;
    case 'rejected':
      if (reporter.length) out.emails.push(mail(reporter, `Laporan ${t.code} tidak dapat diproses`, 'Laporan tidak dapat diproses',
        `Halo ${t.reporter_name}, laporan Anda di ${where(t)} tidak dapat diproses.`, [['Masalah', issueOf(t)], ['Alasan', t.reject_reason ?? '-']], { label: 'Lihat status', url: statusUrl }));
      break;
    case 'done':
      out.telegrams.push(...tg(`<b>${esc(t.code)} selesai dikerjakan</b>\n${esc(t.done_note ?? '')}\nMenunggu konfirmasi pelapor${t.auto_close_at ? ` (otomatis Closed ${esc(fmtDay(t.auto_close_at))})` : ''}.`));
      if (reporter.length) out.emails.push(mail(reporter, `Mohon konfirmasi: ${t.code} selesai dikerjakan`, 'Perbaikan selesai, mohon konfirmasi',
        `Halo ${t.reporter_name}, pekerjaan di ${where(t)} sudah selesai. Mohon konfirmasi dan beri penilaian.`,
        [['Masalah', issueOf(t)], ['Catatan', t.done_note ?? '-'], ['Batas konfirmasi', t.auto_close_at ? `${fmtDay(t.auto_close_at)} (otomatis Closed)` : '-']],
        { label: 'Konfirmasi', url: statusUrl }));
      break;
    case 'reopened':
      out.emails.push(mail(teamEmails, `Dibuka lagi oleh pelapor ${subj}`, `${t.code} dibuka lagi`, 'Pelapor menyatakan masalah belum beres.',
        [['Lokasi', where(t)], ['Masalah', issueOf(t)], ['Keterangan pelapor', c.note ?? '-']], { label: 'Buka tiket', url: adminUrl }));
      out.telegrams.push(...tg(`<b>${esc(t.code)} dibuka lagi oleh pelapor</b>\n"${esc(c.note ?? 'Masalah belum beres.')}"`, [[open]]));
      break;
    case 'closed':
      out.telegrams.push(...tg(`<b>${esc(t.code)} Closed</b>\nPelapor konfirmasi sudah beres. Rating ${t.rating ?? '-'}/5${t.feedback ? `\n"${esc(t.feedback)}"` : ''}`));
      break;
    case 'closed_auto':
      out.telegrams.push(...tg(`<b>${esc(t.code)} Closed otomatis</b>\nTanpa respons pelapor ${c.autoCloseDays} hari kerja.`));
      break;
    case 'metoo':
      out.telegrams.push(...tg(`<b>+1 laporan serupa ${esc(t.code)}</b>\n${esc(c.meTooName ?? 'Karyawan')} juga mengalami ${esc(issueOf(t).toLowerCase())} di ${esc(where(t))}. Total ${t.me_too_count + 1} orang.`, [[open]]));
      break;
    case 'escalation': {
      const kind = t.sla_kind === 'respon' ? 'belum diterima' : 'belum selesai';
      out.emails.push(mail([c.opsEmail, ...(t.team.email_extra ?? [])], `Lewat SLA: ${subj}`, `${t.code} lewat target SLA`,
        `Tiket ini ${kind} melewati target ${t.sla_due_at ? fmtDateTime(t.sla_due_at) : ''}.`,
        [['Lokasi', where(t)], ['Masalah', issueOf(t)], ['Tim', t.team.nama], ['Status', t.status]], { label: 'Buka tiket', url: adminUrl }));
      out.telegrams.push(...tg(`<b>Lewat SLA: ${esc(t.code)}</b>\n${esc(where(t))} · ${esc(issueOf(t))}\nTiket ${kind}.`, [[open]]));
      for (const chatId of c.approverChats) out.telegrams.push({ chatId, text: `<b>Eskalasi SLA ${esc(t.code)}</b>\nTim ${esc(t.team.nama)} · ${esc(where(t))} · ${kind}.`, buttons: [[open]] });
      break;
    }
  }
  return out;
}
