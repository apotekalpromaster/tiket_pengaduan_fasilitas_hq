import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { Button, Card, Input, Select } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { deleteQuickIssue, saveAreaType, saveQuickIssue } from '../actions';

export const metadata: Metadata = { title: 'Masalah umum' };

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin', 'admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  const catOpts = ref.categories.map(c => <option key={c.id} value={c.id}>{c.nama}</option>);
  return (
    <>
      <MasterHeader active="masalah" role={admin.role} title="Master data" subtitle="Pilihan cepat yang muncul di form sesuai tipe area lokasi" ok={sp.ok} error={sp.e} />
      <Card title="Tipe area">
        <div className="flex flex-col gap-2">
          {ref.areaTypes.map(a => (
            <form key={a.id} action={saveAreaType} className="grid grid-cols-[120px_1fr_80px_auto] gap-2">
              <input type="hidden" name="id" value={a.id} />
              <Input name="kode" defaultValue={a.kode} aria-label="Kode" className="py-1.5" /><Input name="nama" defaultValue={a.nama} aria-label="Nama" className="py-1.5" />
              <Input name="urutan" type="number" defaultValue={a.urutan} aria-label="Urutan" className="py-1.5" /><Button type="submit" size="sm" variant="secondary">Simpan</Button>
            </form>
          ))}
          <form action={saveAreaType} className="grid grid-cols-[120px_1fr_80px_auto] gap-2 border-t border-line pt-3">
            <Input name="kode" placeholder="kode" aria-label="Kode baru" required className="py-1.5" /><Input name="nama" placeholder="Tipe area baru" aria-label="Nama baru" required className="py-1.5" />
            <Input name="urutan" type="number" placeholder="0" aria-label="Urutan" className="py-1.5" /><Button type="submit" size="sm">Tambah</Button>
          </form>
        </div>
      </Card>
      {ref.areaTypes.map(a => {
        const items = ref.quickIssues.filter(q => q.area_type_id === a.id);
        return (
          <Card key={a.id} title={a.nama} subtitle={`${items.length} pilihan · dipakai ${ref.locations.filter(l => l.area_type_id === a.id).length} lokasi`}>
            <div className="flex flex-col gap-2">
              {items.map(q => (
                <div key={q.id} className="flex flex-wrap items-center gap-2">
                  <form action={saveQuickIssue} className="grid flex-1 grid-cols-[minmax(140px,1fr)_180px_70px_auto_auto] items-center gap-2">
                    <input type="hidden" name="id" value={q.id} /><input type="hidden" name="area_type_id" value={a.id} />
                    <Input name="label" defaultValue={q.label} aria-label="Label" className="py-1.5" />
                    <Select name="category_id" defaultValue={q.category_id} aria-label="Kategori" className="py-1.5">{catOpts}</Select>
                    <Input name="urutan" type="number" defaultValue={q.urutan} aria-label="Urutan" className="py-1.5" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="aktif" defaultChecked={q.aktif} className="size-4 accent-[#f97316]" />Aktif</label>
                    <Button type="submit" size="sm" variant="secondary">Simpan</Button>
                  </form>
                  <form action={deleteQuickIssue}><input type="hidden" name="id" value={q.id} /><Button type="submit" size="sm" variant="ghost" aria-label={`Hapus ${q.label}`}><Trash2 className="size-4" /></Button></form>
                </div>
              ))}
              <form action={saveQuickIssue} className="grid grid-cols-[minmax(140px,1fr)_180px_70px_auto] gap-2 border-t border-line pt-3">
                <input type="hidden" name="area_type_id" value={a.id} />
                <Input name="label" placeholder="Masalah umum baru" required aria-label="Label baru" className="py-1.5" />
                <Select name="category_id" required defaultValue="" aria-label="Kategori" className="py-1.5">{[<option key="" value="" disabled>Kategori</option>, ...catOpts]}</Select>
                <Input name="urutan" type="number" placeholder="0" aria-label="Urutan" className="py-1.5" />
                <Button type="submit" size="sm">Tambah</Button>
              </form>
            </div>
          </Card>
        );
      })}
    </>
  );
}
