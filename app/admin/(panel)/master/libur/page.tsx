import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Button, Card, EmptyState, Input } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { deleteHoliday, saveHoliday } from '../actions';
import { CalendarDays } from 'lucide-react';

export const metadata: Metadata = { title: 'Hari libur' };

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  return (
    <>
      <MasterHeader active="libur" role={admin.role} title="Master data" subtitle="Libur nasional dan cuti bersama tidak dihitung sebagai hari kerja (SLA dan auto-close)" ok={sp.ok} error={sp.e} />
      <Card title="Tambah hari libur">
        <form action={saveHoliday} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
          <Input name="tanggal" type="date" required aria-label="Tanggal" /><Input name="nama" placeholder="Mis. Hari Raya Natal" required aria-label="Nama libur" /><Button type="submit">Tambah</Button>
        </form>
      </Card>
      <Card title="Daftar libur">
        {ref.holidays.length === 0 ? <EmptyState icon={<CalendarDays className="size-5" />} title="Belum ada hari libur">Tambahkan libur nasional sesuai SKB 3 Menteri tahun berjalan.</EmptyState> : (
          <ul className="flex flex-col divide-y divide-line">
            {ref.holidays.map(h => (
              <li key={h.tanggal} className="flex items-center gap-3 py-2 text-sm">
                <span className="num w-40 text-muted">{fmtDate(`${h.tanggal}T00:00:00+07:00`)}</span><span className="flex-1 font-semibold">{h.nama}</span>
                <form action={deleteHoliday}><input type="hidden" name="tanggal" value={h.tanggal} /><Button type="submit" size="sm" variant="ghost" aria-label={`Hapus ${h.nama}`}><Trash2 className="size-4" /></Button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
