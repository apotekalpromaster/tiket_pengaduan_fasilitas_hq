import 'server-only';
import { env, integrations } from './env';

/**
 * Foto disimpan di Google Drive akun Gmail kantor lewat Google Apps Script
 * (apps-script/Code.gs, di-deploy sebagai Web App). Akun Gmail gratis tidak
 * punya Shared Drive, dan Service Account tidak punya kuota penyimpanan,
 * jadi penyimpanan harus berjalan atas nama akun itu sendiri.
 */
const TIMEOUT_MS = 25_000;

const ERRORS: Record<string, string> = {
  AUTH: 'DRIVE_SCRIPT_SECRET tidak sama dengan SECRET di Apps Script.',
  SECRET_BELUM_DIGANTI: 'SECRET di Apps Script belum diganti dari nilai contoh.',
  MIME: 'format foto tidak didukung.',
  SIZE: 'ukuran foto tidak valid.',
  NOT_FOUND: 'file tidak ditemukan di Drive.',
  FORBIDDEN: 'file berada di luar folder Tiket Fasilitas HQ.',
};

type Reply = { ok: boolean; error?: string; message?: string; [k: string]: unknown };

async function call(body: Record<string, unknown>): Promise<Reply> {
  if (!integrations.drive) throw new Error('DRIVE: belum dikonfigurasi (DRIVE_SCRIPT_URL dan DRIVE_SCRIPT_SECRET).');
  let r: Response;
  try {
    // Apps Script membalas 302 ke googleusercontent.com; fetch mengikutinya dengan GET.
    r = await fetch(env.drive.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ ...body, secret: env.drive.secret }), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`DRIVE: Apps Script tidak bisa dihubungi (${(e as Error).message}).`);
  }
  const text = await r.text();
  let j: Reply;
  try { j = JSON.parse(text) as Reply; } catch {
    // Halaman HTML = URL salah, akses bukan "Anyone", atau skrip belum di-authorize.
    throw new Error(`DRIVE: balasan Apps Script bukan JSON (HTTP ${r.status}). Periksa URL /exec dan akses "Anyone".`);
  }
  if (!j.ok) throw new Error(`DRIVE: ${j.error ?? 'GAGAL'} ${ERRORS[j.error ?? ''] ?? j.message ?? ''}`.trim());
  return j;
}

/** Unggah satu foto; kembalikan file id Drive. */
export async function uploadPhoto(opts: { name: string; mime: string; data: Buffer; yymm: string }): Promise<string> {
  const j = await call({ action: 'upload', name: opts.name, mime: opts.mime, yymm: opts.yymm, data: opts.data.toString('base64') });
  if (typeof j.id !== 'string') throw new Error('DRIVE: balasan unggah tanpa id.');
  return j.id;
}

/** Ambil isi file untuk disajikan lewat proxy /api/foto. */
export async function downloadPhoto(fileId: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new Error('DRIVE: id file tidak valid.');
  const j = await call({ action: 'get', id: fileId });
  const bytes = Buffer.from(String(j.data ?? ''), 'base64');
  return new Response(bytes, { headers: { 'Content-Type': String(j.mime ?? 'image/jpeg') } });
}

/** Tes koneksi dari halaman Pengaturan. */
export async function pingDrive(): Promise<{ folderUrl: string; account: string }> {
  const j = await call({ action: 'ping' });
  return { folderUrl: String(j.folderUrl ?? ''), account: String(j.account ?? '') };
}
