import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { authClient } from './supabase/server';
import { db } from './supabase/admin';
import type { Admin, Role } from './types';

/** Admin yang sedang login, atau null. Di-cache per request. */
export const currentAdmin = cache(async (): Promise<Admin | null> => {
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await db().from('admins').select('*').eq('user_id', user.id).maybeSingle();
  return (data as Admin | null) ?? null;
});

/**
 * Wajib login sebagai admin aktif. `roles` membatasi peran yang boleh.
 * Admin yang masih memakai password sementara diarahkan ke Profil.
 */
export async function requireAdmin(roles?: Role[], opts: { allowPasswordChange?: boolean } = {}): Promise<Admin> {
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/admin/login');
  const admin = await currentAdmin();
  if (!admin || !admin.aktif) redirect('/admin/login?e=akses');
  if (admin.must_change_password && !opts.allowPasswordChange) redirect('/admin/profil?wajib=1');
  if (roles && !roles.includes(admin.role)) redirect('/admin?e=peran');
  return admin;
}

export const isManager = (a: Admin) => a.role === 'super_admin';
export const canManageMaster = (a: Admin) => a.role === 'super_admin' || a.role === 'admin';
