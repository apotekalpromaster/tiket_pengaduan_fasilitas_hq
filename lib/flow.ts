/**
 * State machine tiket (murni, tanpa I/O). Semua perubahan status lewat `decide`,
 * dipakai bersama oleh panel admin, tombol Telegram, halaman pelapor, dan cron.
 */
import type { Admin, Status, Ticket } from './types';
import { STATUS_LABEL } from './labels';
import { addWorkDays, addWorkHours, type WorkConfig } from './workhours';
import { fmtDateTime, fmtRp } from './format';

export type Action =
  | { type: 'accept'; assigneeName?: string | null; assigneeAdminId?: string | null }
  | { type: 'reassign'; teamId: string; teamName: string }
  | { type: 'reject'; reason: string }
  | { type: 'duplicate'; parentId: string; parentCode: string }
  | { type: 'schedule'; at: string; exec: 'internal' | 'vendor'; assigneeName: string; assigneeAdminId?: string | null; vendor?: string | null; cost: number }
  | { type: 'approve' }
  | { type: 'deny'; note?: string }
  | { type: 'start' }
  | { type: 'hold'; note?: string }
  | { type: 'resume' }
  | { type: 'finish'; note: string; hasAfterPhoto: boolean; costActual?: number | null }
  | { type: 'confirm'; rating: number; feedback?: string }
  | { type: 'reopen'; note: string }
  | { type: 'autoClose' };

export type ActionType = Action['type'];

export type NotifyKind =
  | 'new' | 'accepted' | 'reassigned' | 'rejected' | 'scheduled' | 'approval' | 'approved' | 'denied'
  | 'done' | 'reopened' | 'closed' | 'closed_auto' | 'metoo' | 'escalation';

export type Actor =
  | { type: 'admin'; admin: Admin; via?: 'panel' | 'telegram' }
  | { type: 'reporter'; name: string }
  | { type: 'system' };

export interface Ctx {
  now: number;
  threshold: number;
  autoCloseDays: number;
  work: WorkConfig;
  /** Target SLA penyelesaian kategori tiket (jam kerja), null = nonaktif. */
  slaSelesaiJam: number | null;
}

export interface Decision {
  patch: Partial<Ticket>;
  to: Status | null;
  action: ActionType;
  note: string;
  notify: NotifyKind[];
}

export class FlowError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Aksi yang sah per status. */
export const ALLOWED: Record<Status, ActionType[]> = {
  BARU: ['accept', 'reassign', 'reject', 'duplicate'],
  DITERIMA: ['schedule', 'reassign', 'reject', 'duplicate'],
  DIJADWALKAN: ['start', 'schedule'],
  DIKERJAKAN: ['hold', 'finish'],
  MENUNGGU: ['approve', 'deny', 'resume'],
  SELESAI: ['confirm', 'reopen', 'autoClose'],
  CLOSED: [],
  DITOLAK: [],
  DUPLIKAT: [],
};

const TEAM_ACTIONS: ActionType[] = ['accept', 'reassign', 'reject', 'duplicate', 'schedule', 'start', 'hold', 'resume', 'finish'];
const TECH_ACTIONS: ActionType[] = ['start', 'hold', 'resume', 'finish'];
const APPROVAL_ACTIONS: ActionType[] = ['approve', 'deny'];
const REPORTER_ACTIONS: ActionType[] = ['confirm', 'reopen'];

/** Apakah aktor boleh menjalankan aksi ini pada tiket ini. */
export function canPerform(actor: Actor, action: ActionType, t: Pick<Ticket, 'team_id' | 'assignee_admin_id'>): boolean {
  if (actor.type === 'system') return action === 'autoClose';
  if (actor.type === 'reporter') return REPORTER_ACTIONS.includes(action);
  const a = actor.admin;
  if (!a.aktif) return false;
  if (a.role === 'super_admin') return action !== 'autoClose' && !REPORTER_ACTIONS.includes(action);
  if (a.role === 'approver') return APPROVAL_ACTIONS.includes(action);
  if (a.role === 'admin') return a.team_id === t.team_id && TEAM_ACTIONS.includes(action);
  if (a.role === 'teknisi') return t.assignee_admin_id === a.id && TECH_ACTIONS.includes(action);
  return false;
}

