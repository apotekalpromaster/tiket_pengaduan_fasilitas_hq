import { z } from 'zod';
import { JENIS } from './labels';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

/** Normalisasi nomor WA Indonesia: 08xx / +628xx / 628xx → 08xx. */
export function normalizeWa(s: string): string {
  const d = s.replace(/\D/g, '');
  if (d.startsWith('62')) return '0' + d.slice(2);
  return d;
}

export const reportSchema = z.object({
  locationId: uuid,
  categoryId: z.string({ required_error: 'Pilih kategori.' }).uuid('Pilih kategori.'),
  jenis: z.enum(JENIS as [string, ...string[]]),
  issue: text(80).nullable().optional(),
  description: text(1000).nullable().optional(),
  reporterName: text(80).min(2, 'Nama wajib diisi.'),
  reporterDivision: text(60).nullable().optional(),
  reporterWa: z.string().transform(normalizeWa).refine(v => /^08\d{8,12}$/.test(v), 'No WhatsApp tidak valid (contoh 0812xxxxxxx).'),
  reporterEmail: z.union([z.literal(''), z.string().trim().email('Format email tidak valid.').max(120)]).nullable().optional(),
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).nullable().optional(),
  turnstile: z.string().max(4000).nullable().optional(),
}).superRefine((v, ctx) => {
  if (!v.issue && (v.description ?? '').length < 10) {
    ctx.addIssue({ code: 'custom', path: ['description'], message: 'Tulis minimal 10 karakter atau pilih masalah umum.' });
  }
});
export type ReportInput = z.infer<typeof reportSchema>;

export const meTooSchema = z.object({
  name: text(80).min(2, 'Nama wajib diisi.'),
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).nullable().optional(),
  turnstile: z.string().max(4000).nullable().optional(),
});

export const confirmSchema = z.discriminatedUnion('result', [
  z.object({ result: z.literal('ok'), rating: z.coerce.number().int().min(1).max(5), feedback: text(500).optional() }),
  z.object({ result: z.literal('belum'), note: text(500).min(3, 'Jelaskan apa yang masih bermasalah.') }),
]);

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 1_400_000;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Pesan galat pertama per field dari ZodError. */
export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) { const k = String(i.path[0] ?? 'form'); if (!out[k]) out[k] = i.message; }
  return out;
}
