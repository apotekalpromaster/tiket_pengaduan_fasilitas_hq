import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { monthRange, stats } from '@/lib/queries';
import { fmtMonth, fmtRp, wibMonthKey } from '@/lib/format';
import { Button, ButtonLink, Card, PageHeader, Select } from '@/components/ui';
import { Bars, Kpi, TeamLegend } from '@/components/admin/widgets';

export const metadata: Metadata = { title: 'Laporan' };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tim?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const ref = await getRefData();
  const { from, to, key } = monthRange(sp.bulan ?? '');
  const team = ref.teams.find(t => t.kode === sp.tim);
  const teamId = admin.role === 'admin' && !team ? admin.team_id : team?.id ?? null;
  const { s, tickets } = await stats(from, to, teamId);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i); return wibMonthKey(d); });
  const h = (v: number | null) => (v === null ? '–' : v.toFixed(1));
  const byStatus = ['BARU', 'DITERIMA', 'DIJADWALKAN', 'DIKERJAKAN', 'MENUNGGU', 'SELESAI', 'CLOSED', 'DITOLAK', 'DUPLIKAT'].map(st => [st, tickets.filter(t => t.status === st).length] as const);
  const vendorCost = new Map<string, number>();
  tickets.filter(t => t.exec_type === 'vendor' && t.approval_status !== 'denied').forEach(t => vendorCost.set(t.vendor_name ?? '-', (vendorCost.get(t.vendor_name ?? '-') ?? 0) + (t.cost_actual ?? t.cost_estimate)));
  const exportHref = `/api/laporan/export?bulan=${key}${teamId ? `&tim=${ref.teams.find(t => t.id === teamId)?.kode}` : ''}`;

  return (
    <>
      <PageHeader title="Laporan bulanan" subtitle={`${fmtMonth(from)} · ${teamId ? 'Tim ' + ref.teams.find(t => t.id === teamId)?.nama : 'semua tim'}`}
        action={<ButtonLink href={exportHref} variant="soft" prefetch={false}><Download className="size-4" />Unduh Excel</ButtonLink>} />
      <form className="flex flex-wrap items-end gap-2" action="/admin/laporan">
        <Select name="bulan" defaultValue={key} aria-label="Bulan" className="w-auto">{months.map(m => <option key={m} value={m}>{fmtMonth(`${m}-15T00:00:00+07:00`)}</option>)}</Select>
        <Select name="tim" defaultValue={sp.tim ?? (teamId ? ref.teams.find(t => t.id === teamId)?.kode : '')} aria-label="Tim" className="w-auto">
          <option value="">Semua tim</option>{ref.teams.map(t => <option key={t.id} value={t.kode}>{t.nama}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Tampilkan</Button>
      </form>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <Kpi label="Tiket masuk" value={s.total} />
        <Kpi label="Selesai/Closed" value={s.doneThisMonth} />
        <Kpi label="Rata-rata respon" value={h(s.avgResponse)} unit="jam kerja" />
        <Kpi label="Rata-rata selesai" value={h(s.avgResolve)} unit="jam kerja" />
        <Kpi label="Kepuasan" value={h(s.avgRating)} unit="/ 5" hint={`${s.ratingCount} penilaian`} />
        <Kpi label="Total biaya" value={fmtRp(s.cost)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Per kategori"><div className="flex flex-col gap-3"><Bars rows={s.byCategory.map(c => ({ label: c.nama, n: c.n, team: c.team }))} /><TeamLegend teams={ref.teams} /></div></Card>
        <Card title="Lokasi teratas"><Bars rows={s.topLocations.map(l => ({ label: l.nama, n: l.n }))} /></Card>
        <Card title="Per status"><Bars rows={byStatus.filter(([, n]) => n).map(([st, n]) => ({ label: st.charAt(0) + st.slice(1).toLowerCase(), n }))} /></Card>
        <Card title="Biaya per vendor">
          {vendorCost.size === 0 ? <p className="text-sm text-muted">Belum ada pekerjaan vendor bulan ini.</p> : (
            <table className="w-full text-sm"><tbody>{[...vendorCost].sort((a, b) => b[1] - a[1]).map(([v, c]) => <tr key={v} className="border-t border-line first:border-0"><td className="py-2">{v}</td><td className="num py-2 text-right font-semibold">{fmtRp(c)}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </>
  );
}