/** Aksi yang bisa dilakukan aktor sekarang (untuk menampilkan tombol). */
export function availableActions(actor: Actor, t: Ticket): ActionType[] {
  return ALLOWED[t.status].filter(a => {
    if (!canPerform(actor, a, t)) return false;
    if (t.status === 'MENUNGGU') {
      if (a === 'resume') return t.wait_reason === 'part';
      return t.wait_reason === 'approval';
    }
    return true;
  });
}

const iso = (ms: number) => new Date(ms).toISOString();

export function decide(t: Ticket, action: Action, ctx: Ctx): Decision {
  if (!ALLOWED[t.status].includes(action.type)) {
    throw new FlowError('STATUS', `Aksi tidak bisa dilakukan saat status ${STATUS_LABEL[t.status]}.`);
  }
  const now = ctx.now;
  const d = (patch: Partial<Ticket>, to: Status | null, note: string, notify: NotifyKind[] = []): Decision =>
    ({ patch: to ? { ...patch, status: to } : patch, to, action: action.type, note, notify });

  switch (action.type) {
    case 'accept': {
      const sla = ctx.slaSelesaiJam ? { sla_kind: 'selesai' as const, sla_due_at: iso(addWorkHours(now, ctx.slaSelesaiJam, ctx.work)), escalated_at: null } : { sla_kind: null, sla_due_at: null, escalated_at: null };
      const who = action.assigneeName?.trim() || null;
      return d({ accepted_at: iso(now), assignee_name: who, assignee_admin_id: action.assigneeAdminId ?? null, ...sla }, 'DITERIMA',
        who ? `Tiket diterima, pelaksana ${who}` : 'Tiket diterima', ['accepted']);
    }
    case 'reassign': {
      if (action.teamId === t.team_id) throw new FlowError('SAME_TEAM', 'Tiket sudah di tim ini.');
      return d({ team_id: action.teamId, assignee_admin_id: null, assignee_name: null }, null, `Dialihkan ke tim ${action.teamName}`, ['reassigned']);
    }
    case 'reject': {
      const reason = action.reason.trim();
      if (reason.length < 5) throw new FlowError('REASON', 'Alasan penolakan minimal 5 karakter.');
      return d({ reject_reason: reason, sla_due_at: null, closed_at: iso(now) }, 'DITOLAK', `Ditolak: ${reason}`, ['rejected']);
    }
    case 'duplicate': {
      if (action.parentId === t.id) throw new FlowError('PARENT', 'Tiket induk tidak boleh tiket ini sendiri.');
      return d({ parent_ticket_id: action.parentId, sla_due_at: null, closed_at: iso(now) }, 'DUPLIKAT', `Digabung ke ${action.parentCode}`);
    }
    case 'schedule': {
      const at = Date.parse(action.at);
      if (Number.isNaN(at)) throw new FlowError('DATE', 'Waktu jadwal tidak valid.');
      const cost = Math.round(action.cost);
      if (!(cost >= 0)) throw new FlowError('COST', 'Biaya tidak valid.');
      const vendor = action.exec === 'vendor' ? (action.vendor ?? '').trim() : '';
      if (action.exec === 'vendor' && !vendor) throw new FlowError('VENDOR', 'Nama vendor wajib diisi.');
      const who = action.exec === 'vendor' ? vendor : action.assigneeName.trim();
      if (!who) throw new FlowError('ASSIGNEE', 'Pelaksana wajib diisi.');
      const base: Partial<Ticket> = {
        schedule_at: iso(at), exec_type: action.exec, vendor_name: vendor || null, assignee_name: who,
        assignee_admin_id: action.exec === 'internal' ? action.assigneeAdminId ?? null : null, cost_estimate: cost,
      };
      const alreadyApproved = t.approval_status === 'approved' && (t.approved_cost ?? 0) >= cost;
      if (cost > ctx.threshold && !alreadyApproved) {
        return d({ ...base, wait_reason: 'approval', approval_status: 'pending' }, 'MENUNGGU',
          `Estimasi ${fmtRp(cost)} diajukan untuk persetujuan`, ['approval']);
      }
      return d({ ...base, wait_reason: null }, 'DIJADWALKAN',
        `Dijadwalkan ${fmtDateTime(at)}, ${action.exec === 'vendor' ? 'vendor ' + vendor : 'pelaksana ' + who}`, ['scheduled']);
    }
    case 'approve': {
      if (t.wait_reason !== 'approval' || t.approval_status !== 'pending') throw new FlowError('APPROVAL', 'Tidak ada biaya yang menunggu persetujuan.');
      return d({ approval_status: 'approved', approved_cost: t.cost_estimate, approved_at: iso(now), wait_reason: null }, 'DIJADWALKAN',
        `Biaya ${fmtRp(t.cost_estimate)} disetujui`, ['approved', 'scheduled']);
    }
    case 'deny': {
      if (t.wait_reason !== 'approval' || t.approval_status !== 'pending') throw new FlowError('APPROVAL', 'Tidak ada biaya yang menunggu persetujuan.');
      const note = action.note?.trim();
      return d({ approval_status: 'denied', wait_reason: null }, 'DITERIMA',
        `Biaya ${fmtRp(t.cost_estimate)} ditolak${note ? ': ' + note : ''}`, ['denied']);
    }
    case 'start':
      return d({ started_at: t.started_at ?? iso(now) }, 'DIKERJAKAN', `Mulai dikerjakan${t.assignee_name ? ' oleh ' + t.assignee_name : ''}`);
    case 'hold':
      return d({ wait_reason: 'part' }, 'MENUNGGU', `Ditunda, menunggu part/vendor${action.note?.trim() ? ': ' + action.note.trim() : ''}`);
    case 'resume':
      if (t.wait_reason !== 'part') throw new FlowError('RESUME', 'Tiket ini menunggu approval, bukan part.');
      return d({ wait_reason: null }, 'DIKERJAKAN', 'Pekerjaan dilanjutkan');
    case 'finish': {
      if (!action.hasAfterPhoto) throw new FlowError('PHOTO', 'Foto sesudah wajib diunggah sebelum menandai selesai.');
      const note = action.note.trim() || 'Pekerjaan selesai';
      return d({
        done_at: iso(now), done_note: note, cost_actual: action.costActual ?? t.cost_estimate ?? null, sla_due_at: null,
        auto_close_at: iso(addWorkDays(now, ctx.autoCloseDays, ctx.work)),
      }, 'SELESAI', `Selesai: ${note}`, ['done']);
    }
    case 'confirm': {
      const r = Math.round(action.rating);
      if (r < 1 || r > 5) throw new FlowError('RATING', 'Penilaian harus 1 sampai 5.');
      return d({ rating: r, feedback: action.feedback?.trim() || null, closed_at: iso(now), auto_close_at: null }, 'CLOSED',
        `Pelapor konfirmasi sudah beres, rating ${r}/5`, ['closed']);
    }
    case 'reopen': {
      const note = action.note.trim();
      if (note.length < 3) throw new FlowError('NOTE', 'Jelaskan apa yang masih bermasalah.');
      return d({ auto_close_at: null, done_at: null, reopen_count: t.reopen_count + 1 }, 'DIKERJAKAN', `Pelapor: belum beres. ${note}`, ['reopened']);
    }
    case 'autoClose': {
      if (!t.auto_close_at || Date.parse(t.auto_close_at) > now) throw new FlowError('NOT_DUE', 'Belum waktunya ditutup otomatis.');
      return d({ closed_at: iso(now), closed_auto: true, auto_close_at: null }, 'CLOSED', `Tanpa respons pelapor ${ctx.autoCloseDays} hari kerja, ditutup otomatis`, ['closed_auto']);
    }
  }
}
