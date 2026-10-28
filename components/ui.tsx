import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, Loader2, XCircle } from 'lucide-react';
import type { Tone } from '@/lib/labels';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white shadow-primary hover:bg-brand-600 disabled:bg-brand-300',
  secondary: 'bg-surface border border-line text-ink hover:bg-slate-50',
  soft: 'bg-brand-50 border border-brand-200 text-brand-text hover:bg-brand-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:opacity-90',
};
const SIZE: Record<Size, string> = { sm: 'px-3 py-1.5 text-xs rounded-[10px] gap-1.5', md: 'px-4 py-2.5 text-sm rounded-xl gap-2' };
const btn = (v: Variant, s: Size, block?: boolean) =>
  cx('inline-flex items-center justify-center font-semibold whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100', VARIANT[v], SIZE[s], block && 'w-full');

export function Button({ variant = 'primary', size = 'md', block, loading, children, className, disabled, ...p }:
  ComponentProps<'button'> & { variant?: Variant; size?: Size; block?: boolean; loading?: boolean }) {
  return (
    <button className={cx(btn(variant, size, block), className)} disabled={disabled || loading} {...p}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', size = 'md', block, className, ...p }:
  ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={cx(btn(variant, size, block), className)} {...p} />;
}

export function Card({ title, subtitle, action, children, className, bodyClass }:
  { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface shadow-card', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-bold">{title}</h2>}
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('p-5', bodyClass)}>{children}</div>
    </section>
  );
}

const TONE: Record<Tone, string> = {
  sky: 'bg-sky-50 border-sky-200 text-sky-text', violet: 'bg-violet-50 border-violet-200 text-violet-text',
  brand: 'bg-brand-50 border-brand-200 text-brand-text', amber: 'bg-amber-50 border-amber-200 text-amber-text',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-text', red: 'bg-red-50 border-red-200 text-red-text',
  slate: 'bg-slate-100 border-slate-200 text-slate-600',
};
export function Chip({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold', TONE[tone], className)}>{children}</span>;
}

const CALLOUT_ICON = { sky: Info, amber: AlertTriangle, red: XCircle, emerald: CheckCircle2, brand: Info } as const;
export function Callout({ tone = 'sky', title, children, className }: { tone?: keyof typeof CALLOUT_ICON; title?: ReactNode; children?: ReactNode; className?: string }) {
  const I = CALLOUT_ICON[tone];
  return (
    <div className={cx('flex gap-2.5 rounded-xl border px-3.5 py-3', TONE[tone].replace(/text-\S+/, 'text-ink'), className)} role={tone === 'red' ? 'alert' : undefined}>
      <I className={cx('mt-0.5 size-4 shrink-0', TONE[tone].match(/text-\S+/)?.[0])} aria-hidden />
      <div className="min-w-0 text-sm">{title && <b className="font-bold">{title} </b>}{children}</div>
    </div>
  );
}

const fieldBase = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-muted';
export function Input({ invalid, className, ...p }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input className={cx(fieldBase, invalid && 'border-red-500', className)} aria-invalid={invalid || undefined} {...p} />;
}
export function Select({ invalid, className, ...p }: ComponentProps<'select'> & { invalid?: boolean }) {
  return <select className={cx(fieldBase, invalid && 'border-red-500', className)} aria-invalid={invalid || undefined} {...p} />;
}
export function Textarea({ invalid, className, ...p }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea className={cx(fieldBase, 'min-h-[76px] resize-y', invalid && 'border-red-500', className)} aria-invalid={invalid || undefined} {...p} />;
}

export function Field({ label, htmlFor, required, hint, error, children, className }:
  { label?: ReactNode; htmlFor?: string; required?: boolean; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="font-semibold text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</label>}
      {children}
      {error ? <span className="text-xs text-red-text">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Tabs({ items, className }: { items: { href: string; label: ReactNode; active: boolean; count?: number }[]; className?: string }) {
  return (
    <nav className={cx('inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1', className)}>
      {items.map(i => (
        <Link key={i.href} href={i.href} aria-current={i.active ? 'page' : undefined}
          className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold', i.active ? 'bg-surface text-brand-text shadow-card' : 'text-slate-600 hover:text-ink')}>
          {i.label}
          {i.count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px] leading-4', i.active ? 'bg-brand-100 text-brand-text' : 'bg-slate-200 text-slate-600')}>{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <CircleHelp className="size-3.5 text-slate-400" aria-label={text} />
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white group-hover:block group-focus-within:block">{text}</span>
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-muted">
      <div className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-600">{icon}</div>
      <b className="font-bold text-slate-700">{title}</b>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function ErrorBlock({ title = 'Data tidak bisa dimuat.', children }: { title?: string; children?: ReactNode }) {
  return <Callout tone="red" title={title}>{children ?? 'Periksa koneksi lalu coba lagi.'}</Callout>;
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold leading-8">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  // Bagian tengah logo transparan, jadi selalu di atas latar putih.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-alpro.png" alt="Apotek Alpro" width={size} height={size} className="shrink-0 rounded-full bg-white" />;
}
