import { NextResponse } from 'next/server';
import { addMeToo, hashIp, rateLimited } from '@/lib/tickets';
import { clientIp, fail, handleError, verifyTurnstile } from '@/lib/http';
import { fieldErrors, meTooSchema } from '@/lib/validation';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.');
    const parsed = meTooSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(422, 'VALIDASI', 'Periksa kembali isian.', fieldErrors(parsed.error));
    const ip = clientIp(req);
    if (!(await verifyTurnstile(parsed.data.turnstile, ip))) return fail(403, 'CAPTCHA', 'Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.');
    if (await rateLimited(parsed.data.deviceId ?? null, hashIp(ip))) return fail(429, 'BATAS', 'Terlalu banyak laporan dalam 10 menit. Coba lagi nanti.');
    const t = await addMeToo(id, parsed.data.name);
    return NextResponse.json({ code: t.code, token: t.public_token });
  } catch (e) {
    return handleError(e);
  }
}
