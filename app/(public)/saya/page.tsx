import type { Metadata } from 'next';
import { MyTickets } from '@/components/public/my-tickets';

export const metadata: Metadata = { title: 'Laporan saya' };

export default function MinePage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-extrabold">Laporan saya</h1>
        <p className="text-sm text-muted">Tersimpan di HP ini, tanpa login.</p>
      </div>
      <MyTickets />
    </>
  );
}
