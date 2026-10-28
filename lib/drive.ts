import 'server-only';
import { JWT } from 'google-auth-library';
import { env, integrations } from './env';

/**
 * Foto disimpan di Shared Drive kantor lewat Service Account.
 * Service Account tidak punya kuota "My Drive", jadi GOOGLE_DRIVE_FOLDER_ID
 * wajib folder di dalam Shared Drive dengan akun ini sebagai Content Manager.
 */
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id';
const COMMON = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

let jwt: JWT | null = null;
async function token(): Promise<string> {
  if (!jwt) jwt = new JWT({ email: env.google.email, key: env.google.key, scopes: ['https://www.googleapis.com/auth/drive'] });
  const t = await jwt.getAccessToken();
  if (!t.token) throw new Error('DRIVE: gagal mendapatkan token akses.');
  return t.token;
}

const folderCache = new Map<string, string>();

async function monthFolder(yymm: string): Promise<string> {
  const hit = folderCache.get(yymm);
  if (hit) return hit;
  const auth = { Authorization: `Bearer ${await token()}` };
  const q = encodeURIComponent(`name = '${yymm}' and '${env.google.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await fetch(`${API}/files?q=${q}&fields=files(id)&${COMMON}`, { headers: auth });
  if (!found.ok) throw new Error(`DRIVE: cari folder gagal (${found.status})`);
  const list = (await found.json()) as { files: { id: string }[] };
  let id = list.files[0]?.id;
  if (!id) {
    const made = await fetch(`${API}/files?supportsAllDrives=true&fields=id`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: yymm, mimeType: 'application/vnd.google-apps.folder', parents: [env.google.folderId] }),
    });
    if (!made.ok) throw new Error(`DRIVE: buat folder gagal (${made.status})`);
    id = ((await made.json()) as { id: string }).id;
  }
  folderCache.set(yymm, id);
  return id;
}

/** Unggah satu foto; kembalikan file id Drive. */
export async function uploadPhoto(opts: { name: string; mime: string; data: Buffer; yymm: string }): Promise<string> {
  if (!integrations.drive) throw new Error('DRIVE: belum dikonfigurasi.');
  const parent = await monthFolder(opts.yymm);
  const boundary = 'tiket' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: opts.name, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mime}\r\n\r\n`),
    opts.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`DRIVE: unggah gagal (${r.status} ${await r.text().catch(() => '')})`);
  return ((await r.json()) as { id: string }).id;
}

/** Ambil isi file untuk disajikan lewat proxy. */
export async function downloadPhoto(fileId: string): Promise<Response> {
  if (!integrations.drive) throw new Error('DRIVE: belum dikonfigurasi.');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new Error('DRIVE: id file tidak valid.');
  return fetch(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await token()}` } });
}
