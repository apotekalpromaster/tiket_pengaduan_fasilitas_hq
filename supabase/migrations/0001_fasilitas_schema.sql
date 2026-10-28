-- Tiket Fasilitas HQ Apotek Alpro — schema `fasilitas`
-- Jalankan sekali di Supabase SQL Editor, lalu 0002_seed.sql.
-- Semua akses aplikasi lewat server (service_role). anon/authenticated tidak diberi akses.

create schema if not exists fasilitas;

-- ---------- Master data ----------
create table fasilitas.teams (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama text not null,
  telegram_chat_id text,
  email_extra text[] not null default '{}',
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

create table fasilitas.area_types (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama text not null,
  urutan int not null default 0
);

create table fasilitas.locations (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (kode ~ '^[A-Z0-9-]{3,40}$'),
  nama text not null,
  lantai int not null check (lantai between -5 and 50),
  area_type_id uuid not null references fasilitas.area_types(id),
  aktif boolean not null default true,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

create table fasilitas.categories (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama text not null,
  team_id uuid not null references fasilitas.teams(id),
  sla_respon_jam numeric(6,2) check (sla_respon_jam > 0),
  sla_selesai_jam numeric(6,2) check (sla_selesai_jam > 0),
  aktif boolean not null default true,
  urutan int not null default 0
);

create table fasilitas.quick_issues (
  id uuid primary key default gen_random_uuid(),
  area_type_id uuid not null references fasilitas.area_types(id) on delete cascade,
  category_id uuid not null references fasilitas.categories(id) on delete cascade,
  label text not null,
  urutan int not null default 0,
  aktif boolean not null default true
);

create table fasilitas.holidays (
  tanggal date primary key,
  nama text not null
);

create table fasilitas.settings (
  id int primary key default 1 check (id = 1),
  approval_threshold bigint not null default 1000000 check (approval_threshold >= 0),
  auto_close_days int not null default 3 check (auto_close_days between 1 and 30),
  work_days int[] not null default '{1,2,3,4,5}',
  work_start smallint not null default 9 check (work_start between 0 and 23),
  work_end smallint not null default 16 check (work_end between 1 and 24),
  ops_email text not null default 'operation@apotekalpro.id',
  divisi text[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (work_end > work_start)
);

-- ---------- Admin ----------
create table fasilitas.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nama text not null,
  role text not null check (role in ('super_admin','admin','teknisi','approver')),
  team_id uuid references fasilitas.teams(id),
  aktif boolean not null default true,
  must_change_password boolean not null default false,
  telegram_user_id bigint unique,
  link_code text unique,
  created_at timestamptz not null default now()
);

-- ---------- Tiket ----------
create table fasilitas.ticket_counters (
  yymm text primary key,
  last int not null
);

create table fasilitas.tickets (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  public_token text not null unique,
  location_id uuid not null references fasilitas.locations(id),
  category_id uuid not null references fasilitas.categories(id),
  team_id uuid not null references fasilitas.teams(id),
  jenis text not null check (jenis in ('Kerusakan','Permintaan','Kebersihan','Keamanan')),
  issue text,
  description text,
  reporter_name text not null,
  reporter_division text,
  reporter_wa text not null,
  reporter_email text,
  device_id text,
  ip_hash text,
  status text not null default 'BARU'
    check (status in ('BARU','DITERIMA','DIJADWALKAN','DIKERJAKAN','MENUNGGU','SELESAI','CLOSED','DITOLAK','DUPLIKAT')),
  wait_reason text check (wait_reason in ('approval','part')),
  assignee_admin_id uuid references fasilitas.admins(id) on delete set null,
  assignee_name text,
  exec_type text not null default 'internal' check (exec_type in ('internal','vendor')),
  vendor_name text,
  schedule_at timestamptz,
  cost_estimate bigint not null default 0 check (cost_estimate >= 0),
  cost_actual bigint check (cost_actual >= 0),
  approval_status text check (approval_status in ('pending','approved','denied')),
  approved_cost bigint,
  approved_by uuid references fasilitas.admins(id) on delete set null,
  approved_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  done_at timestamptz,
  done_note text,
  closed_at timestamptz,
  closed_auto boolean not null default false,
  rating smallint check (rating between 1 and 5),
  feedback text,
  reject_reason text,
  parent_ticket_id uuid references fasilitas.tickets(id),
  me_too_count int not null default 0,
  reopen_count int not null default 0,
  sla_kind text check (sla_kind in ('respon','selesai')),
  sla_due_at timestamptz,
  escalated_at timestamptz,
  auto_close_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on fasilitas.tickets (status);
create index tickets_team_status_idx on fasilitas.tickets (team_id, status);
create index tickets_location_category_idx on fasilitas.tickets (location_id, category_id);
create index tickets_created_idx on fasilitas.tickets (created_at desc);
create index tickets_device_idx on fasilitas.tickets (device_id, created_at);
create index tickets_ip_idx on fasilitas.tickets (ip_hash, created_at);
create index tickets_schedule_idx on fasilitas.tickets (schedule_at) where schedule_at is not null;

create table fasilitas.ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references fasilitas.tickets(id) on delete cascade,
  fase text not null check (fase in ('before','after')),
  drive_file_id text not null,
  mime text not null default 'image/jpeg',
  size_bytes int,
  created_at timestamptz not null default now()
);
create index ticket_photos_ticket_idx on fasilitas.ticket_photos (ticket_id);

create table fasilitas.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references fasilitas.tickets(id) on delete cascade,
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('reporter','admin','system','telegram')),
  actor_admin_id uuid references fasilitas.admins(id) on delete set null,
  actor_name text not null,
  action text not null,
  from_status text,
  to_status text,
  note text
);
create index ticket_events_ticket_idx on fasilitas.ticket_events (ticket_id, at);

