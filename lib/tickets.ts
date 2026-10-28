import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { db, must } from './supabase/admin';
import { env, integrations } from './env';
import { getRefData, workConfig } from './data';
import { canPerform, decide, FlowError, type Action, type Actor, type NotifyKind } from './flow';
import { addWorkHours } from './workhours';
import { dispatch } from './notify';
import { OPEN_STATUSES, STATUS_LABEL } from './labels';
import type { Jenis, Ticket } from './types';
import { uploadPhoto } from './drive';

export const newToken = () => randomBytes(9).toString('base64url');
export const hashIp = (ip: string) => createHash('sha256').update(env.ipSalt + ip).digest('hex').slice(0, 32);
export const yymmNow = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(2, 7).replace('-', '');

export interface NewTicketInput {
  locationId: string; categoryId: string; jenis: Jenis; issue: string | null; description: string | null;
  reporterName: string; reporterDivision: string | null; reporterWa: string; reporterEmail: string | null;
  deviceId: string | null; ipHash: string | null;
}
export interface UploadFile { data: Buffer; mime: string; size: number }

const RATE_WINDOW_MIN = 10, RATE_MAX = 5;

/** true bila perangkat/IP ini sudah terlalu banyak melapor dalam 10 menit. */
export async function rateLimited(deviceId: string | null, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const ors = [deviceId && `device_id.eq.${deviceId}`, ipHash && `ip_hash.eq.${ipHash}`].filter(Boolean).join(',');
  if (!ors) return false;
  const { count } = await db().from('tickets').select('id', { count: 'exact', head: true }).gte('created_at', since).or(ors);
  return (count ?? 0) >= RATE_MAX;
}

/** Tiket terbuka di lokasi + kategori yang sama (untuk "Saya juga mengalami"). */
export async function findOpenDuplicate(locationId: string, categoryId: string) {
  const { data } = await db().from('tickets')
    .select('id, code, issue, status, wait_reason, me_too_count, created_at, public_token')
    .eq('location_id', locationId).eq('category_id', categoryId).in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data as Pick<Ticket, 'id' | 'code' | 'issue' | 'status' | 'wait_reason' | 'me_too_count' | 'created_at' | 'public_token'> | null;
}

async function addEvent(ticketId: string, actor: Actor, action: string, note: string, from: string | null, to: string | null) {
  const e = actor.type === 'admin'
    ? { actor_type: actor.via === 'telegram' ? 'telegram' : 'admin', actor_admin_id: actor.admin.id, actor_name: actor.admin.nama }
    : actor.type === 'reporter' ? { actor_type: 'reporter', actor_admin_id: null, actor_name: `${actor.name} (pelapor)` }
    : { actor_type: 'system', actor_admin_id: null, actor_name: 'Sistem' };
  must(await db().from('ticket_events').insert({ ticket_id: ticketId, ...e, action, note, from_status: from, to_status: to }), 'mencatat riwayat');
}

/** Simpan foto ke Drive dan catat di ticket_photos. Mengembalikan jumlah yang tersimpan. */
export async function savePhotos(t: Pick<Ticket, 'id' | 'code'>, files: UploadFile[], fase: 'before' | 'after'): Promise<number> {
  if (!files.length || !integrations.drive) return 0;
  let n = 0;
  for (const [i, f] of files.entries()) {
    try {
      const ext = f.mime === 'image/png' ? 'png' : f.mime === 'image/webp' ? 'webp' : 'jpg';
      const id = await uploadPhoto({ name: `${t.code}-${fase === 'before' ? 'laporan' : 'sesudah'}-${Date.now()}-${i + 1}.${ext}`, mime: f.mime, data: f.data, yymm: yymmNow() });
      must(await db().from('ticket_photos').insert({ ticket_id: t.id, fase, drive_file_id: id, mime: f.mime, size_bytes: f.size }), 'mencatat foto');
      n++;
    } catch (e) { console.error('PHOTO', t.code, e); }
  }
  return n;
}

export async function createTicket(input: NewTicketInput, files: UploadFile[]) {
  const ref = await getRefData();
  const loc = ref.locations.find(l => l.id === input.locationId && l.aktif);
  const cat = ref.categories.find(c => c.id === input.categoryId && c.aktif);
  if (!loc) throw new FlowError('LOCATION', 'Lokasi tidak ditemukan.');
  if (!cat) throw new FlowError('CATEGORY', 'Kategori tidak ditemukan.');
  const work = await workConfig();
  const now = Date.now();
  const sla = cat.sla_respon_jam ? { sla_kind: 'respon', sla_due_at: new Date(addWorkHours(now, Number(cat.sla_respon_jam), work)).toISOString() } : {};
  const row = must(await db().from('tickets').insert({
    public_token: newToken(), location_id: loc.id, category_id: cat.id, team_id: cat.team_id, jenis: input.jenis,
    issue: input.issue, description: input.description, reporter_name: input.reporterName, reporter_division: input.reporterDivision,
    reporter_wa: input.reporterWa, reporter_email: input.reporterEmail, device_id: input.deviceId, ip_hash: input.ipHash, ...sla,
  }).select('*').single(), 'membuat tiket') as Ticket;
  await addEvent(row.id, { type: 'reporter', name: input.reporterName }, 'create', `Laporan dibuat lewat QR ${loc.kode}`, null, 'BARU');
  const saved = await savePhotos(row, files, 'before');
  if (files.length && saved < files.length) {
    await addEvent(row.id, { type: 'system' }, 'photo', integrations.drive ? `${files.length - saved} foto gagal diunggah ke Google Drive` : 'Foto tidak disimpan: Google Drive belum dikonfigurasi', null, null);
  }
  after(() => dispatch(row.id, ['new']));
  return row;
}

