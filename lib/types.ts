export type Status = 'BARU' | 'DITERIMA' | 'DIJADWALKAN' | 'DIKERJAKAN' | 'MENUNGGU' | 'SELESAI' | 'CLOSED' | 'DITOLAK' | 'DUPLIKAT';
export type Role = 'super_admin' | 'admin' | 'teknisi' | 'approver';
export type Jenis = 'Kerusakan' | 'Permintaan' | 'Kebersihan' | 'Keamanan';

export interface Team { id: string; kode: string; nama: string; telegram_chat_id: string | null; email_extra: string[]; urutan: number }
export interface AreaType { id: string; kode: string; nama: string; urutan: number }
export interface Location { id: string; kode: string; nama: string; lantai: number; area_type_id: string; aktif: boolean; urutan: number }
export interface Category { id: string; kode: string; nama: string; team_id: string; sla_respon_jam: number | null; sla_selesai_jam: number | null; aktif: boolean; urutan: number }
export interface QuickIssue { id: string; area_type_id: string; category_id: string; label: string; urutan: number; aktif: boolean }
export interface Holiday { tanggal: string; nama: string }
export interface Settings {
  id: 1; approval_threshold: number; auto_close_days: number; work_days: number[]; work_start: number; work_end: number;
  ops_email: string; divisi: string[]; updated_at: string;
}
export interface Admin {
  id: string; user_id: string; email: string; nama: string; role: Role; team_id: string | null; aktif: boolean;
  must_change_password: boolean; telegram_user_id: number | null; link_code: string | null; created_at: string;
}

export interface Ticket {
  id: string; code: string; public_token: string;
  location_id: string; category_id: string; team_id: string; jenis: Jenis; issue: string | null; description: string | null;
  reporter_name: string; reporter_division: string | null; reporter_wa: string; reporter_email: string | null;
  device_id: string | null; ip_hash: string | null;
  status: Status; wait_reason: 'approval' | 'part' | null;
  assignee_admin_id: string | null; assignee_name: string | null; exec_type: 'internal' | 'vendor'; vendor_name: string | null;
  schedule_at: string | null; cost_estimate: number; cost_actual: number | null;
  approval_status: 'pending' | 'approved' | 'denied' | null; approved_cost: number | null; approved_by: string | null; approved_at: string | null;
  accepted_at: string | null; started_at: string | null; done_at: string | null; done_note: string | null;
  closed_at: string | null; closed_auto: boolean; rating: number | null; feedback: string | null; reject_reason: string | null;
  parent_ticket_id: string | null; me_too_count: number; reopen_count: number;
  sla_kind: 'respon' | 'selesai' | null; sla_due_at: string | null; escalated_at: string | null; auto_close_at: string | null;
  created_at: string; updated_at: string;
}

export interface TicketPhoto { id: string; ticket_id: string; fase: 'before' | 'after'; drive_file_id: string; mime: string; size_bytes: number | null; created_at: string }
export interface TicketEvent {
  id: string; ticket_id: string; at: string; actor_type: 'reporter' | 'admin' | 'system' | 'telegram'; actor_admin_id: string | null;
  actor_name: string; action: string; from_status: Status | null; to_status: Status | null; note: string | null;
}
export interface NotificationLog {
  id: string; ticket_id: string | null; kind: string; channel: 'email' | 'telegram'; target: string;
  status: 'sent' | 'failed' | 'skipped'; error: string | null; payload: unknown; created_at: string;
}

/** Data referensi yang dimuat sekali per request. */
export interface RefData {
  teams: Team[]; areaTypes: AreaType[]; locations: Location[]; categories: Category[]; quickIssues: QuickIssue[];
  holidays: Holiday[]; settings: Settings;
}

/** Tiket beserta relasi yang dibutuhkan tampilan dan notifikasi. */
export interface TicketView extends Ticket { location: Location; category: Category; team: Team; area: AreaType }
