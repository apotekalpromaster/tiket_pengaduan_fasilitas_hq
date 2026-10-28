'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    setDark(attr ? attr === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('tiket-tema', next); } catch { /* abaikan */ }
    setDark(!dark);
  };
  const I = dark ? Sun : Moon;
  return (
    <button type="button" onClick={toggle} aria-label={dark ? 'Tema terang' : 'Tema gelap'} title={dark ? 'Tema terang' : 'Tema gelap'}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
      <I className="size-5 shrink-0" aria-hidden />{!compact && (dark ? 'Tema terang' : 'Tema gelap')}
    </button>
  );
}
