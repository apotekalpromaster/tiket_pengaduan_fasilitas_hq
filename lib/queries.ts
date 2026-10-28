import 'server-only';
import { db, must } from './supabase/admin';
import { attach, getRefData, workConfig } from './data';
import { OPEN_STATUSES } from './labels';
import { workHoursBetween } from './workhours';
import type { Admin, RefData, Status, Ticket, TicketView } from './types';

export interface TicketFilter { group?: string; team?: string; lantai?: string; kategori?: string; q?: string }

export const STATUS_GROUPS: Record<string, { label: string; statuses: Status[] }> = {
  aktif: { label: 'Aktif', statuses: OPEN_STATUSES },
  selesai: { label: 'Menunggu konfirmasi', statuses: ['SELESAI'] },
  closed: { label: 'Closed', statuses: ['CLOSED'] },
  ditolak: { label: 'Ditolak/Duplikat', statuses: ['DITOLAK', 'DUPLIKAT'] },
  semua: { label: 'Semua', statuses: [] },
};

/** Tim bawaan filter untuk admin tim; peran lain melihat semua. */
export const defaultTeam = (a: Admin, ref: RefData) => (a.role === 'admin' && a.team_id ? ref.teams.find(t => t.id === a.team_id)?.kode ?? 'semua' : 'semua');

export async function listTickets(admin: Admin, f: TicketFilter, limit = 300): Promise<TicketView[]> {
  const ref = await getRefData();
  let q = db().from('tickets').select('*').order('created_at', { ascending: false }).limit(limit);
  const g = STATUS_GROUPS[f.group ?? 'aktif'] ?? STATUS_GROUPS.aktif;
  if (g.statuses.length) q = q.in('status', g.statuses);
  if (admin.role === 'teknisi') q = q.eq('assignee_admin_id', admin.id);
  const team = ref.teams.find(t => t.kode === f.team);
  if (team) q = q.eq('team_id', team.id);
  if (f.lantai && /^-?\d+$/.test(f.lantai)) q = q.in('location_id', ref.locations.filter(l => l.lantai === Number(f.lantai)).map(l => l.id));
  const cat = ref.categories.find(c => c.kode === f.kategori);
  if (cat) q = q.eq('category_id', cat.id);
  const s = (f.q ?? '').trim().replace(/[%,()]/g, ' ');
  if (s) q = q.or(`code.ilike.%${s}%,issue.ilike.%${s}%,description.ilike.%${s}%,reporter_name.ilike.%${s}%`);
  return (must(await q, 'memuat tiket') as Ticket[]).map(t => attach(t, ref));
}

export interface Stats {
  open: number; baru: number; pendingApproval: number; doneThisMonth: number;
  avgResponse: number | null; avgResolve: number | null; avgRating: number | null; ratingCount: number;
  cost: number; overdue: number;
  byCategory: { nama: string; team: string; n: number }[];
  byTeam: { nama: string; open: number; total: number }[];
  topLocations: { nama: string; n: number }[];
  total: number;
}

/** Statistik untuk rentang waktu [from, to). */
export async function stats(from: Date, to: Date, teamId?: string | null): Promise<{ s: Stats; tickets: TicketView[] }> {
  const ref = await getRefData();
  const work = await workConfig();
  let q = db().from('tickets').select('*').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(5000);
  if (teamId) q = q.eq('team_id', teamId);
  const T = (must(await q, 'memuat statistik') as Ticket[]).map(t => attach(t, ref));
  let oq = db().from('tickets').select('id, status, approval_status, sla_due_at, team_id').in('status', OPEN_STATUSES);
  if (teamId) oq = oq.eq('team_id', teamId);
  const openRows = must(await oq, 'memuat tiket terbuka') as Pick<Ticket, 'id' | 'status' | 'approval_status' | 'sla_due_at' | 'team_id'>[];
  const now = Date.now();
  const valid = T.filter(t => !['DITOLAK', 'DUPLIKAT'].includes(t.status));
  const resp = valid.filter(t => t.accepted_at).map(t => workHoursBetween(Date.parse(t.created_at), Date.parse(t.accepted_at!), work));
  const reso = valid.filter(t => t.done_at).map(t => workHoursBetween(Date.parse(t.created_at), Date.parse(t.done_at!), work));
  const rated = valid.filter(t => t.rating);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const count = <K extends string>(items: K[]) => items.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<K, number>());

  const catCount = count(valid.map(t => t.category_id));
  const locCount = new Map<string, number>();
  valid.forEach(t => locCount.set(t.location_id, (locCount.get(t.location_id) ?? 0) + 1 + t.me_too_count));

  return {
    tickets: T,
    s: {
      total: T.length,
      open: openRows.length,
      baru: openRows.filter(t => t.status === 'BARU').length,
      pendingApproval: openRows.filter(t => t.approval_status === 'pending').length,
      overdue: openRows.filter(t => t.sla_due_at && Date.parse(t.sla_due_at) < now).length,
      doneThisMonth: valid.filter(t => t.status === 'SELESAI' || t.status === 'CLOSED').length,
      avgResponse: avg(resp), avgResolve: avg(reso),
      avgRating: avg(rated.map(t => t.rating!)), ratingCount: rated.length,
      cost: valid.filter(t => t.approval_status !== 'denied').reduce((s, t) => s + (t.cost_actual ?? (t.done_at ? t.cost_estimate : 0) ?? 0), 0),
      byCategory: [...catCount].map(([id, n]) => { const c = ref.categories.find(x => x.id === id); return { nama: c?.nama ?? '-', team: ref.teams.find(x => x.id === c?.team_id)?.kode ?? '', n }; }).sort((a, b) => b.n - a.n),
      byTeam: ref.teams.map(tm => ({ nama: tm.nama, open: openRows.filter(t => t.team_id === tm.id).length, total: valid.filter(t => t.team_id === tm.id).length })),
      topLocations: [...locCount].map(([id, n]) => { const l = ref.locations.find(x => x.id === id); return { nama: l ? `Lt ${l.lantai} · ${l.nama}` : '-', n }; }).sort((a, b) => b.n - a.n).slice(0, 8),
    },
  };
}

/** Rentang bulan WIB dari "YYYY-MM". */
export function monthRange(key: string): { from: Date; to: Date; key: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  const now = new Date(Date.now() + 7 * 3600_000);
  const y = m ? Number(m[1]) : now.getUTCFullYear(), mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const from = new Date(Date.UTC(y, mo, 1) - 7 * 3600_000), to = new Date(Date.UTC(y, mo + 1, 1) - 7 * 3600_000);
  return { from, to, key: `${y}-${String(mo + 1).padStart(2, '0')}` };
}
