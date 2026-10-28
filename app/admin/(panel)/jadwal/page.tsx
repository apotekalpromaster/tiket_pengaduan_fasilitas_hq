import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { attach, getRefData } from '@/lib/data';
import { db, must } from '@/lib/supabase/admin';
import { fmtDate, fmtTime } from '@/lib/format';
import { locationLabel } from '@/lib/labels';
import type { Ticket } from '@/lib/types';
import { ButtonLink, Chip, PageHeader, cx } from '@/components/ui';
import { StatusChip } from '@/components/status';

export const metadata: Metadata = { title: 'Jadwal' };
const H = 3600_000, OFF = 7 * H;
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Senin 00.00 WIB untuk minggu yang memuat tanggal "YYYY-MM-DD". */
function weekStart(key?: string): number {
  const base = key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? Date.parse(`${key}T00:00:00+07:00`) : Date.now();
  const w = new Date(base + OFF);
  const dow = (w.getUTCDay() + 6) % 7;
  return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - dow) - OFF;
}
const keyOf = (ms: number) => new Date(ms + OFF).toISOString().slice(0, 10);

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ minggu?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const ref = await getRefData();
  const start = weekStart(sp.minggu), end = start + 7 * 24 * H;
  let q = db().from('tickets').select('*').gte('schedule_at', new Date(start).toISOString()).lt('schedule_at', new Date(end).toISOString())
    .in('status', ['DIJADWALKAN', 'DIKERJAKAN', 'MENUNGGU', 'SELESAI', 'CLOSED']).order('schedule_at');
  if (admin.role === 'teknisi') q = q.eq('assignee_admin_id', admin.id);
  const rows = (must(await q, 'memuat jadwal') as Ticket[]).map(t => attach(t, ref));
  const today = keyOf(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => start + i * 24 * H);

  return (
    <>
      <PageHeader title="Jadwal perbaikan" subtitle={`${fmtDate(start)} – ${fmtDate(end - H)}`}
        action={<div className="flex gap-2">
          <ButtonLink variant="secondary" size="sm" href={`/admin/jadwal?minggu=${keyOf(start - 7 * 24 * H)}`}><ChevronLeft className="size-4" />Minggu lalu</ButtonLink>
          <ButtonLink variant="secondary" size="sm" href="/admin/jadwal">Minggu ini</ButtonLink>
          <ButtonLink variant="secondary" size="sm" href={`/admin/jadwal?minggu=${keyOf(end)}`}>Minggu depan<ChevronRight className="size-4" /></ButtonLink>
        </div>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {days.map((d, i) => {
          const items = rows.filter(t => keyOf(Date.parse(t.schedule_at!)) === keyOf(d));
          if (i >= 5 && !items.length) return null;
          return (
            <section key={d} className={cx('flex flex-col gap-2 rounded-xl border p-3', keyOf(d) === today ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface')}>
              <header className="flex items-baseline justify-between"><b className="font-bold">{DAYS[new Date(d + OFF).getUTCDay()]}</b><span className="text-xs text-muted">{fmtDate(d)}</span></header>
              {items.length === 0 && <p className="text-xs text-slate-400">Tidak ada jadwal</p>}
              {items.map(t => (
                <Link key={t.id} href={`/admin/tiket/${t.id}`} className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface p-2.5 hover:border-brand-300">
                  <div className="flex items-center justify-between gap-2"><span className="num text-sm font-extrabold">{fmtTime(t.schedule_at!)}</span><StatusChip t={t} /></div>
                  <b className="text-[13px] font-bold">{t.issue || t.category.nama}</b>
                  <span className="text-xs text-muted">{locationLabel(t.location)}</span>
                  <div className="flex flex-wrap gap-1.5"><Chip>{t.team.nama}</Chip><span className="text-xs text-muted">{t.exec_type === 'vendor' ? t.vendor_name : t.assignee_name}</span></div>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
