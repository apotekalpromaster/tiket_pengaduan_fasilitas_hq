/**
 * Menjalankan apps-script/Code.gs di node:vm dengan tiruan layanan Apps Script
 * (DriveApp, Utilities, ContentService, LockService, PropertiesService, Session).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const CODE = readFileSync(join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

type FakeFile = { id: string; name: string; mime: string; bytes: number[]; parents: FakeFolder[] };
type FakeFolder = { id: string; name: string; trashed: boolean; parent: FakeFolder | null; folders: FakeFolder[]; files: FakeFile[] };

function makeEnv(secret = 'rahasia-uji-yang-panjang-sekali-123') {
  let seq = 0;
  const nid = () => `id_${String(++seq).padStart(12, '0')}`;
  const myDrive: FakeFolder = { id: 'root_0000000001', name: 'My Drive', trashed: false, parent: null, folders: [], files: [] };
  const folders = new Map<string, FakeFolder>([[myDrive.id, myDrive]]);
  const files = new Map<string, FakeFile>();
  const props = new Map<string, string>();
  let lockCalls = 0;
  const iter = <T,>(xs: T[]) => { let i = 0; return { hasNext: () => i < xs.length, next: () => xs[i++] }; };
  const folderApi = (f: FakeFolder): unknown => ({
    getId: () => f.id, getUrl: () => `https://drive.google.com/drive/folders/${f.id}`, isTrashed: () => f.trashed,
    getFoldersByName: (n: string) => iter(f.folders.filter(x => x.name === n && !x.trashed).map(folderApi)),
    getParents: () => iter(f.parent ? [folderApi(f.parent)] : []),
    createFolder: (n: string) => { const c: FakeFolder = { id: nid(), name: n, trashed: false, parent: f, folders: [], files: [] }; f.folders.push(c); folders.set(c.id, c); return folderApi(c); },
    createFile: (blob: { bytes: number[]; mime: string; name: string }) => {
      const file: FakeFile = { id: nid(), name: blob.name, mime: blob.mime, bytes: blob.bytes, parents: [f] };
      f.files.push(file); files.set(file.id, file); return fileApi(file);
    },
  });
  const fileApi = (x: FakeFile) => ({
    getId: () => x.id, getMimeType: () => x.mime, getBlob: () => ({ getBytes: () => x.bytes }), getParents: () => iter(x.parents.map(folderApi)),
  });
  const ctx: Record<string, unknown> = {
    DriveApp: {
      getRootFolder: () => folderApi(myDrive),
      getFolderById: (id: string) => { const f = folders.get(id); if (!f) throw new Error('no folder'); return folderApi(f); },
      getFileById: (id: string) => { const f = files.get(id); if (!f) throw new Error('no file'); return fileApi(f); },
    },
    Utilities: {
      base64Decode: (s: string) => Array.from(Buffer.from(s, 'base64')),
      base64Encode: (b: number[]) => Buffer.from(b).toString('base64'),
      newBlob: (bytes: number[], mime: string, name: string) => ({ bytes, mime, name }),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ text: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { lockCalls++; }, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => props.set(k, v) }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'apotekalpro.master@gmail.com' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE.replace(/var SECRET = '[^']*';/, `var SECRET = '${secret}';`), ctx);
  const post = (body: Record<string, unknown>) =>
    JSON.parse(((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } })).text);
  return { post, ctx, myDrive, files, secret, lockCalls: () => lockCalls };
}

describe('apps-script/Code.gs', () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(() => { env = makeEnv(); });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

  it('menolak secret yang salah atau kosong', () => {
    expect(env.post({ action: 'ping', secret: 'salah' })).toEqual({ ok: false, error: 'AUTH' });
    expect(env.post({ action: 'ping' })).toEqual({ ok: false, error: 'AUTH' });
  });

  it('menolak bila SECRET masih nilai contoh', () => {
    const raw = makeEnvWithDefaultSecret();
    expect(raw.post({ action: 'ping', secret: 'GANTI-DENGAN-KATA-SANDI-ACAK-MINIMAL-32-KARAKTER' }).error).toBe('SECRET_BELUM_DIGANTI');
  });

  it('ping membuat folder root sekali dan melaporkan akun', () => {
    const a = env.post({ action: 'ping', secret: env.secret });
    const b = env.post({ action: 'ping', secret: env.secret });
    expect(a.ok).toBe(true);
    expect(a.account).toBe('apotekalpro.master@gmail.com');
    expect(a.folderUrl).toBe(b.folderUrl);
    expect(env.myDrive.folders.filter(f => f.name === 'Tiket Fasilitas HQ')).toHaveLength(1);
  });

  it('upload menyimpan ke folder bulan, folder bulan dibuat sekali', () => {
    const r1 = env.post({ action: 'upload', secret: env.secret, name: 'TKT-2611-0001-laporan-1.jpg', mime: 'image/jpeg', yymm: '2611', data: jpg });
    const r2 = env.post({ action: 'upload', secret: env.secret, name: 'TKT-2611-0002-laporan-1.jpg', mime: 'image/jpeg', yymm: '2611', data: jpg });
    expect(r1.ok && r2.ok).toBe(true);
    const root = env.myDrive.folders.find(f => f.name === 'Tiket Fasilitas HQ')!;
    expect(root.folders.map(f => f.name)).toEqual(['2611']);
    expect(root.folders[0].files).toHaveLength(2);
  });

  it('get mengembalikan isi file yang sama', () => {
    const { id } = env.post({ action: 'upload', secret: env.secret, name: 'a.jpg', mime: 'image/jpeg', yymm: '2611', data: jpg });
    const g = env.post({ action: 'get', secret: env.secret, id });
    expect(g).toEqual({ ok: true, mime: 'image/jpeg', data: jpg });
  });

  it('get menolak file di luar folder aplikasi', () => {
    env.post({ action: 'ping', secret: env.secret });
    const other = (env.ctx.DriveApp as { getRootFolder: () => { createFile: (b: unknown) => { getId: () => string } } })
      .getRootFolder().createFile({ bytes: [1, 2], mime: 'image/jpeg', name: 'pribadi.jpg' });
    expect(env.post({ action: 'get', secret: env.secret, id: other.getId() })).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('validasi upload: mime, bulan, ukuran', () => {
    expect(env.post({ action: 'upload', secret: env.secret, mime: 'application/pdf', yymm: '2611', data: jpg }).error).toBe('MIME');
    expect(env.post({ action: 'upload', secret: env.secret, mime: 'image/jpeg', yymm: '../x', data: jpg }).error).toBe('YYMM');
    expect(env.post({ action: 'upload', secret: env.secret, mime: 'image/jpeg', yymm: '2611', data: '' }).error).toBe('SIZE');
  });

  it('folder root yang terhapus dibuat ulang', () => {
    env.post({ action: 'ping', secret: env.secret });
    env.myDrive.folders[0].trashed = true;
    env.post({ action: 'upload', secret: env.secret, name: 'b.jpg', mime: 'image/jpeg', yymm: '2611', data: jpg });
    expect(env.myDrive.folders.filter(f => f.name === 'Tiket Fasilitas HQ' && !f.trashed)).toHaveLength(1);
  });

  it('doGet untuk cek lewat browser', () => {
    expect((env.ctx.doGet as () => { text: string })().text).toBe('Tiket Fasilitas HQ Drive aktif');
  });
});

function makeEnvWithDefaultSecret() {
  const ctx: Record<string, unknown> = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ text: t, setMimeType() { return this; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return { post: (body: Record<string, unknown>) => JSON.parse(((ctx.doPost as (e: unknown) => { text: string })({ postData: { contents: JSON.stringify(body) } })).text) };
}
