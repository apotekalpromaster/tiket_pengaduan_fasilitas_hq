import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/admin';
import { getRefData } from '@/lib/data';
import { handleError } from '@/lib/http';

/** Status ringkas untuk daftar "Laporan saya" (maks 30 token). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tokens?: unknown };
    const tokens = (Array.isArray(body.tokens) ? body.tokens : []).filter((t): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(t)).slice(0, 30);
    if (!tokens.length) return NextResponse.json({ tickets: [] });
    const { data } = await db().from('tickets').select('public_token, code, issue, status, wait_reason, location_id, category_id, created_at').in('public_token', tokens);
    const ref = await getRefData();
    return NextResponse.json({
      tickets: (data ?? []).map(t => {
        const l = ref.locations.find(x => x.id === t.location_id);
        return { ...t, location: l ? `Lt ${l.lantai} · ${l.nama}` : '', category: ref.categories.find(c => c.id === t.category_id)?.nama ?? '' };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
