import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { authClient } from './supabase/server';
import { db } from './supabase/admin';
import type { Admin, Role } from './types';

/**
 * ID user dari sesi cookie, diverifikasi sekali per request.
 * getClaims() memverifikasi JWT secara lokal bila project memakai signing key
 * asimetris; bila tidak, ia memanggil server Auth (sama aman dengan getUser()).
 */
export const sessionUserId = cache(async (): Promise<string | null> => {
  const sb = await authClient();
  const { data, error } = await sb.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});

/** Admin yang sedang login, atau null. Di-cache per request. */
export const currentAdmin = cache(async (): Promise<Admin | null> => {
  const userId = await sessionUserId();
  if (!userId) return null;
  const { data } = await db().from('admins').select('*').eq('user_id', userId).maybeSingle();
  return (data as Admin | null) ?? null;
});

/**
 * Wajib login sebagai admin aktif. `roles` membatasi peran yang boleh.
 * Admin yang masih memakai password sementara diarahkan ke Profil.
 * Layout dan halaman sama-sama memanggil ini; verifikasi sesi dan query admin
 * hanya terjadi sekali per request karena keduanya di-cache.
 */
export async function requireAdmin(roles?: Role[], opts: { allowPasswordChange?: boolean } = {}): Promise<Admin> {
  if (!(await sessionUserId())) redirect('/admin/login');
  const admin = await currentAdmin();
  if (!admin || !admin.aktif) redirect('/admin/login?e=akses');
  if (admin.must_change_password && !opts.allowPasswordChange) redirect('/admin/profil?wajib=1');
  if (roles && !roles.includes(admin.role)) redirect('/admin?e=peran');
  return admin;
}

export const isManager = (a: Admin) => a.role === 'super_admin';
export const canManageMaster = (a: Admin) => a.role === 'super_admin' || a.role === 'admin';
