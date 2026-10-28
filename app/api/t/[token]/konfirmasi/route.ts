import { NextResponse } from 'next/server';
import { getTicketByToken } from '@/lib/data';
import { runAction } from '@/lib/tickets';
import { fail, handleError } from '@/lib/http';
import { confirmSchema, fieldErrors } from '@/lib/validation';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await getTicketByToken(token);
    if (!t) return fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.');
    const parsed = confirmSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(422, 'VALIDASI', 'Periksa kembali isian.', fieldErrors(parsed.error));
    const v = parsed.data;
    const actor = { type: 'reporter' as const, name: t.reporter_name };
    const r = v.result === 'ok'
      ? await runAction(t.id, { type: 'confirm', rating: v.rating, feedback: v.feedback }, actor)
      : await runAction(t.id, { type: 'reopen', note: v.note }, actor);
    return NextResponse.json({ status: r.to });
  } catch (e) {
    return handleError(e);
  }
}
