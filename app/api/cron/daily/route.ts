import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { dailySweep } from '@/lib/tickets';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Dipanggil Vercel Cron (header Authorization: Bearer CRON_SECRET). */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return fail(401, 'AUTH', 'Tidak diizinkan.');
  try {
    return NextResponse.json(await dailySweep());
  } catch (e) {
    return handleError(e);
  }
}
