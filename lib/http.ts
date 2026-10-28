import 'server-only';
import { NextResponse } from 'next/server';
import { env, integrations } from './env';
import { FlowError } from './flow';

/** Galat API dalam format `KODE: pesan` (pola Aset Kantor). */
export const fail = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  NextResponse.json({ error: `${code}: ${message}`, fields }, { status });

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || '0.0.0.0';
}

/** Verifikasi Cloudflare Turnstile. Lolos bila belum dikonfigurasi. */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  if (!integrations.turnstile) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.turnstile.secret, response: token, remoteip: ip });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return Boolean(j.success);
}

export function handleError(e: unknown) {
  if (e instanceof FlowError) return fail(e.code === 'NOT_FOUND' ? 404 : e.code === 'FORBIDDEN' ? 403 : 409, e.code, e.message);
  console.error(e);
  return fail(500, 'SERVER', 'Terjadi kesalahan di server. Coba lagi beberapa saat.');
}
