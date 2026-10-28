import type { Metadata } from 'next';
import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { getRefData } from '@/lib/data';
import { Callout } from '@/components/ui';

export const metadata: Metadata = { title: 'Pilih lokasi' };
export const dynamic = 'force-dynamic';

export default async function PickLocation({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const sp = await searchParams;
  const ref = await getRefData();
  const locs = ref.locations.filter(l => l.aktif);
  const floors = [...new Set(locs.map(l => l.lantai))].sort((a, b) => a - b);
  return (
    <>
      <div>
        <h1 className="text-xl font-extrabold">Lapor kerusakan atau kebutuhan</h1>
        <p className="text-sm text-muted">Pindai stiker QR di lokasi, atau pilih lokasinya di bawah.</p>
      </div>
      {sp.e === 'lokasi' && <Callout tone="amber">Kode QR tidak dikenali atau lokasinya sudah tidak aktif. Pilih lokasi secara manual.</Callout>}
      {floors.map(f => (
        <section key={f} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Lantai {f}</h2>
          <div className="grid grid-cols-2 gap-2">
            {locs.filter(l => l.lantai === f).map(l => (
              <Link key={l.id} href={`/r/${l.kode}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-xs font-semibold hover:border-brand-300 hover:bg-brand-50">
                <QrCode className="size-4 shrink-0 text-brand-text" aria-hidden />{l.nama}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
