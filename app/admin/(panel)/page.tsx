import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { listTickets, monthRange, stats } from '@/lib/queries';
import { fmtMonth, fmtRp } from '@/lib/format';
import { ALL_STATUSES } from '@/lib/labels';
import { Callout, Card, Chip, EmptyState, PageHeader } from '@/components/ui';
import { Bars, Kpi, TeamLegend, TicketCard } from '@/components/admin/widgets';
import { StatusChip } from '@/components/status';
import { CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const ref = await getRefData();
  const { from, to } = monthRange('');
  const teamId = admin.role === 'admin' ? admin.team_id : null;
  const [{ s }, attention] = await Promise.all([
    stats(from, to, teamId),
    listTickets(admin, { group: 'aktif', team: teamId ? ref.teams.find(t => t.id === teamId)?.kode : undefined }, 60),
  ]);
  const needs = attention.filter(t => t.status === 'BARU' || t.approval_status === 'pending' || (t.sla_due_at && Date.parse(t.sla_due_at) < Date.now())).slice(0, 8);
  const h = (v: number | null) => (v === null ? '–' : v.toFixed(1));

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${fmtMonth(from)}${teamId ? ` · Tim ${ref.teams.find(t => t.id === teamId)?.nama}` : ' · semua tim'}`} />
      {sp.e === 'peran' && <Callout tone="amber">Halaman itu tidak tersedia untuk peran Anda.</Callout>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <Kpi label="Tiket terbuka" value={s.open} />
        <Kpi label="Belum diterima" value={s.baru} alert={s.baru > 0} />
        <Kpi label="Menunggu approval" value={s.pendingApproval} alert={s.pendingApproval > 0} />
        <Kpi label="Lewat SLA" value={s.overdue} alert={s.overdue > 0} />
        <Kpi label="Rata-rata respon" value={h(s.avgResponse)} unit="jam kerja" />
        <Kpi label="Rata-rata selesai" value={h(s.avgResolve)} unit="jam kerja" />
        <Kpi label="Kepuasan pelapor" value={h(s.avgRating)} unit="/ 5" hint={`${s.ratingCount} penilaian`} />
        <Kpi label="Biaya bulan ini" value={fmtRp(s.cost)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Perlu tindakan" subtitle="Baru, menunggu approval, atau lewat SLA" action={<Link href="/admin/tiket" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text hover:underline">Semua tiket<ArrowRight className="size-3.5" /></Link>}>
          {needs.length ? <div className="grid gap-2 sm:grid-cols-2">{needs.map(t => <TicketCard key={t.id} t={t} />)}</div>
            : <EmptyState icon={<CheckCircle2 className="size-5" />} title="Tidak ada yang menunggu">Semua tiket sudah ditindaklanjuti.</EmptyState>}
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Tiket per kategori" subtitle={`${s.total} tiket bulan ini`}>
            <div className="flex flex-col gap-3"><Bars rows={s.byCategory.map(c => ({ label: c.nama, n: c.n, team: c.team }))} /><TeamLegend teams={ref.teams} /></div>
          </Card>
          <Card title="Lokasi paling sering dilaporkan" subtitle='Termasuk "Saya juga mengalami"'>
            <Bars rows={s.topLocations.map(l => ({ label: l.nama, n: l.n }))} />
          </Card>
        </div>
      </div>

      <Card title="Per tim">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2 pr-4 font-semibold">Tim</th><th className="py-2 pr-4 text-right font-semibold">Terbuka</th><th className="py-2 text-right font-semibold">Masuk bulan ini</th></tr></thead>
          <tbody>{s.byTeam.map(t => <tr key={t.nama} className="border-t border-line"><td className="py-2 pr-4 font-semibold">{t.nama}</td><td className="num py-2 pr-4 text-right">{t.open}</td><td className="num py-2 text-right">{t.total}</td></tr>)}</tbody>
        </table></div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Alur status</h2>
        <div className="flex flex-wrap items-center gap-1.5">{ALL_STATUSES.slice(0, 7).map(st => <StatusChip key={st} t={{ status: st, wait_reason: st === 'MENUNGGU' ? 'part' : null }} />)}<Chip tone="red">Ditolak</Chip><Chip>Duplikat</Chip></div>
        <p className="text-xs text-muted">Selesai tanpa konfirmasi pelapor dalam {ref.settings.auto_close_days} hari kerja otomatis Closed. Biaya di atas {fmtRp(ref.settings.approval_threshold)} perlu approval.</p>
      </section>
    </>
  );
}
