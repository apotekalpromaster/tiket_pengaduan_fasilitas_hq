import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { defaultTeam, listTickets, STATUS_GROUPS } from '@/lib/queries';
import { fmtDateTime, fmtRp } from '@/lib/format';
import { locationLabel } from '@/lib/labels';
import type { Status } from '@/lib/types';
import { Button, Chip, EmptyState, Input, PageHeader, Select, Tabs, cx } from '@/components/ui';
import { StatusChip } from '@/components/status';
import { TicketCard } from '@/components/admin/widgets';
import { Inbox } from 'lucide-react';

export const metadata: Metadata = { title: 'Tiket' };

type SP = { group?: string; team?: string; lantai?: string; kategori?: string; q?: string; view?: string };

const KANBAN: { key: string; statuses: Status[] }[] = [
  { key: 'BARU', statuses: ['BARU'] }, { key: 'DITERIMA', statuses: ['DITERIMA'] }, { key: 'DIJADWALKAN', statuses: ['DIJADWALKAN'] },
  { key: 'DIKERJAKAN', statuses: ['DIKERJAKAN'] }, { key: 'MENUNGGU', statuses: ['MENUNGGU'] }, { key: 'SELESAI', statuses: ['SELESAI'] },
  { key: 'CLOSED', statuses: ['CLOSED'] }, { key: 'DITOLAK', statuses: ['DITOLAK', 'DUPLIKAT'] },
];

export default async function TicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const ref = await getRefData();
  const f = { group: sp.group ?? 'aktif', team: sp.team ?? defaultTeam(admin, ref), lantai: sp.lantai ?? '', kategori: sp.kategori ?? '', q: sp.q ?? '' };
  const view = sp.view === 'daftar' ? 'daftar' : 'kanban';
  const tickets = await listTickets(admin, f);
  const href = (patch: Partial<SP>) => '/admin/tiket?' + new URLSearchParams(Object.entries({ ...f, view, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
  const floors = [...new Set(ref.locations.map(l => l.lantai))].sort((a, b) => a - b);
  const cols = f.group === 'aktif' ? KANBAN.slice(0, 5) : f.group === 'semua' ? KANBAN : KANBAN.filter(k => k.statuses.some(s => STATUS_GROUPS[f.group]?.statuses.includes(s)));

  return (
    <>
      <PageHeader title="Tiket" subtitle={admin.role === 'teknisi' ? 'Tiket yang ditugaskan kepada Anda' : `${tickets.length} tiket`}
        action={<Tabs items={[{ href: href({ view: 'kanban' }), label: 'Kanban', active: view === 'kanban' }, { href: href({ view: 'daftar' }), label: 'Daftar', active: view === 'daftar' }]} />} />

      <div className="flex flex-col gap-3">
        <Tabs items={Object.entries(STATUS_GROUPS).map(([k, g]) => ({ href: href({ group: k }), label: g.label, active: f.group === k }))} />
        <form className="flex flex-wrap items-end gap-2" action="/admin/tiket">
          <input type="hidden" name="group" value={f.group} /><input type="hidden" name="view" value={view} />
          <Select name="team" defaultValue={f.team} aria-label="Tim" className="w-auto">
            <option value="semua">Semua tim</option>{ref.teams.map(t => <option key={t.id} value={t.kode}>{t.nama}</option>)}
          </Select>
          <Select name="lantai" defaultValue={f.lantai} aria-label="Lantai" className="w-auto">
            <option value="">Semua lantai</option>{floors.map(x => <option key={x} value={x}>Lantai {x}</option>)}
          </Select>
          <Select name="kategori" defaultValue={f.kategori} aria-label="Kategori" className="w-auto">
            <option value="">Semua kategori</option>{ref.categories.map(c => <option key={c.id} value={c.kode}>{c.nama}</option>)}
          </Select>
          <Input name="q" defaultValue={f.q} placeholder="Cari kode, masalah, pelapor" aria-label="Cari" className="w-56" />
          <Button type="submit" variant="secondary"><Search className="size-4" aria-hidden />Terapkan</Button>
        </form>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon={<Inbox className="size-5" />} title="Tidak ada tiket">Ubah filter untuk melihat tiket lain.</EmptyState>
      ) : view === 'kanban' ? (
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {cols.map(c => {
            const items = tickets.filter(t => c.statuses.includes(t.status));
            return (
              <section key={c.key} className="flex w-[232px] shrink-0 flex-col gap-2 rounded-xl border border-line bg-slate-50 p-2">
                <header className="flex items-center justify-between px-1 py-0.5"><StatusChip t={{ status: c.key as Status, wait_reason: null }} /><span className="rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-600">{items.length}</span></header>
                {items.length === 0 && <p className="py-2.5 text-center text-xs text-slate-400">Kosong</p>}
                {items.map(t => <TicketCard key={t.id} t={t} compact={c.key !== 'MENUNGGU' && c.key !== 'DITOLAK'} />)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-xs text-muted">
              <tr>{['Kode', 'Masalah', 'Lokasi', 'Tim', 'Status', 'Pelaksana', 'Jadwal', 'Biaya', 'Dibuat'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr key={t.id} className={cx('border-t border-line', i % 2 === 1 && 'bg-slate-50/50')}>
                  <td className="num whitespace-nowrap px-3 py-2"><Link className="font-semibold text-brand-text hover:underline" href={`/admin/tiket/${t.id}`}>{t.code}</Link></td>
                  <td className="px-3 py-2">{t.issue || t.category.nama}{t.me_too_count > 0 && <Chip tone="brand" className="ml-1.5">+{t.me_too_count}</Chip>}</td>
                  <td className="whitespace-nowrap px-3 py-2">{locationLabel(t.location)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{t.team.nama}</td>
                  <td className="whitespace-nowrap px-3 py-2"><StatusChip t={t} /></td>
                  <td className="whitespace-nowrap px-3 py-2">{t.assignee_name ?? '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{t.schedule_at ? fmtDateTime(t.schedule_at) : '-'}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right">{t.cost_actual ?? t.cost_estimate ? fmtRp(t.cost_actual ?? t.cost_estimate) : '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtDateTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
