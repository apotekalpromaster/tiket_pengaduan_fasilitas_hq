import { describe, it, expect } from 'vitest';
import { addWorkDays, addWorkHours, isWorkday, makeConfig, nextWorkSlot, workHoursBetween } from '@/lib/workhours';

const wib = (s: string) => Date.parse(`${s}+07:00`);
const cfg = makeConfig({ work_days: [1, 2, 3, 4, 5], work_start: 9, work_end: 16 }, [{ tanggal: '2026-12-25' }]);

describe('jam kerja WIB', () => {
  it('Senin–Jumat hari kerja, Sabtu/Minggu dan libur bukan', () => {
    expect(isWorkday(wib('2026-10-28T10:00:00'), cfg)).toBe(true); // Rabu
    expect(isWorkday(wib('2026-10-31T10:00:00'), cfg)).toBe(false); // Sabtu
    expect(isWorkday(wib('2026-11-01T10:00:00'), cfg)).toBe(false); // Minggu
    expect(isWorkday(wib('2026-12-25T10:00:00'), cfg)).toBe(false); // libur
  });

  it('pergantian hari mengikuti WIB, bukan UTC', () => {
    // Senin 06.00 WIB = Minggu 23.00 UTC
    expect(isWorkday(wib('2026-11-02T06:00:00'), cfg)).toBe(true);
    // Sabtu 05.00 WIB = Jumat 22.00 UTC
    expect(isWorkday(wib('2026-10-31T05:00:00'), cfg)).toBe(false);
  });

  it('menghitung jam kerja dalam satu hari', () => {
    expect(workHoursBetween(wib('2026-10-28T10:00:00'), wib('2026-10-28T12:30:00'), cfg)).toBeCloseTo(2.5);
    expect(workHoursBetween(wib('2026-10-28T07:00:00'), wib('2026-10-28T18:00:00'), cfg)).toBeCloseTo(7);
  });

  it('melewati akhir pekan', () => {
    // Jumat 15.00 → Senin 10.00 = 1 + 1 jam
    expect(workHoursBetween(wib('2026-10-30T15:00:00'), wib('2026-11-02T10:00:00'), cfg)).toBeCloseTo(2);
  });

  it('menambah jam kerja melewati malam dan akhir pekan', () => {
    expect(addWorkHours(wib('2026-10-28T14:00:00'), 4, cfg)).toBe(wib('2026-10-29T11:00:00'));
    expect(addWorkHours(wib('2026-10-30T15:00:00'), 2, cfg)).toBe(wib('2026-11-02T10:00:00'));
    expect(addWorkHours(wib('2026-10-28T20:00:00'), 1, cfg)).toBe(wib('2026-10-29T10:00:00'));
  });

  it('menambah hari kerja melompati libur', () => {
    // Rabu 23 Des + 3 hari kerja: Kamis 24, (25 libur), Senin 28, Selasa 29
    expect(addWorkDays(wib('2026-12-23T10:00:00'), 3, cfg)).toBe(wib('2026-12-29T10:00:00'));
    // Jumat + 3 = Rabu
    expect(addWorkDays(wib('2026-10-30T11:00:00'), 3, cfg)).toBe(wib('2026-11-04T11:00:00'));
  });

  it('slot kerja berikutnya', () => {
    expect(nextWorkSlot(wib('2026-10-28T13:00:00'), 10, cfg)).toBe(wib('2026-10-29T10:00:00'));
    expect(nextWorkSlot(wib('2026-10-30T13:00:00'), 10, cfg)).toBe(wib('2026-11-02T10:00:00'));
  });
});
