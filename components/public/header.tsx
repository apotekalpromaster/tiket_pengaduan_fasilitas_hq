import Link from 'next/link';
import { List, ScanLine } from 'lucide-react';
import { Logo } from '../ui';

export function PublicHeader() {
  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <Link href="/r" className="flex min-w-0 flex-1 items-center gap-2.5">
          <Logo size={32} />
          <span className="min-w-0"><b className="block text-[15px] font-extrabold leading-5">Lapor Fasilitas</b><span className="block text-xs text-muted">Kantor Pusat Apotek Alpro</span></span>
        </Link>
        <nav className="flex gap-1">
          <Link href="/r" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><ScanLine className="size-4" aria-hidden />Lapor</Link>
          <Link href="/saya" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"><List className="size-4" aria-hidden />Laporan saya</Link>
        </nav>
      </div>
    </header>
  );
}
