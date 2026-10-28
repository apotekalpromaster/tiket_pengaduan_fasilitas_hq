'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import type { Role } from '@/lib/types';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const n = (f: FormData, k: string) => { const v = s(f, k); return v === '' ? null : Number(v); };
const on = (f: FormData, k: string) => f.get(k) === 'on' || f.get(k) === 'true';

function done(path: string, err?: string | null, ok?: string): never {
  revalidatePath('/', 'layout');
  redirect(`${path}?${err ? 'e=' + encodeURIComponent(err) : 'ok=' + encodeURIComponent(ok ?? 'Tersimpan')}`);
}
/** Pesan berisi password sementara: lewat cookie singkat, bukan URL (agar tidak tersimpan di riwayat browser). */
async function doneSecret(message: string): Promise<never> {
  (await cookies()).set('flash', message, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 120, path: '/admin/master/admin' });
  revalidatePath('/admin/master/admin');
  redirect('/admin/master/admin?ok=1');
}
const dbErr = (e: { message: string; code?: string } | null) =>
  !e ? null : e.code === '23505' ? 'Kode sudah dipakai.' : e.code === '23503' ? 'Data masih dipakai tiket, nonaktifkan saja.' : `Gagal menyimpan (${e.message}).`;

// ---------- Lokasi ----------
export async function saveLocation(f: FormData) {
  await requireAdmin(['super_admin', 'admin']);
  const id = s(f, 'id');
  const row = { kode: s(f, 'kode').toUpperCase().replace(/\s+/g, '-'), nama: s(f, 'nama'), lantai: n(f, 'lantai'), area_type_id: s(f, 'area_type_id'), aktif: on(f, 'aktif'), urutan: n(f, 'urutan') ?? 0 };
  if (!/^[A-Z0-9-]{3,40}$/.test(row.kode)) done('/admin/master/lokasi', 'Kode hanya huruf besar, angka, dan tanda minus (3–40 karakter).');
  if (!row.nama || row.lantai === null || !row.area_type_id) done('/admin/master/lokasi', 'Lengkapi nama, lantai, dan tipe area.');
  const { error } = id ? await db().from('locations').update(row).eq('id', id) : await db().from('locations').insert({ ...row, aktif: true });
  done('/admin/master/lokasi', dbErr(error), id ? 'Lokasi diperbarui' : 'Lokasi ditambahkan');
}

// ---------- Tipe area & masalah umum ----------
export async function saveAreaType(f: FormData) {
  await requireAdmin(['super_admin', 'admin']);
  const id = s(f, 'id');
  const row = { kode: s(f, 'kode').toLowerCase().replace(/[^a-z0-9-]/g, ''), nama: s(f, 'nama'), urutan: n(f, 'urutan') ?? 0 };
  if (!row.kode || !row.nama) done('/admin/master/masalah', 'Lengkapi kode dan nama tipe area.');
  const { error } = id ? await db().from('area_types').update(row).eq('id', id) : await db().from('area_types').insert(row);
  done('/admin/master/masalah', dbErr(error), 'Tipe area tersimpan');
}
export async function saveQuickIssue(f: FormData) {
  await requireAdmin(['super_admin', 'admin']);
  const id = s(f, 'id');
  const row = { area_type_id: s(f, 'area_type_id'), category_id: s(f, 'category_id'), label: s(f, 'label'), urutan: n(f, 'urutan') ?? 0, aktif: id ? on(f, 'aktif') : true };
  if (!row.label || !row.category_id || !row.area_type_id) done('/admin/master/masalah', 'Lengkapi label dan kategori.');
  const { error } = id ? await db().from('quick_issues').update(row).eq('id', id) : await db().from('quick_issues').insert(row);
  done('/admin/master/masalah', dbErr(error), 'Masalah umum tersimpan');
}
export async function deleteQuickIssue(f: FormData) {
  await requireAdmin(['super_admin', 'admin']);
  const { error } = await db().from('quick_issues').delete().eq('id', s(f, 'id'));
  done('/admin/master/masalah', dbErr(error), 'Masalah umum dihapus');
}

