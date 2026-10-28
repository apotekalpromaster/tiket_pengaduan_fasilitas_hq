import { describe, it, expect } from 'vitest';
import { build, esc, type BuildCtx } from '@/lib/notify/templates';
import { normalizeWa, reportSchema } from '@/lib/validation';
import type { TicketView } from '@/lib/types';

const base: BuildCtx = { baseUrl: 'https://tiket.apotekalpro.id', opsEmail: 'operation@apotekalpro.id', approverChats: ['111'], threshold: 1_000_000, autoCloseDays: 3, actorName: 'Budi' };

const view = (over: Partial<TicketView> = {}): TicketView => ({
  id: '00000000-0000-0000-0000-000000000001', code: 'TKT-2610-0001', public_token: 'TOKENabc123', location_id: 'l', category_id: 'c', team_id: 't',
  jenis: 'Kerusakan', issue: 'Kloset/urinoir mampet', description: 'Urinoir <ujung> mampet', reporter_name: 'Rina', reporter_division: 'Finance',
  reporter_wa: '081234567890', reporter_email: null, device_id: null, ip_hash: null, status: 'BARU', wait_reason: null, assignee_admin_id: null,
  assignee_name: null, exec_type: 'internal', vendor_name: null, schedule_at: null, cost_estimate: 0, cost_actual: null, approval_status: null,
  approved_cost: null, approved_by: null, approved_at: null, accepted_at: null, started_at: null, done_at: null, done_note: null, closed_at: null,
  closed_auto: false, rating: null, feedback: null, reject_reason: null, parent_ticket_id: null, me_too_count: 0, reopen_count: 0, sla_kind: null,
  sla_due_at: null, escalated_at: null, auto_close_at: null, created_at: '2026-10-28T01:00:00Z', updated_at: '',
  location: { id: 'l', kode: 'L1-TOILET-PRIA-URINOIR', nama: 'Toilet Pria (Urinoir)', lantai: 1, area_type_id: 'a', aktif: true, urutan: 1 },
  category: { id: 'c', kode: 'plumbing', nama: 'Plumbing & air', team_id: 't', sla_respon_jam: null, sla_selesai_jam: null, aktif: true, urutan: 1 },
  team: { id: 't', kode: 'oss', nama: 'OSS', telegram_chat_id: '-100123', email_extra: ['oss@apotekalpro.id'], urutan: 1 },
  area: { id: 'a', kode: 'toilet', nama: 'Toilet', urutan: 1 },
  ...over,
});

describe('template notifikasi', () => {
  it('laporan baru: email ke operation@ + email tim, Telegram ke grup dengan tombol Terima', () => {
    const b = build('new', view(), base);
    expect(b.emails).toHaveLength(1);
    expect(b.emails[0].to).toEqual(['operation@apotekalpro.id', 'oss@apotekalpro.id']);
    expect(b.emails[0].subject).toContain('TKT-2610-0001');
    expect(b.telegrams[0].chatId).toBe('-100123');
    expect(b.telegrams[0].buttons[0].map(x => x.data)).toEqual(['accept:00000000-0000-0000-0000-000000000001', 'take:00000000-0000-0000-0000-000000000001']);
  });

  it('teks pelapor di-escape untuk HTML Telegram dan email', () => {
    const b = build('new', view(), base);
    expect(b.telegrams[0].text).toContain('&lt;ujung&gt;');
    expect(b.emails[0].html).toContain('&lt;ujung&gt;');
    expect(b.emails[0].html).not.toContain('<ujung>');
    expect(esc(`"a" & 'b'`)).toBe('&quot;a&quot; &amp; &#39;b&#39;');
  });

  it('tanpa chat ID grup, tidak ada pesan Telegram ke grup', () => {
    const b = build('new', view({ team: { ...view().team, telegram_chat_id: null } }), base);
    expect(b.telegrams).toHaveLength(0);
    expect(b.emails).toHaveLength(1);
  });

  it('approval dikirim ke chat pribadi approver dengan tombol Setujui/Tolak', () => {
    const b = build('approval', view({ status: 'MENUNGGU', cost_estimate: 2_400_000, exec_type: 'vendor', vendor_name: 'PT Servis' }), base);
    const dm = b.telegrams.find(t => t.chatId === '111')!;
    expect(dm.buttons[0].map(x => x.text)).toEqual(['Setujui', 'Tolak']);
    expect(dm.text).toContain('Rp 2.400.000');
    expect(b.emails[0].to).toEqual(['operation@apotekalpro.id']);
  });

  it('email ke pelapor hanya bila pelapor mengisi email', () => {
    const at = '2026-10-29T03:00:00Z';
    expect(build('scheduled', view({ schedule_at: at, assignee_name: 'Darto' }), base).emails).toHaveLength(0);
    const b = build('scheduled', view({ schedule_at: at, assignee_name: 'Darto', reporter_email: 'rina@apotekalpro.id' }), base);
    expect(b.emails[0].to).toEqual(['rina@apotekalpro.id']);
    expect(b.emails[0].html).toContain('https://tiket.apotekalpro.id/t/TOKENabc123');
  });

  it('total pelapor serupa = me_too_count + 1', () => {
    expect(build('metoo', view({ me_too_count: 2 }), { ...base, meTooName: 'Maya' }).telegrams[0].text).toContain('Total 3 orang');
  });
});

describe('validasi form', () => {
  const ok = {
    locationId: '11111111-1111-4111-8111-111111111111', categoryId: '22222222-2222-4222-8222-222222222222', jenis: 'Kerusakan',
    issue: 'Galon habis', description: '', reporterName: 'Rina', reporterWa: '+62 812-3456-7890', reporterEmail: '',
  };
  it('normalisasi nomor WA', () => {
    expect(normalizeWa('+62 812-3456-7890')).toBe('081234567890');
    expect(normalizeWa('0812 3456 7890')).toBe('081234567890');
  });
  it('lolos dengan masalah umum tanpa deskripsi', () => {
    const r = reportSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reporterWa).toBe('081234567890');
  });
  it('tanpa masalah umum, deskripsi minimal 10 karakter', () => {
    const r = reportSchema.safeParse({ ...ok, issue: null, description: 'bocor' });
    expect(r.success).toBe(false);
  });
  it('menolak WA dan email yang salah', () => {
    expect(reportSchema.safeParse({ ...ok, reporterWa: '12345' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...ok, reporterEmail: 'bukan-email' }).success).toBe(false);
  });
  it('menolak jenis di luar daftar', () => {
    expect(reportSchema.safeParse({ ...ok, jenis: 'Darurat' }).success).toBe(false);
  });
});
