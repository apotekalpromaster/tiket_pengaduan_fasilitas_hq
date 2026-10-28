import 'server-only';
import { cache } from 'react';
import { db, must } from './supabase/admin';
import { makeConfig } from './workhours';
import type { RefData, Settings, Ticket, TicketEvent, TicketPhoto, TicketView, NotificationLog } from './types';

const DEFAULT_SETTINGS: Settings = {
  id: 1, approval_threshold: 1_000_000, auto_close_days: 3, work_days: [1, 2, 3, 4, 5], work_start: 9, work_end: 16,
  ops_email: 'operation@apotekalpro.id', divisi: [], updated_at: '',
};

/** Master data, dimuat sekali per request. */
export const getRefData = cache(async (): Promise<RefData> => {
  const c = db();
  const [teams, areaTypes, locations, categories, quickIssues, holidays, settings] = await Promise.all([
    c.from('teams').select('*').order('urutan'),
    c.from('area_types').select('*').order('urutan'),
    c.from('locations').select('*').order('lantai').order('urutan'),
    c.from('categories').select('*').order('urutan'),
    c.from('quick_issues').select('*').order('urutan'),
    c.from('holidays').select('*').order('tanggal'),
    c.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  return {
    teams: must(teams, 'memuat tim'), areaTypes: must(areaTypes, 'memuat tipe area'), locations: must(locations, 'memuat lokasi'),
    categories: must(categories, 'memuat kategori'), quickIssues: must(quickIssues, 'memuat masalah umum'),
    holidays: must(holidays, 'memuat libur'), settings: (must(settings, 'memuat pengaturan') as Settings | null) ?? DEFAULT_SETTINGS,
  };
});

export async function workConfig() {
  const r = await getRefData();
  return makeConfig(r.settings, r.holidays);
}

/** Lengkapi tiket dengan relasi dari master data (tanpa join SQL). */
export function attach(t: Ticket, r: RefData): TicketView {
  const location = r.locations.find(l => l.id === t.location_id)!;
  return {
    ...t,
    location,
    category: r.categories.find(c => c.id === t.category_id)!,
    team: r.teams.find(x => x.id === t.team_id)!,
    area: r.areaTypes.find(a => a.id === location?.area_type_id)!,
  };
}

export async function getTicket(id: string): Promise<TicketView | null> {
  const { data } = await db().from('tickets').select('*').eq('id', id).maybeSingle();
  return data ? attach(data as Ticket, await getRefData()) : null;
}

export async function getTicketByToken(token: string): Promise<TicketView | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  const { data } = await db().from('tickets').select('*').eq('public_token', token).maybeSingle();
  return data ? attach(data as Ticket, await getRefData()) : null;
}

export async function getEvents(ticketId: string): Promise<TicketEvent[]> {
  return must(await db().from('ticket_events').select('*').eq('ticket_id', ticketId).order('at'), 'memuat riwayat');
}

export async function getPhotos(ticketId: string): Promise<TicketPhoto[]> {
  return must(await db().from('ticket_photos').select('*').eq('ticket_id', ticketId).order('created_at'), 'memuat foto');
}

export async function getNotifications(ticketId: string): Promise<NotificationLog[]> {
  return must(await db().from('notifications').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(50), 'memuat notifikasi');
}