// ---------- Kategori ----------
export async function saveCategory(f: FormData) {
  await requireAdmin(['super_admin']);
  const id = s(f, 'id');
  const row = { kode: s(f, 'kode').toLowerCase().replace(/[^a-z0-9-]/g, ''), nama: s(f, 'nama'), team_id: s(f, 'team_id'), sla_respon_jam: n(f, 'sla_respon_jam'), sla_selesai_jam: n(f, 'sla_selesai_jam'), aktif: id ? on(f, 'aktif') : true, urutan: n(f, 'urutan') ?? 0 };
  if (!row.kode || !row.nama || !row.team_id) done('/admin/master/kategori', 'Lengkapi kode, nama, dan tim.');
  if ((row.sla_respon_jam !== null && !(row.sla_respon_jam > 0)) || (row.sla_selesai_jam !== null && !(row.sla_selesai_jam > 0))) done('/admin/master/kategori', 'Target SLA harus lebih dari 0 jam, atau kosongkan.');
  const { error } = id ? await db().from('categories').update(row).eq('id', id) : await db().from('categories').insert(row);
  done('/admin/master/kategori', dbErr(error), 'Kategori tersimpan');
}

// ---------- Tim ----------
export async function saveTeam(f: FormData) {
  await requireAdmin(['super_admin']);
  const id = s(f, 'id');
  const emails = s(f, 'email_extra').split(/[\s,;]+/).filter(Boolean);
  if (emails.some(e => !/^\S+@\S+\.\S+$/.test(e))) done('/admin/master/tim', 'Ada email yang formatnya salah.');
  const chat = s(f, 'telegram_chat_id');
  if (chat && !/^-?\d{5,20}$/.test(chat)) done('/admin/master/tim', 'Chat ID Telegram berupa angka (grup diawali tanda minus). Kirim /id di grup untuk melihatnya.');
  const row = { kode: s(f, 'kode').toLowerCase().replace(/[^a-z0-9-]/g, ''), nama: s(f, 'nama'), telegram_chat_id: chat || null, email_extra: emails, urutan: n(f, 'urutan') ?? 0 };
  if (!row.kode || !row.nama) done('/admin/master/tim', 'Lengkapi kode dan nama tim.');
  const { error } = id ? await db().from('teams').update(row).eq('id', id) : await db().from('teams').insert(row);
  done('/admin/master/tim', dbErr(error), 'Tim tersimpan');
}

// ---------- Libur ----------
export async function saveHoliday(f: FormData) {
  await requireAdmin(['super_admin']);
  const tanggal = s(f, 'tanggal'), nama = s(f, 'nama');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !nama) done('/admin/master/libur', 'Isi tanggal dan nama libur.');
  const { error } = await db().from('holidays').upsert({ tanggal, nama });
  done('/admin/master/libur', dbErr(error), 'Libur tersimpan');
}
export async function deleteHoliday(f: FormData) {
  await requireAdmin(['super_admin']);
  const { error } = await db().from('holidays').delete().eq('tanggal', s(f, 'tanggal'));
  done('/admin/master/libur', dbErr(error), 'Libur dihapus');
}

// ---------- Pengaturan ----------
export async function saveSettings(f: FormData) {
  await requireAdmin(['super_admin']);
  const days = f.getAll('work_days').map(Number).filter(d => d >= 0 && d <= 6);
  const row = {
    id: 1, approval_threshold: n(f, 'approval_threshold') ?? 1_000_000, auto_close_days: n(f, 'auto_close_days') ?? 3,
    work_days: days.length ? days : [1, 2, 3, 4, 5], work_start: n(f, 'work_start') ?? 9, work_end: n(f, 'work_end') ?? 16,
    ops_email: s(f, 'ops_email'), divisi: s(f, 'divisi').split('\n').map(x => x.trim()).filter(Boolean), updated_at: new Date().toISOString(),
  };
  if (!/^\S+@\S+\.\S+$/.test(row.ops_email)) done('/admin/master/pengaturan', 'Email operasional tidak valid.');
  if (row.work_end <= row.work_start) done('/admin/master/pengaturan', 'Jam selesai harus setelah jam mulai.');
  const { error } = await db().from('settings').upsert(row);
  done('/admin/master/pengaturan', dbErr(error), 'Pengaturan tersimpan');
}

