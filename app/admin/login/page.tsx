import type { Metadata } from 'next';
import { Logo } from '@/components/ui';
import { LoginForm } from './form';

export const metadata: Metadata = { title: 'Masuk admin' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ ke?: string; e?: string }> }) {
  const sp = await searchParams;
  const notice = sp.e === 'akses' ? 'Akun Anda tidak aktif atau belum terdaftar sebagai admin.' : undefined;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <h1 className="text-lg font-extrabold">Tiket Fasilitas HQ</h1>
            <p className="text-xs text-muted">Panel admin OSS · OASIS · Housekeeping</p>
          </div>
        </div>
        <LoginForm next={sp.ke ?? ''} notice={notice} />
        <p className="mt-4 text-xs text-muted">Lupa password? Minta super admin mengatur ulang dari menu Master data → Admin.</p>
      </div>
    </main>
  );
}
