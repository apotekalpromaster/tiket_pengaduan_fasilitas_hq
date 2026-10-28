import { describe, it, expect } from 'vitest';
import { availableActions, canPerform, decide, FlowError, type Ctx } from '@/lib/flow';
import { makeConfig } from '@/lib/workhours';
import type { Admin, Ticket } from '@/lib/types';

const wib = (s: string) => Date.parse(`${s}+07:00`);
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  now: wib('2026-10-28T10:00:00'), threshold: 1_000_000, autoCloseDays: 3,
  work: makeConfig({ work_days: [1, 2, 3, 4, 5], work_start: 9, work_end: 16 }), slaSelesaiJam: null, ...over,
});

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 't1', code: 'TKT-2610-0001', public_token: 'tok', location_id: 'l', category_id: 'c', team_id: 'oss', jenis: 'Kerusakan',
  issue: 'Keran bocor', description: null, reporter_name: 'Rina', reporter_division: 'Finance', reporter_wa: '0812', reporter_email: null,
  device_id: null, ip_hash: null, status: 'BARU', wait_reason: null, assignee_admin_id: null, assignee_name: null, exec_type: 'internal',
  vendor_name: null, schedule_at: null, cost_estimate: 0, cost_actual: null, approval_status: null, approved_cost: null, approved_by: null,
  approved_at: null, accepted_at: null, started_at: null, done_at: null, done_note: null, closed_at: null, closed_auto: false, rating: null,
  feedback: null, reject_reason: null, parent_ticket_id: null, me_too_count: 0, reopen_count: 0, sla_kind: null, sla_due_at: null,
  escalated_at: null, auto_close_at: null, created_at: '', updated_at: '', ...over,
});

const admin = (over: Partial<Admin> = {}): Admin => ({
  id: 'a1', user_id: 'u1', email: 'x@y', nama: 'Budi', role: 'admin', team_id: 'oss', aktif: true, must_change_password: false,
  telegram_user_id: null, link_code: null, created_at: '', ...over,
});

const sched = { type: 'schedule' as const, at: '2026-10-29T03:00:00.000Z', exec: 'internal' as const, assigneeName: 'Darto' };

describe('state machine tiket', () => {
  it('BARU → DITERIMA dengan notifikasi accepted', () => {
    const r = decide(ticket(), { type: 'accept', assigneeName: 'Darto' }, ctx());
    expect(r.to).toBe('DITERIMA');
    expect(r.patch.assignee_name).toBe('Darto');
    expect(r.notify).toEqual(['accepted']);
  });

  it('SLA penyelesaian dihitung saat diterima bila kategori punya target', () => {
    const r = decide(ticket(), { type: 'accept' }, ctx({ slaSelesaiJam: 8 }));
    expect(r.patch.sla_kind).toBe('selesai');
    expect(r.patch.sla_due_at).toBe(new Date(wib('2026-10-29T11:00:00')).toISOString());
  });

  it('menolak aksi yang tidak sah untuk status', () => {
    expect(() => decide(ticket(), { type: 'start' }, ctx())).toThrow(FlowError);
    expect(() => decide(ticket({ status: 'CLOSED' }), { type: 'accept' }, ctx())).toThrow(/Closed/);
  });

  it('jadwal dengan biaya ≤ ambang langsung DIJADWALKAN', () => {
    const r = decide(ticket({ status: 'DITERIMA' }), { ...sched, cost: 1_000_000 }, ctx());
    expect(r.to).toBe('DIJADWALKAN');
    expect(r.notify).toEqual(['scheduled']);
  });

  it('biaya > ambang masuk MENUNGGU approval', () => {
    const r = decide(ticket({ status: 'DITERIMA' }), { ...sched, cost: 2_400_000 }, ctx());
    expect(r.to).toBe('MENUNGGU');
    expect(r.patch).toMatchObject({ wait_reason: 'approval', approval_status: 'pending' });
    expect(r.notify).toEqual(['approval']);
  });

  it('jadwal ulang dengan biaya yang sudah disetujui tidak minta approval lagi', () => {
    const t = ticket({ status: 'DIJADWALKAN', approval_status: 'approved', approved_cost: 2_400_000 });
    expect(decide(t, { ...sched, cost: 2_000_000 }, ctx()).to).toBe('DIJADWALKAN');
    expect(decide(t, { ...sched, cost: 3_000_000 }, ctx()).to).toBe('MENUNGGU');
  });

  it('vendor wajib bernama', () => {
    expect(() => decide(ticket({ status: 'DITERIMA' }), { ...sched, exec: 'vendor', vendor: ' ', cost: 0 }, ctx())).toThrow(/vendor/i);
  });

  it('approve → DIJADWALKAN, deny → DITERIMA', () => {
    const t = ticket({ status: 'MENUNGGU', wait_reason: 'approval', approval_status: 'pending', cost_estimate: 2_400_000 });
    const a = decide(t, { type: 'approve' }, ctx());
    expect(a.to).toBe('DIJADWALKAN');
    expect(a.patch.approved_cost).toBe(2_400_000);
    expect(a.notify).toEqual(['approved', 'scheduled']);
    expect(decide(t, { type: 'deny' }, ctx()).to).toBe('DITERIMA');
  });

  it('resume hanya untuk tunda part', () => {
    expect(() => decide(ticket({ status: 'MENUNGGU', wait_reason: 'approval' }), { type: 'resume' }, ctx())).toThrow();
    expect(decide(ticket({ status: 'MENUNGGU', wait_reason: 'part' }), { type: 'resume' }, ctx()).to).toBe('DIKERJAKAN');
  });

  it('selesai wajib foto sesudah dan menyetel auto-close 3 hari kerja', () => {
    const t = ticket({ status: 'DIKERJAKAN' });
    expect(() => decide(t, { type: 'finish', note: 'ok', hasAfterPhoto: false }, ctx())).toThrow(/Foto/);
    const r = decide(t, { type: 'finish', note: 'Ganti karet', hasAfterPhoto: true }, ctx({ now: wib('2026-10-30T11:00:00') }));
    expect(r.to).toBe('SELESAI');
    expect(r.patch.auto_close_at).toBe(new Date(wib('2026-11-04T11:00:00')).toISOString());
  });

  it('konfirmasi pelapor → CLOSED, belum beres → DIKERJAKAN', () => {
    const t = ticket({ status: 'SELESAI', auto_close_at: new Date(wib('2026-11-02T10:00:00')).toISOString() });
    const c = decide(t, { type: 'confirm', rating: 5, feedback: 'Cepat' }, ctx());
    expect(c.to).toBe('CLOSED');
    expect(c.patch.rating).toBe(5);
    expect(() => decide(t, { type: 'confirm', rating: 6 }, ctx())).toThrow();
    const r = decide(t, { type: 'reopen', note: 'Masih bocor' }, ctx());
    expect(r.to).toBe('DIKERJAKAN');
    expect(r.patch.reopen_count).toBe(1);
  });

  it('auto-close hanya setelah jatuh tempo', () => {
    const t = ticket({ status: 'SELESAI', auto_close_at: new Date(wib('2026-11-02T10:00:00')).toISOString() });
    expect(() => decide(t, { type: 'autoClose' }, ctx())).toThrow(/Belum/);
    const r = decide(t, { type: 'autoClose' }, ctx({ now: wib('2026-11-02T10:00:01') }));
    expect(r.to).toBe('CLOSED');
    expect(r.patch.closed_auto).toBe(true);
  });

  it('tolak wajib beralasan', () => {
    expect(() => decide(ticket(), { type: 'reject', reason: 'no' }, ctx())).toThrow();
    expect(decide(ticket(), { type: 'reject', reason: 'Bukan fasilitas kantor' }, ctx()).to).toBe('DITOLAK');
  });
});

