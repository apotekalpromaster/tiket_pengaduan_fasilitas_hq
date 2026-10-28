'use client';
/** Penyimpanan per perangkat (localStorage). Semua akses dibungkus try/catch. */
export interface Identity { nama: string; divisi: string; wa: string; email: string }
export interface MyTicket { token: string; code: string; issue: string; location: string; at: string }

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } };

export const loadIdentity = () => read<Identity | null>('tiket-pelapor', null);
export const saveIdentity = (i: Identity) => write('tiket-pelapor', i);

export function deviceId(): string {
  let id = read<string | null>('tiket-device', null);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const b = new Uint8Array(12); crypto.getRandomValues(b);
    id = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    write('tiket-device', id);
  }
  return id;
}

export const loadMine = () => read<MyTicket[]>('tiket-saya', []);
export function rememberTicket(t: MyTicket) {
  const list = loadMine().filter(x => x.token !== t.token);
  write('tiket-saya', [t, ...list].slice(0, 30));
}
