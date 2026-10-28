import { db } from '@/lib/supabase/admin';
import { currentAdmin } from '@/lib/auth';
import { downloadPhoto } from '@/lib/drive';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';

/** Proxy foto Drive privat: admin login, atau publik dengan token tiket yang cocok. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const { data: p } = await db().from('ticket_photos').select('drive_file_id, mime, ticket_id').eq('id', id).maybeSingle();
    if (!p) return fail(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    const token = new URL(req.url).searchParams.get('t');
    let allowed = false;
    if (token) {
      const { data: t } = await db().from('tickets').select('id').eq('id', p.ticket_id).eq('public_token', token).maybeSingle();
      allowed = Boolean(t);
    }
    if (!allowed) allowed = Boolean(await currentAdmin());
    if (!allowed) return fail(403, 'FORBIDDEN', 'Tidak punya akses ke foto ini.');
    const r = await downloadPhoto(p.drive_file_id);
    if (!r.ok || !r.body) return fail(502, 'DRIVE', 'Foto tidak bisa diambil dari Google Drive.');
    return new Response(r.body, { headers: { 'Content-Type': p.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) {
    return handleError(e);
  }
}
