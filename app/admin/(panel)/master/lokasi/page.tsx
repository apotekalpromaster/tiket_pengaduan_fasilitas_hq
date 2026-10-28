import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { Button, Card, Input, Select } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { saveLocation } from '../actions';

export const metadata: Metadata = { title: 'Lokasi' };

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin', 'admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  const areaOpts = ref.areaTypes.map(a => <option key={a.id} value={a.id}>{a.nama}</option>);
  return (
    <>
      <MasterHeader active="lokasi" role={admin.role} title="Master data" subtitle="Setiap lokasi = satu stiker QR" ok={sp.ok} error={sp.e} />
      <Card title="Tambah lokasi" subtitle="Kode dipakai di URL QR, mis. L2-PANTRY. Jangan ubah kode lokasi yang stikernya sudah ditempel.">
        <form action={saveLocation} className="grid gap-2 sm:grid-cols-[140px_1fr_90px_180px_auto]">
          <Input name="kode" placeholder="L2-PANTRY" required aria-label="Kode" />
          <Input name="nama" placeholder="Nama lokasi" required aria-label="Nama" />
          <Input name="lantai" type="number" placeholder="Lantai" required aria-label="Lantai" />
          <Select name="area_type_id" required aria-label="Tipe area" defaultValue="">{[<option key="" value="" disabled>Tipe area</option>, ...areaOpts]}</Select>
          <Button type="submit">Tambah</Button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-xs text-muted"><tr>{['Kode', 'Nama', 'Lantai', 'Tipe area', 'Urutan', 'Aktif', ''].map(h => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {ref.locations.map(l => (
              <tr key={l.id} className="border-t border-line">
                <td colSpan={7} className="p-0">
                  <form action={saveLocation} className="grid grid-cols-[150px_minmax(160px,1fr)_80px_170px_80px_60px_auto] items-center gap-2 px-3 py-2">
                    <input type="hidden" name="id" value={l.id} />
                    <Input name="kode" defaultValue={l.kode} aria-label="Kode" className="num py-1.5" />
                    <Input name="nama" defaultValue={l.nama} aria-label="Nama" className="py-1.5" />
                    <Input name="lantai" type="number" defaultValue={l.lantai} aria-label="Lantai" className="py-1.5" />
                    <Select name="area_type_id" defaultValue={l.area_type_id} aria-label="Tipe area" className="py-1.5">{areaOpts}</Select>
                    <Input name="urutan" type="number" defaultValue={l.urutan} aria-label="Urutan" className="py-1.5" />
                    <input type="checkbox" name="aktif" defaultChecked={l.aktif} aria-label="Aktif" className="size-4 accent-[#f97316]" />
                    <Button type="submit" size="sm" variant="secondary">Simpan</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
