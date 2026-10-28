import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, History, Mail, MessageCircle, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getEvents, getNotifications, getPhotos, getRefData, getTicket, workConfig } from '@/lib/data';
import { db } from '@/lib/supabase/admin';
import { availableActions } from '@/lib/flow';
import { nextWorkSlot } from '@/lib/workhours';
import { fmtDateTime, fmtDay, fmtRp, fmtTime, toWibInput } from '@/lib/format';
import { NOTIFY_LABEL, OPEN_STATUSES, STATUS_LABEL, locationLabel } from '@/lib/labels';
import { env } from '@/lib/env';
import { Card, Chip } from '@/components/ui';
import { StatusChip } from '@/components/status';
import { ActionPanel, ResendButton } from '@/components/admin/action-panel';
import { resendAction, ticketAction } from './actions';

export const metadata: Metadata = { title: 'Detail tiket' };

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTicket(id);
  if (!t) notFound();
  if (admin.role === 'teknisi' && t.assignee_admin_id !== admin.id) notFound();
  const [events, photos, notifs, ref, work] = await Promise.all([getEvents(id), getPhotos(id), getNotifications(id), getRefData(), workConfig()]);
  const { data: techRows } = await db().from('admins').select('id, nama').eq('team_id', t.team_id).eq('role', 'teknisi').eq('aktif', true).order('nama');
  const { data: dupRows } = await db().from('tickets').select('id, code, issue').eq('location_id', t.location_id).in('status', OPEN_STATUSES).neq('id', t.id).limit(20);
  const { data: staffRows } = await db().from('tickets').select('assignee_name').eq('team_id', t.team_id).eq('exec_type', 'internal').not('assignee_name', 'is', null).is('assignee_admin_id', null).order('created_at', { ascending: false }).limit(50);
  const staffNames = [...new Set((staffRows ?? []).map(r => r.assignee_name as string))].slice(0, 10);
  const allowed = availableActions({ type: 'admin', admin }, t);
  const before = photos.filter(p => p.fase === 'before'), after = photos.filter(p => p.fase === 'after');
  const fact = (k: string, v: React.ReactNode) => v ? <><dt className="text-muted">{k}</dt><dd className="min-w-0 break-words font-semibold">{v}</dd></> : null;

  return (
    <>
      <Link href="/admin/tiket" className="inline-flex items-center gap-1 self-start text-xs font-semibold text-slate-600 hover:text-ink"><ChevronLeft className="size-4" />Semua tiket</Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="num text-xs text-muted">{t.code} · dibuat {fmtDateTime(t.created_at)}</span>
          <h1 className="text-2xl font-extrabold leading-8">{t.issue || t.category.nama}</h1>
          <span className="text-muted">{locationLabel(t.location)} · {t.area?.nama}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusChip t={t} /><Chip>{t.team.nama}</Chip>
          {t.me_too_count > 0 && <Chip tone="brand"><Users className="size-3" />{t.me_too_count + 1} pelapor</Chip>}
          {t.sla_due_at && <Chip tone={Date.parse(t.sla_due_at) < Date.now() ? 'red' : 'slate'}>SLA {t.sla_kind} {fmtDateTime(t.sla_due_at)}</Chip>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              {fact('Jenis', t.jenis)}{fact('Kategori', t.category.nama)}{fact('Deskripsi', t.description || '-')}
              {fact('Pelapor', `${t.reporter_name}${t.reporter_division ? ' · ' + t.reporter_division : ''}`)}
              {fact('WhatsApp', <a className="num text-brand-text hover:underline" href={`https://wa.me/62${t.reporter_wa.replace(/^0/, '')}`} target="_blank" rel="noreferrer">{t.reporter_wa}</a>)}
              {fact('Email', t.reporter_email)}
              {fact('Pelaksana', t.assignee_name && (t.exec_type === 'vendor' ? `${t.vendor_name} (vendor)` : t.assignee_name))}
              {fact('Jadwal', t.schedule_at && `${fmtDay(t.schedule_at)}, ${fmtTime(t.schedule_at)} WIB`)}
              {fact('Biaya', (t.cost_estimate > 0 || t.cost_actual) && `${fmtRp(t.cost_actual ?? t.cost_estimate)}${t.cost_actual !== null && t.cost_actual !== t.cost_estimate ? ` (estimasi ${fmtRp(t.cost_estimate)})` : ''}${t.approval_status ? ' · ' + { pending: 'menunggu approval', approved: 'disetujui', denied: 'ditolak' }[t.approval_status] : ''}`)}
              {fact('Catatan selesai', t.done_note)}
              {fact('Penilaian', t.rating && `${t.rating}/5${t.feedback ? ` · "${t.feedback}"` : ''}`)}
              {fact('Alasan tolak', t.reject_reason)}
              {fact('Otomatis Closed', t.status === 'SELESAI' && t.auto_close_at && fmtDay(t.auto_close_at))}
              {fact('Link pelapor', <a className="break-all text-brand-text hover:underline" href={`/t/${t.public_token}`} target="_blank" rel="noreferrer">{env.baseUrl}/t/{t.public_token}</a>)}
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              {[['Foto laporan', before], ['Foto sesudah', after]].map(([label, list]) => (
                <div key={label as string} className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">{label as string} (Google Drive)</span>
                  <div className="flex flex-wrap gap-2">
                    {(list as typeof photos).length === 0 && <span className="text-xs text-muted">Tidak ada foto</span>}
                    {(list as typeof photos).map(p => (
                      <a key={p.id} href={`/api/foto/${p.id}`} target="_blank" rel="noreferrer" className="size-[88px] overflow-hidden rounded-xl border border-line bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/foto/${p.id}`} alt={label as string} className="size-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <ActionPanel
            ticketId={t.id} status={t.status} allowed={allowed} teamId={t.team_id}
            teams={ref.teams.map(x => ({ id: x.id, nama: x.nama }))} techs={(techRows ?? []) as { id: string; nama: string }[]} staffNames={staffNames}
            dupCandidates={(dupRows ?? []).map(d => ({ id: d.id, label: `${d.code} · ${d.issue ?? ''}` }))}
            threshold={ref.settings.approval_threshold}
            defaultWhen={toWibInput(t.schedule_at ?? nextWorkSlot(Date.now(), 10, work))}
            current={{ exec: t.exec_type, assigneeName: t.assignee_name, assigneeAdminId: t.assignee_admin_id, vendor: t.vendor_name, cost: t.cost_estimate, approvalCost: t.approval_status === 'approved' ? t.approved_cost : null }}
            action={ticketAction.bind(null, t.id)}
          />
        </div>

        <div className="flex flex-col gap-6">
          <Card title={<span className="inline-flex items-center gap-2"><History className="size-4" />Riwayat</span>}>
            <ol className="flex flex-col gap-3 text-xs">
              {[...events].reverse().map(e => (
                <li key={e.id} className="grid grid-cols-[92px_1fr] gap-2">
                  <time className="num text-muted">{fmtDateTime(e.at)}</time>
                  <div><b className="font-bold">{e.actor_name}{e.actor_type === 'telegram' && <span className="font-normal text-muted"> via Telegram</span>}</b>
                    <div className="text-muted">{e.note}{e.from_status && e.to_status ? ` (${STATUS_LABEL[e.from_status]} → ${STATUS_LABEL[e.to_status]})` : ''}</div></div>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Notifikasi" subtitle="Email dan Telegram untuk tiket ini">
            {notifs.length === 0 ? <p className="text-sm text-muted">Belum ada notifikasi.</p> : (
              <ul className="flex flex-col gap-2.5 text-xs">
                {notifs.map(n => (
                  <li key={n.id} className="flex flex-wrap items-center gap-2">
                    {n.channel === 'email' ? <Mail className="size-3.5 text-sky-text" /> : <MessageCircle className="size-3.5 text-violet-text" />}
                    <span className="min-w-0 flex-1 break-words"><b className="font-semibold">{NOTIFY_LABEL[n.kind] ?? n.kind}</b> · {n.target} · {fmtDateTime(n.created_at)}
                      {n.error && <span className="block text-muted">{n.error}</span>}</span>
                    <Chip tone={n.status === 'sent' ? 'emerald' : n.status === 'failed' ? 'red' : 'slate'}>{n.status === 'sent' ? 'Terkirim' : n.status === 'failed' ? 'Gagal' : 'Dilewati'}</Chip>
                    {n.status !== 'sent' && admin.role !== 'teknisi' && <ResendButton action={resendAction.bind(null, n.id, t.id)} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
