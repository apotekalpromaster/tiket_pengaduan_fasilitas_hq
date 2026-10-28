const TZ = 'Asia/Jakarta';

const dt = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dtY = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const date = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const month = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, month: 'long', year: 'numeric' });
const num = new Intl.NumberFormat('id-ID');

type D = string | number | Date;
const d = (v: D) => (v instanceof Date ? v : new Date(v));

export const fmtDateTime = (v: D) => dt.format(d(v));
export const fmtDateTimeYear = (v: D) => dtY.format(d(v));
export const fmtDay = (v: D) => day.format(d(v));
export const fmtDate = (v: D) => date.format(d(v));
export const fmtTime = (v: D) => time.format(d(v));
export const fmtMonth = (v: D) => month.format(d(v));
export const fmtRp = (n: number | null | undefined) => 'Rp ' + num.format(n ?? 0);
export const fmtNum = (n: number) => num.format(n);
export const fmtKB = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;

export function relTime(v: D, now = Date.now()): string {
  const m = Math.round((now - d(v).getTime()) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

/** Nilai untuk <input type="datetime-local"> dalam WIB. */
export function toWibInput(v: D): string {
  const w = new Date(d(v).getTime() + 7 * 3600_000);
  return w.toISOString().slice(0, 16);
}

/** Parse "YYYY-MM-DDTHH:mm" (WIB) menjadi Date. */
export function fromWibInput(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const r = new Date(`${s}:00+07:00`);
  return Number.isNaN(r.getTime()) ? null : r;
}

/** "YYYY-MM" bulan berjalan dalam WIB. */
export function wibMonthKey(v: D = new Date()): string {
  return new Date(d(v).getTime() + 7 * 3600_000).toISOString().slice(0, 7);
}

export const initials = (s: string) => (s || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
