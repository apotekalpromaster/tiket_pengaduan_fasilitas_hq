import type { Jenis, Role, Status } from './types';

export const STATUS_LABEL: Record<Status, string> = {
  BARU: 'Baru', DITERIMA: 'Diterima', DIJADWALKAN: 'Dijadwalkan', DIKERJAKAN: 'Dikerjakan', MENUNGGU: 'Menunggu',
  SELESAI: 'Selesai', CLOSED: 'Closed', DITOLAK: 'Ditolak', DUPLIKAT: 'Duplikat',
};

export type Tone = 'sky' | 'violet' | 'brand' | 'amber' | 'emerald' | 'red' | 'slate';
export const STATUS_TONE: Record<Status, Tone> = {
  BARU: 'sky', DITERIMA: 'violet', DIJADWALKAN: 'brand', DIKERJAKAN: 'brand', MENUNGGU: 'amber',
  SELESAI: 'emerald', CLOSED: 'emerald', DITOLAK: 'red', DUPLIKAT: 'slate',
};

export const OPEN_STATUSES: Status[] = ['BARU', 'DITERIMA', 'DIJADWALKAN', 'DIKERJAKAN', 'MENUNGGU'];
export const ALL_STATUSES: Status[] = ['BARU', 'DITERIMA', 'DIJADWALKAN', 'DIKERJAKAN', 'MENUNGGU', 'SELESAI', 'CLOSED', 'DITOLAK', 'DUPLIKAT'];
export const JENIS: Jenis[] = ['Kerusakan', 'Permintaan', 'Kebersihan', 'Keamanan'];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super admin', admin: 'Admin tim', teknisi: 'Teknisi', approver: 'Approver biaya',
};

export function statusText(t: { status: Status; wait_reason: 'approval' | 'part' | null }): string {
  if (t.status === 'MENUNGGU') return t.wait_reason === 'approval' ? 'Menunggu approval' : 'Menunggu part/vendor';
  return STATUS_LABEL[t.status];
}

/** Jenis laporan bawaan berdasarkan kode kategori. */
export function jenisFor(categoryKode: string | undefined): Jenis {
  if (categoryKode === 'konsumabel') return 'Permintaan';
  if (categoryKode === 'kebersihan') return 'Kebersihan';
  if (categoryKode === 'keamanan') return 'Keamanan';
  return 'Kerusakan';
}

export const locationLabel = (l: { lantai: number; nama: string }) => `Lt ${l.lantai} · ${l.nama}`;
