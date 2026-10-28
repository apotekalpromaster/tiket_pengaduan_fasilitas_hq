import Link from 'next/link';
import { Users } from 'lucide-react';
import { Chip, cx } from '../ui';
import { StatusChip } from '../status';
import { relTime } from '@/lib/format';
import { locationLabel } from '@/lib/labels';
import type { TicketView } from '@/lib/types';

export function Kpi({ label, value, unit, alert, hint }: { label: string; value: string | number; unit?: string; alert?: boolean; hint?: string }) {
  return (
    <div className={cx('flex flex-col gap-0.5 rounded-xl border px-3.5 py-3', alert ? 'border-amber-200 bg-amber-50' : 'border-line bg-surface')}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="num text-2xl font-extrabold leading-8">{value}{unit && <small className="text-[13px] font-semibold"> {unit}</small>}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

const TEAM_COLOR: Record<string, string> = { oss: 'bg-brand-500', oasis: 'bg-violet-text', hk: 'bg-sky-text' };

export function Bars({ rows }: { rows: { label: string; n: number; team?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  if (!rows.length) return <p className="text-sm text-muted">Belum ada data.</p>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map(r => (
        <div key={r.label} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_32px] items-center gap-2 text-xs">
          <span className="truncate">{r.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', TEAM_COLOR[r.team ?? ''] ?? 'bg-brand-500')} style={{ width: `${(r.n / max) * 100}%` }} /></div>
          <span className="num text-right font-bold">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function TeamLegend({ teams }: { teams: { kode: string; nama: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted">
      {teams.map(t => <span key={t.kode} className="inline-flex items-center gap-1"><i className={cx('inline-block size-2.5 rounded-[3px]', TEAM_COLOR[t.kode] ?? 'bg-brand-500')} />{t.nama}</span>)}
    </div>
  );
}

export function TicketCard({ t, compact }: { t: TicketView; compact?: boolean }) {
  return (
    <Link href={`/admin/tiket/${t.id}`} className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-surface p-2.5 shadow-card hover:border-brand-300">
      <div className="flex items-center justify-between gap-2"><span className="num text-[11px] font-bold text-muted">{t.code}</span>{!compact && <StatusChip t={t} />}</div>
      <b className="text-[13px] font-bold leading-[18px]">{t.issue || t.category.nama}</b>
      <span className="text-xs text-muted">{locationLabel(t.location)}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>{t.team.nama}</Chip>
        {t.me_too_count > 0 && <Chip tone="brand"><Users className="size-3" aria-hidden />{t.me_too_count + 1}</Chip>}
        {t.approval_status === 'pending' && <Chip tone="amber">Approval</Chip>}
        {t.sla_due_at && Date.parse(t.sla_due_at) < Date.now() && <Chip tone="red">Lewat SLA</Chip>}
        <span className="text-xs text-muted">{relTime(t.created_at)}</span>
      </div>
    </Link>
  );
}
