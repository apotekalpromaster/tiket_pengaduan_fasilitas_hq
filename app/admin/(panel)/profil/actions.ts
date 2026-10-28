'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { authClient } from '@/lib/supabase/server';
import { db } from '@/lib/supabase/admin';

export type PwState = { error?: string; ok?: string };

export async function changePassword(_: PwState, f: FormData): Promise<PwState> {
  const admin = await requireAdmin(undefined, { allowPasswordChange: true });
  const pw = String(f.get('password') ?? ''), pw2 = String(f.get('password2') ?? '');
  if (pw.length < 10) return { error: 'Password minimal 10 karakter.' };
  if (pw !== pw2) return { error: 'Konfirmasi password tidak sama.' };
  const sb = await authClient();
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { error: `Gagal mengganti password (${error.message}).` };
  const wasForced = admin.must_change_password;
  await db().from('admins').update({ must_change_password: false }).eq('id', admin.id);
  if (wasForced) redirect('/admin');
  return { ok: 'Password diganti.' };
}

export async function makeLinkCode() {
  const admin = await requireAdmin();
  const code = randomBytes(4).toString('hex').toUpperCase();
  await db().from('admins').update({ link_code: code }).eq('id', admin.id);
  revalidatePath('/admin/profil');
}

export async function unlinkTelegram() {
  const admin = await requireAdmin();
  await db().from('admins').update({ telegram_user_id: null, link_code: null }).eq('id', admin.id);
  revalidatePath('/admin/profil');
}