create table fasilitas.notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references fasilitas.tickets(id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('email','telegram')),
  target text not null,
  status text not null check (status in ('sent','failed','skipped')),
  error text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index notifications_ticket_idx on fasilitas.notifications (ticket_id, created_at desc);

-- ---------- Fungsi ----------
-- Kode tiket TKT-YYMM-NNNN, nomor urut per bulan (WIB), atomik.
create or replace function fasilitas.next_ticket_code() returns text
language plpgsql as $$
declare
  v_yymm text := to_char(now() at time zone 'Asia/Jakarta', 'YYMM');
  v_last int;
begin
  insert into fasilitas.ticket_counters as c (yymm, last) values (v_yymm, 1)
  on conflict (yymm) do update set last = c.last + 1
  returning last into v_last;
  return 'TKT-' || v_yymm || '-' || lpad(v_last::text, 4, '0');
end $$;

create or replace function fasilitas.tickets_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.code is null then
    new.code := fasilitas.next_ticket_code();
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger tickets_before_write before insert or update on fasilitas.tickets
for each row execute function fasilitas.tickets_before_write();

-- "Saya juga mengalami": tambah hitungan secara atomik, kembalikan total baru.
create or replace function fasilitas.add_me_too(p_ticket uuid, p_by int default 1) returns int
language sql as $$
  update fasilitas.tickets set me_too_count = me_too_count + p_by where id = p_ticket
  returning me_too_count;
$$;

-- ---------- Hak akses ----------
alter table fasilitas.teams enable row level security;
alter table fasilitas.area_types enable row level security;
alter table fasilitas.locations enable row level security;
alter table fasilitas.categories enable row level security;
alter table fasilitas.quick_issues enable row level security;
alter table fasilitas.holidays enable row level security;
alter table fasilitas.settings enable row level security;
alter table fasilitas.admins enable row level security;
alter table fasilitas.ticket_counters enable row level security;
alter table fasilitas.tickets enable row level security;
alter table fasilitas.ticket_photos enable row level security;
alter table fasilitas.ticket_events enable row level security;
alter table fasilitas.notifications enable row level security;

revoke all on schema fasilitas from public;
revoke execute on all functions in schema fasilitas from public;
grant usage on schema fasilitas to service_role;
grant all on all tables in schema fasilitas to service_role;
grant all on all sequences in schema fasilitas to service_role;
grant execute on all functions in schema fasilitas to service_role;
alter default privileges in schema fasilitas grant all on tables to service_role;
alter default privileges in schema fasilitas grant all on sequences to service_role;
alter default privileges in schema fasilitas grant execute on functions to service_role;
