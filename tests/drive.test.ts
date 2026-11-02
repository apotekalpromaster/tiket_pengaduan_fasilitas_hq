/**
 * Klien lib/drive.ts terhadap server lokal yang meniru Web App Apps Script:
 * POST /exec dibalas 302 ke /echo, lalu GET /echo mengembalikan JSON.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const SECRET = 'rahasia-uji-drive-0123456789abcdef';
const stored = new Map<string, { mime: string; data: string }>();
const pending = new Map<string, string>();
let seq = 0;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/macros/s/abc/exec') {
      // Seperti Apps Script: hasil disiapkan, klien diarahkan ke URL lain.
      const key = String(++seq);
      const r = JSON.parse(body);
      let out: unknown;
      if (r.secret !== SECRET) out = { ok: false, error: 'AUTH' };
      else if (r.action === 'upload') { const id = `file_${seq.toString().padStart(10, '0')}`; stored.set(id, { mime: r.mime, data: r.data }); out = { ok: true, id }; }
      else if (r.action === 'get') { const f = stored.get(r.id); out = f ? { ok: true, ...f } : { ok: false, error: 'NOT_FOUND' }; }
      else if (r.action === 'ping') out = { ok: true, folderUrl: 'https://drive.google.com/drive/folders/x', account: 'apotekalpro.master@gmail.com' };
      pending.set(key, JSON.stringify(out));
      res.writeHead(302, { Location: `/echo?k=${key}` });
      return res.end();
    }
    if (req.method === 'GET' && req.url?.startsWith('/echo')) {
      const k = new URL(req.url, 'http://x').searchParams.get('k')!;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(pending.get(k));
    }
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html>Page not found</html>');
  });
});

let base = '';
beforeAll(async () => {
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

async function load(url: string, secret = SECRET) {
  vi.resetModules();
  process.env.DRIVE_SCRIPT_URL = url;
  process.env.DRIVE_SCRIPT_SECRET = secret;
  return import('@/lib/drive');
}

describe('klien Drive (Apps Script)', () => {
  it('unggah lalu unduh foto mengikuti redirect 302', async () => {
    const d = await load(`${base}/macros/s/abc/exec`);
    const data = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4]);
    const id = await d.uploadPhoto({ name: 'TKT-2611-0001-laporan-1.jpg', mime: 'image/jpeg', data, yymm: '2611' });
    expect(id).toMatch(/^file_/);
    const r = await d.downloadPhoto(id);
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await r.arrayBuffer())).toEqual(data);
  });

  it('ping mengembalikan akun dan folder', async () => {
    const d = await load(`${base}/macros/s/abc/exec`);
    expect(await d.pingDrive()).toEqual({ folderUrl: 'https://drive.google.com/drive/folders/x', account: 'apotekalpro.master@gmail.com' });
  });

  it('secret salah memberi pesan yang jelas', async () => {
    const d = await load(`${base}/macros/s/abc/exec`, 'salah');
    await expect(d.pingDrive()).rejects.toThrow(/AUTH.*DRIVE_SCRIPT_SECRET/);
  });

  it('URL salah (balasan HTML) memberi petunjuk', async () => {
    const d = await load(`${base}/salah`);
    await expect(d.pingDrive()).rejects.toThrow(/bukan JSON.*\/exec/);
  });

  it('server tidak bisa dihubungi', async () => {
    const d = await load('http://127.0.0.1:1/macros/s/abc/exec');
    await expect(d.pingDrive()).rejects.toThrow(/tidak bisa dihubungi/);
  });

  it('id file tidak valid ditolak sebelum memanggil skrip', async () => {
    const d = await load(`${base}/macros/s/abc/exec`);
    await expect(d.downloadPhoto('../../etc')).rejects.toThrow(/tidak valid/);
  });
});
