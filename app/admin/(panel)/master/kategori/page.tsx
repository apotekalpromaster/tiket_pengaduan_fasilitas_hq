import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { Button, Callout, Card, Input, Select } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { saveCategory } from '../actions';

export const metadata: Metadata = { title: 'Kategori' };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  const teamOpts = ref.teams.map(t => <option key={t.id} value={t.id}>{t.nama}</option>);
  const cols = 'grid grid-cols-[110px_minmax(140px,1fr)_140px_110px_110px_70px_60px_auto] items-center gap-2';
  return (
    <>
      <MasterHeader active="kategori" role={admin.role} title="Master data" subtitle="Kategori menentukan tim penanganan dan target SLA" ok={sp.ok} error={sp.e} />
      <Callout>Target SLA dalam <b>jam kerja</b> (Senin–Jumat sesuai Pengaturan). Kosongkan bila belum ditentukan; eskalasi hanya berjalan untuk kategori yang punya target. Respon = sampai tiket diterima, Selesai = sejak diterima sampai Selesai.</Callout>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
        <div className={`${cols} min-w-[900px] pb-2 text-xs font-semibold text-muted`}><span>Kode</span><span>Nama</span><span>Tim</span><span>SLA respon (jam)</span><span>SLA selesai (jam)</span><span>Urutan</span><span>Aktif</span><span /></div>
        <div className="flex min-w-[900px] flex-col gap-2">
          {ref.categories.map(c => (
            <form key={c.id} action={saveCategory} className={cols}>
              <input type="hidden" name="id" value={c.id} />
              <Input name="kode" defaultValue={c.kode} aria-label="Kode" className="py-1.5" /><Input name="nama" defaultValue={c.nama} aria-label="Nama" className="py-1.5" />
              <Select name="team_id" defaultValue={c.team_id} aria-label="Tim" className="py-1.5">{teamOpts}</Select>
              <Input name="sla_respon_jam" type="number" step="0.5" min="0.5" defaultValue={c.sla_respon_jam ?? ''} placeholder="–" aria-label="SLA respon" className="py-1.5" />
              <Input name="sla_selesai_jam" type="number" step="0.5" min="0.5" defaultValue={c.sla_selesai_jam ?? ''} placeholder="–" aria-label="SLA selesai" className="py-1.5" />
              <Input name="urutan" type="number" defaultValue={c.urutan} aria-label="Urutan" className="py-1.5" />
              <input type="checkbox" name="aktif" defaultChecked={c.aktif} aria-label="Aktif" className="size-4 accent-[#f97316]" />
              <Button type="submit" size="sm" variant="secondary">Simpan</Button>
            </form>
          ))}
        </div>
      </div>
      <Card title="Tambah kategori">
        <form action={saveCategory} className="grid gap-2 sm:grid-cols-[120px_1fr_160px_auto]">
          <Input name="kode" placeholder="kode" required aria-label="Kode" /><Input name="nama" placeholder="Nama kategori" required aria-label="Nama" />
          <Select name="team_id" required defaultValue="" aria-label="Tim">{[<option key="" value="" disabled>Tim</option>, ...teamOpts]}</Select>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>
    </>
  );
}
