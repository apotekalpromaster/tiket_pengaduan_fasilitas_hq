import { NextResponse } from 'next/server';
import { findOpenDuplicate } from '@/lib/tickets';
import { handleError } from '@/lib/http';

const UUID = /^[0-9a-f-]{36}$/i;

/** Tiket terbuka di lokasi + kategori yang sama. Hanya data ringkas, tanpa identitas pelapor. */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const lokasi = u.searchParams.get('lokasi') ?? '', kategori = u.searchParams.get('kategori') ?? '';
    if (!UUID.test(lokasi) || !UUID.test(kategori)) return NextResponse.json({ ticket: null });
    const t = await findOpenDuplicate(lokasi, kategori);
    return NextResponse.json({ ticket: t ? { id: t.id, code: t.code, issue: t.issue, status: t.status, wait_reason: t.wait_reason, me_too_count: t.me_too_count, created_at: t.created_at } : null });
  } catch (e) {
    return handleError(e);
  }
}
