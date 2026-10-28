import { NextResponse } from 'next/server';
import { createTicket, hashIp, rateLimited, type UploadFile } from '@/lib/tickets';
import { clientIp, fail, handleError, verifyTurnstile } from '@/lib/http';
import { fieldErrors, MAX_PHOTO_BYTES, MAX_PHOTOS, PHOTO_TYPES, reportSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return fail(400, 'FORM', 'Data laporan tidak terbaca.');
    let raw: unknown;
    try { raw = JSON.parse(String(form.get('data') ?? '{}')); } catch { return fail(400, 'FORM', 'Data laporan tidak terbaca.'); }
    const parsed = reportSchema.safeParse(raw);
    if (!parsed.success) return fail(422, 'VALIDASI', 'Periksa kembali isian form.', fieldErrors(parsed.error));
    const v = parsed.data;

    const ip = clientIp(req);
    if (!(await verifyTurnstile(v.turnstile, ip))) return fail(403, 'CAPTCHA', 'Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.');
    const ipHash = hashIp(ip);
    if (await rateLimited(v.deviceId ?? null, ipHash)) return fail(429, 'BATAS', 'Terlalu banyak laporan dalam 10 menit. Coba lagi nanti.');

    const files: UploadFile[] = [];
    for (const f of form.getAll('foto').slice(0, MAX_PHOTOS)) {
      if (!(f instanceof File) || f.size === 0) continue;
      if (!PHOTO_TYPES.includes(f.type)) return fail(422, 'FOTO', 'Format foto harus JPG, PNG, atau WEBP.');
      if (f.size > MAX_PHOTO_BYTES) return fail(422, 'FOTO', 'Ukuran foto terlalu besar. Maksimal 1 MB per foto setelah dikompres.');
      files.push({ data: Buffer.from(await f.arrayBuffer()), mime: f.type, size: f.size });
    }

    const t = await createTicket({
      locationId: v.locationId, categoryId: v.categoryId, jenis: v.jenis as never, issue: v.issue || null, description: v.description || null,
      reporterName: v.reporterName, reporterDivision: v.reporterDivision || null, reporterWa: v.reporterWa, reporterEmail: v.reporterEmail || null,
      deviceId: v.deviceId ?? null, ipHash,
    }, files);
    return NextResponse.json({ code: t.code, token: t.public_token }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
