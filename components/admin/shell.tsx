'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, ChevronsLeft, ChevronsRight, Database, KanbanSquare, LayoutDashboard, LogOut, Menu, Printer, UserCircle, X } from 'lucide-react';
import { Logo, cx } from '../ui';
import { ThemeToggle } from './theme-toggle';

const ICONS = { dash: LayoutDashboard, tiket: KanbanSquare, jadwal: CalendarDays, laporan: BarChart3, qr: Printer, master: Database, profil: UserCircle } as const;
export interface NavItem { href: string; label: string; icon: keyof typeof ICONS; badge?: number }

export function AdminShell({ nav, user, signOut, children }: { nav: NavItem[]; user: { nama: string; peran: string }; signOut: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);
  useEffect(() => { try { setRail(localStorage.getItem('tiket-rail') === '1'); } catch { /* abaikan */ } }, []);
  useEffect(() => { setOpen(false); }, [path]);
  const toggleRail = () => { setRail(r => { try { localStorage.setItem('tiket-rail', r ? '0' : '1'); } catch { /* abaikan */ } return !r; }); };
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));

  const links = (compact: boolean) => (
    <nav className="flex flex-col gap-1" aria-label="Menu admin">
      {nav.map(n => {
        const I = ICONS[n.icon];
        return (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined} title={compact ? n.label : undefined}
            className={cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold', active(n.href) ? 'bg-brand-50 text-brand-text' : 'text-slate-600 hover:bg-slate-100')}>
            <I className="size-5 shrink-0" aria-hidden />
            {!compact && <span className="flex-1">{n.label}</span>}
            {!compact && n.badge ? <span className="rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold leading-4 text-brand-text">{n.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
  const footer = (compact: boolean) => (
    <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
      <ThemeToggle compact={compact} />
      <form action={signOut}>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" title={compact ? 'Keluar' : undefined}>
          <LogOut className="size-5 shrink-0" aria-hidden />{!compact && 'Keluar'}
        </button>
      </form>
      {!compact && <div className="px-3 pt-2 text-xs text-muted"><b className="block text-ink">{user.nama}</b>{user.peran}</div>}
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className={cx('no-print sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r border-line bg-surface p-3 lg:flex', rail ? 'w-[76px]' : 'w-64')}>
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <Logo size={36} />
          {!rail && <div className="min-w-0"><b className="block text-sm font-extrabold leading-5">Tiket Fasilitas HQ</b><span className="text-xs text-muted">Panel admin</span></div>}
        </div>
        {links(rail)}
        <button type="button" onClick={toggleRail} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" aria-label={rail ? 'Lebarkan menu' : 'Ringkas menu'}>
          {rail ? <ChevronsRight className="size-5" /> : <><ChevronsLeft className="size-5" />Ringkas menu</>}
        </button>
        {footer(rail)}
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Buka menu" className="rounded-lg p-1.5 hover:bg-slate-100"><Menu className="size-5" /></button>
        <Logo size={28} /><b className="text-sm font-extrabold">Tiket Fasilitas HQ</b>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-label="Tutup menu" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 bg-surface p-3 shadow-card">
            <div className="flex items-center gap-2.5 px-1.5"><Logo size={32} /><b className="flex-1 text-sm font-extrabold">Tiket Fasilitas HQ</b>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="rounded-lg p-1.5 hover:bg-slate-100"><X className="size-5" /></button></div>
            {links(false)}
            {footer(false)}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
