'use server';
import { redirect } from 'next/navigation';
import { authClient } from '@/lib/supabase/server';
import { db } from '@/lib/supabase/admin';

export type LoginState = { error?: string; email?: string };

export async function signIn(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('ke') ?? '');
  if (!email || !password) return { error: 'Isi email dan password.', email };
  const sb = await authClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'Email atau password salah.', email };
  const { data: admin } = await db().from('admins').select('aktif').eq('user_id', data.user.id).maybeSingle();
  if (!admin || !admin.aktif) {
    await sb.auth.signOut();
    return { error: 'Akun ini belum terdaftar sebagai admin Tiket Fasilitas. Hubungi Ops Manager.', email };
  }
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function signOut() {
  const sb = await authClient();
  await sb.auth.signOut();
  redirect('/admin/login');
}