export async function addMeToo(ticketId: string, name: string) {
  const { data: t } = await db().from('tickets').select('id, status, public_token, code').eq('id', ticketId).maybeSingle();
  if (!t || !OPEN_STATUSES.includes(t.status)) throw new FlowError('CLOSED', 'Tiket ini sudah tidak aktif. Silakan buat laporan baru.');
  must(await db().rpc('add_me_too', { p_ticket: ticketId, p_by: 1 }), 'menambah laporan serupa');
  await addEvent(ticketId, { type: 'reporter', name }, 'metoo', 'Saya juga mengalami (+1)', null, null);
  // me_too_count di tiket sudah bertambah; template menampilkan total = me_too_count + 1.
  after(() => dispatch(ticketId, ['metoo'], { meTooName: name }));
  return t as Pick<Ticket, 'id' | 'status' | 'public_token' | 'code'>;
}

/**
 * Jalankan satu aksi pada tiket: cek hak akses, putuskan lewat state machine,
 * simpan dengan penguncian optimistis pada status, catat riwayat, kirim notifikasi.
 */
export async function runAction(ticketId: string, action: Action, actor: Actor) {
  const { data } = await db().from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!data) throw new FlowError('NOT_FOUND', 'Tiket tidak ditemukan.');
  const t = data as Ticket;
  if (!canPerform(actor, action.type, t)) throw new FlowError('FORBIDDEN', 'Anda tidak punya akses untuk aksi ini.');
  const ref = await getRefData();
  const cat = ref.categories.find(c => c.id === t.category_id);
  const r = decide(t, action, {
    now: Date.now(), threshold: ref.settings.approval_threshold, autoCloseDays: ref.settings.auto_close_days,
    work: await workConfig(), slaSelesaiJam: cat?.sla_selesai_jam ? Number(cat.sla_selesai_jam) : null,
  });
  const patch: Partial<Ticket> = { ...r.patch };
  if (action.type === 'approve' && actor.type === 'admin') patch.approved_by = actor.admin.id;
  if (action.type === 'reassign') {
    const team = ref.teams.find(x => x.id === action.teamId);
    if (!team) throw new FlowError('TEAM', 'Tim tidak ditemukan.');
  }
  if (action.type === 'duplicate') {
    const { data: p } = await db().from('tickets').select('id, status, me_too_count').eq('id', action.parentId).maybeSingle();
    if (!p || !OPEN_STATUSES.includes(p.status)) throw new FlowError('PARENT', 'Tiket induk harus masih terbuka.');
  }

  const { data: updated, error } = await db().from('tickets').update(patch).eq('id', t.id).eq('status', t.status).select('id');
  if (error) throw new Error(`DB: menyimpan tiket gagal (${error.message})`);
  if (!updated?.length) throw new FlowError('CONFLICT', 'Tiket baru saja diubah orang lain. Muat ulang halaman.');

  await addEvent(t.id, actor, r.action, r.note, r.to ? t.status : null, r.to);
  if (action.type === 'duplicate') {
    must(await db().rpc('add_me_too', { p_ticket: action.parentId, p_by: 1 + t.me_too_count }), 'menggabungkan laporan');
    await addEvent(action.parentId, actor, 'merge', `Tiket ${t.code} digabung ke sini`, null, null);
  }

  const actorName = actor.type === 'admin' ? actor.admin.nama : actor.type === 'reporter' ? actor.name : 'Sistem';
  const note = 'note' in action ? action.note : action.type === 'reject' ? action.reason : undefined;
  const kinds: NotifyKind[] = r.notify;
  after(() => dispatch(t.id, kinds, { actorName, note }));
  return { to: r.to, note: r.note, label: r.to ? STATUS_LABEL[r.to] : null };
}

/** Cron harian: tutup otomatis tiket Selesai yang lewat batas, kirim eskalasi SLA. */
export async function dailySweep() {
  const now = new Date().toISOString();
  const closed: string[] = [], escalated: string[] = [], errors: string[] = [];
  const { data: due } = await db().from('tickets').select('id, code').eq('status', 'SELESAI').lte('auto_close_at', now).limit(200);
  for (const t of due ?? []) {
    try { await runAction(t.id, { type: 'autoClose' }, { type: 'system' }); closed.push(t.code); }
    catch (e) { errors.push(`${t.code}: ${(e as Error).message}`); }
  }
  const { data: late } = await db().from('tickets').select('id, code').in('status', OPEN_STATUSES).lte('sla_due_at', now).is('escalated_at', null).limit(200);
  for (const t of late ?? []) {
    await db().from('tickets').update({ escalated_at: now }).eq('id', t.id);
    await addEvent(t.id, { type: 'system' }, 'escalation', 'Lewat target SLA, eskalasi dikirim', null, null);
    after(() => dispatch(t.id, ['escalation']));
    escalated.push(t.code);
  }
  return { closed, escalated, errors };
}