describe('hak akses', () => {
  const t = ticket({ status: 'BARU', team_id: 'oss' });
  it('admin tim hanya untuk tiket timnya', () => {
    expect(canPerform({ type: 'admin', admin: admin() }, 'accept', t)).toBe(true);
    expect(canPerform({ type: 'admin', admin: admin({ team_id: 'oasis' }) }, 'accept', t)).toBe(false);
    expect(canPerform({ type: 'admin', admin: admin() }, 'approve', t)).toBe(false);
  });
  it('approver hanya approve/deny', () => {
    expect(canPerform({ type: 'admin', admin: admin({ role: 'approver', team_id: null }) }, 'approve', t)).toBe(true);
    expect(canPerform({ type: 'admin', admin: admin({ role: 'approver', team_id: null }) }, 'accept', t)).toBe(false);
  });
  it('teknisi hanya tiket yang ditugaskan kepadanya', () => {
    const tech = admin({ id: 'tk', role: 'teknisi' });
    expect(canPerform({ type: 'admin', admin: tech }, 'start', ticket({ assignee_admin_id: 'tk' }))).toBe(true);
    expect(canPerform({ type: 'admin', admin: tech }, 'start', ticket({ assignee_admin_id: 'lain' }))).toBe(false);
  });
  it('super admin semua kecuali aksi pelapor dan sistem', () => {
    const sa = { type: 'admin' as const, admin: admin({ role: 'super_admin', team_id: null }) };
    expect(canPerform(sa, 'approve', t)).toBe(true);
    expect(canPerform(sa, 'accept', t)).toBe(true);
    expect(canPerform(sa, 'confirm', t)).toBe(false);
  });
  it('admin nonaktif tidak bisa apa pun', () => {
    expect(canPerform({ type: 'admin', admin: admin({ aktif: false }) }, 'accept', t)).toBe(false);
  });
  it('tombol MENUNGGU menyesuaikan alasan tunggu', () => {
    const sa = { type: 'admin' as const, admin: admin({ role: 'super_admin', team_id: null }) };
    expect(availableActions(sa, ticket({ status: 'MENUNGGU', wait_reason: 'approval' }))).toEqual(['approve', 'deny']);
    expect(availableActions(sa, ticket({ status: 'MENUNGGU', wait_reason: 'part' }))).toEqual(['resume']);
  });
});