// ---------- Akun admin ----------
const ROLES: Role[] = ['super_admin', 'admin', 'teknisi', 'approver'];
const tempPassword = () => randomBytes(9).toString('base64url');

export async function createAdmin(f: FormData) {
  await requireAdmin(['super_admin']);
  const email = s(f, 'email').toLowerCase(), nama = s(f, 'nama'), role = s(f, 'role') as Role, team = s(f, 'team_id') || null;
  if (!/^\S+@\S+\.\S+$/.test(email) || !nama || !ROLES.includes(role)) done('/admin/master/admin', 'Lengkapi email, nama, dan peran.');
  if ((role === 'admin' || role === 'teknisi') && !team) done('/admin/master/admin', 'Admin tim dan teknisi wajib punya tim.');
  const password = tempPassword();
  const created = await db().auth.admin.createUser({ email, password, email_confirm: true });
  let userId = created.data.user?.id;
  if (created.error) {
    // Akun mungkin sudah ada (mis. dipakai aplikasi aset/seragam di Supabase yang sama).
    const { data: list } = await db().auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find(u => u.email?.toLowerCase() === email)?.id;
    if (!userId) done('/admin/master/admin', `Gagal membuat akun (${created.error.message}).`);
    const { error } = await db().from('admins').insert({ user_id: userId, email, nama, role, team_id: team, must_change_password: false });
    done('/admin/master/admin', dbErr(error), `${nama} ditambahkan memakai akun Supabase yang sudah ada. Password tetap yang lama.`);
  }
  const { error } = await db().from('admins').insert({ user_id: userId, email, nama, role, team_id: team, must_change_password: true });
  if (error) { await db().auth.admin.deleteUser(userId!); done('/admin/master/admin', dbErr(error)); }
  await doneSecret(`${nama} ditambahkan. Password sementara: ${password} (wajib diganti saat login pertama). Sampaikan langsung ke yang bersangkutan.`);
}

export async function updateAdmin(f: FormData) {
  const me = await requireAdmin(['super_admin']);
  const id = s(f, 'id'), role = s(f, 'role') as Role, team = s(f, 'team_id') || null, aktif = on(f, 'aktif');
  if (!ROLES.includes(role)) done('/admin/master/admin', 'Peran tidak valid.');
  if (id === me.id && (role !== 'super_admin' || !aktif)) done('/admin/master/admin', 'Anda tidak bisa menurunkan peran atau menonaktifkan akun sendiri.');
  const { error } = await db().from('admins').update({ nama: s(f, 'nama'), role, team_id: team, aktif }).eq('id', id);
  done('/admin/master/admin', dbErr(error), 'Akun diperbarui');
}

export async function resetPassword(f: FormData) {
  await requireAdmin(['super_admin']);
  const { data: a } = await db().from('admins').select('user_id, nama').eq('id', s(f, 'id')).maybeSingle();
  if (!a) done('/admin/master/admin', 'Akun tidak ditemukan.');
  const password = tempPassword();
  const { error } = await db().auth.admin.updateUserById(a.user_id, { password });
  if (error) done('/admin/master/admin', `Gagal mengatur ulang (${error.message}).`);
  await db().from('admins').update({ must_change_password: true }).eq('user_id', a.user_id);
  await doneSecret(`Password ${a.nama} diatur ulang. Password sementara: ${password}`);
}
