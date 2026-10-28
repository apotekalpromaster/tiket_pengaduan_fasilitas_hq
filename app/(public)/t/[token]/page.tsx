import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, CheckCircle2, Clock, Users } from 'lucide-react';
import { getPhotos, getTicketByToken } from '@/lib/data';
import { db } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { fmtDateTime, fmtDay, fmtTime } from '@/lib/format';
import { locationLabel } from '@/lib/labels';
import { Callout, cx } from '@/components/ui';
import { StatusChip } from '@/components/status';
import { ConfirmPanel, CopyLink, RememberTicket } from '@/components/public/status-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Status laporan' };

export default async function StatusPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ baru?: string; dukung?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const t = await getTicketByToken(token);
  if (!t) notFound();
  const photos = await getPhotos(t.id);
  const parent = t.parent_ticket_id ? (await db().from('tickets').select('code, public_token').eq('id', t.parent_ticket_id).maybeSingle()).data : null;
  const url = `${env.baseUrl}/t/${t.public_token}`;
  const issue = t.issue || t.category.nama;

  const order = ['BARU', 'DITERIMA', 'DIJADWALKAN', 'DIKERJAKAN', 'SELESAI'];
  const reached = t.status === 'CLOSED' ? 4 : t.status === 'MENUNGGU' ? (t.wait_reason === 'approval' ? 1 : 3) : order.indexOf(t.status);
  const stages: [string, string | null][] = [
    ['Laporan terkirim', fmtDateTime(t.created_at)],
    [`Diterima Tim ${t.team.nama}`, t.accepted_at && fmtDateTime(t.accepted_at)],
    ['Dijadwalkan', t.schedule_at && `${fmtDay(t.schedule_at)}, ${fmtTime(t.schedule_at)} WIB`],
    ['Dikerjakan', t.started_at && fmtDateTime(t.started_at)],
    ['Selesai', t.done_at && fmtDateTime(t.done_at)],
  ];
  const before = photos.filter(p => p.fase === 'before'), after = photos.filter(p => p.fase === 'after');

  return (
    <>
      <RememberTicket token={t.public_token} code={t.code} issue={issue} location={locationLabel(t.location)} at={t.created_at} />
      {(sp.baru || sp.dukung) && (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="grid size-16 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-text"><Check className="size-8" aria-hidden /></div>
          <h1 className="text-xl font-extrabold">{sp.dukung ? 'Dukungan tercatat' : 'Laporan terkirim'}</h1>
          <p className="text-sm text-muted">{sp.dukung ? `Anda ditambahkan ke laporan yang sudah ada. Tim ${t.team.nama} melihat ${t.me_too_count + 1} orang mengalami masalah ini.` : `Tim ${t.team.nama} sudah menerima notifikasi. Simpan link di bawah untuk memantau status.`}</p>
        </div>
      )}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2"><span className="num text-lg font-extrabold tracking-wide">{t.code}</span><StatusChip t={t} /></div>
        <b className="font-bold">{issue}</b>
        <span className="text-xs text-muted">{locationLabel(t.location)} · {t.jenis}</span>
        {t.me_too_count > 0 && <span className="text-xs text-muted"><Users className="mr-1 inline size-3" aria-hidden />{t.me_too_count + 1} orang melaporkan masalah ini</span>}
      </section>

      {t.status === 'DITOLAK' && <Callout tone="red" title="Tidak dapat diproses.">{t.reject_reason}</Callout>}
      {t.status === 'DUPLIKAT' && parent && <Callout title="Digabung.">Laporan ini digabung ke <a className="font-semibold text-brand-text underline" href={`/t/${parent.public_token}`}>{parent.code}</a> karena masalahnya sama.</Callout>}
      {t.status === 'MENUNGGU' && <Callout tone="amber">{t.wait_reason === 'approval' ? 'Perbaikan butuh biaya dan sedang menunggu persetujuan.' : 'Sedang menunggu suku cadang atau vendor.'}</Callout>}

      {!['DITOLAK', 'DUPLIKAT'].includes(t.status) && (
        <ol className="flex flex-col">
          {stages.map(([label, sub], i) => {
            const st = i <= reached ? 'ok' : i === reached + 1 ? 'now' : '';
            return (
              <li key={label} className="relative grid grid-cols-[24px_1fr] gap-2.5 pb-3.5 last:pb-0">
                {i < stages.length - 1 && <span className="absolute bottom-0 left-[11px] top-[24px] w-0.5 bg-line" aria-hidden />}
                <span className={cx('grid size-6 place-items-center rounded-full border-2', st === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-text' : st === 'now' ? 'border-brand-400 bg-brand-50 text-brand-text' : 'border-line bg-surface text-slate-400')}>
                  {st === 'ok' ? <Check className="size-3" /> : <Clock className="size-3" />}
                </span>
                <div><b className="block font-bold">{label}</b><span className="text-xs text-muted">{sub || (st === 'now' ? 'Sedang berlangsung' : 'Belum')}</span></div>
              </li>
            );
          })}
        </ol>
      )}

      {t.done_note && t.status !== 'DIKERJAKAN' && <p className="text-sm"><span className="text-muted">Catatan tim: </span>{t.done_note}</p>}

      {(before.length > 0 || after.length > 0) && (
        <div className="flex flex-col gap-2">
          {[['Foto laporan', before], ['Foto sesudah perbaikan', after]].map(([label, list]) => (list as typeof photos).length > 0 && (
            <div key={label as string} className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{label as string}</span>
              <div className="flex flex-wrap gap-2">
                {(list as typeof photos).map(p => (
                  <a key={p.id} href={`/api/foto/${p.id}?t=${t.public_token}`} target="_blank" rel="noreferrer" className="size-[76px] overflow-hidden rounded-xl border border-line bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/foto/${p.id}?t=${t.public_token}`} alt={label as string} className="size-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {t.status === 'SELESAI' && <ConfirmPanel token={t.public_token} autoClose={t.auto_close_at ? fmtDay(t.auto_close_at) : null} />}
      {t.status === 'CLOSED' && (
        <Callout tone="emerald" title="Tiket ditutup.">{t.rating ? `Penilaian Anda ${t.rating}/5. Terima kasih.` : 'Ditutup otomatis setelah tidak ada konfirmasi.'}</Callout>
      )}
      <CopyLink url={url} />
      {t.status === 'CLOSED' && <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="size-3.5" aria-hidden />Masalah muncul lagi? Pindai QR di lokasi untuk membuat laporan baru.</p>}
    </>
  );
}
