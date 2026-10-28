/**
 * Jam kerja HQ dalam WIB (UTC+7, tanpa DST). Server Vercel berjalan di UTC,
 * jadi semua perhitungan memakai offset tetap, bukan zona waktu mesin.
 */
export interface WorkConfig { days: number[]; start: number; end: number; holidays: Set<string> }

const OFFSET = 7 * 3600_000;
const H = 3600_000;

/** Tanggal WIB "YYYY-MM-DD" dan hari (0 = Minggu) dari epoch ms. */
function wibParts(ms: number) {
  const w = new Date(ms + OFFSET);
  return { key: w.toISOString().slice(0, 10), dow: w.getUTCDay() };
}
/** Epoch ms untuk jam `hour` WIB pada tanggal WIB yang memuat `ms`. */
function atWibHour(ms: number, hour: number) {
  const w = new Date(ms + OFFSET);
  return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), hour) - OFFSET;
}
const startOfWibDay = (ms: number) => atWibHour(ms, 0);

export function makeConfig(s: { work_days: number[]; work_start: number; work_end: number }, holidays: { tanggal: string }[] = []): WorkConfig {
  return { days: s.work_days, start: s.work_start, end: s.work_end, holidays: new Set(holidays.map(h => h.tanggal)) };
}

export function isWorkday(ms: number, c: WorkConfig): boolean {
  const p = wibParts(ms);
  return c.days.includes(p.dow) && !c.holidays.has(p.key);
}

/** Tambah n hari kerja, jam tetap sama. */
export function addWorkDays(ms: number, n: number, c: WorkConfig): number {
  let t = ms, count = 0, guard = 0;
  while (count < n && guard++ < 400) { t += 24 * H; if (isWorkday(t, c)) count++; }
  return t;
}

/** Jumlah jam kerja (desimal) di antara dua waktu. */
export function workHoursBetween(a: number, b: number, c: WorkConfig): number {
  if (b <= a) return 0;
  let total = 0, guard = 0;
  for (let day = startOfWibDay(a); day < b && guard++ < 2000; day += 24 * H) {
    if (!isWorkday(day, c)) continue;
    const lo = Math.max(a, day + c.start * H), hi = Math.min(b, day + c.end * H);
    if (hi > lo) total += hi - lo;
  }
  return total / H;
}

/** Waktu setelah menambah `hours` jam kerja ke `ms`. */
export function addWorkHours(ms: number, hours: number, c: WorkConfig): number {
  let remaining = hours * H, guard = 0;
  let day = startOfWibDay(ms);
  while (guard++ < 2000) {
    if (isWorkday(day, c)) {
      const lo = Math.max(ms, day + c.start * H), hi = day + c.end * H;
      if (hi > lo) {
        if (hi - lo >= remaining) return lo + remaining;
        remaining -= hi - lo;
      }
    }
    day += 24 * H;
  }
  return ms + hours * H;
}

/** Slot kerja berikutnya pada jam `hour` (hari kerja setelah hari ini). */
export function nextWorkSlot(ms: number, hour: number, c: WorkConfig): number {
  let t = atWibHour(ms, hour), guard = 0;
  do { t += 24 * H; } while (!isWorkday(t, c) && guard++ < 60);
  return t;
}
