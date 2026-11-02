// Uji e2e lokal: build dengan Supabase tiruan, jalankan, uji alur pelapor di viewport HP.
// Jalankan: npm run e2e   (butuh Playwright + Chromium)
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const MOCK = 'http://127.0.0.1:54329', APP = 'http://localhost:3100', OUT = new URL('./.output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const env = {
  ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: MOCK, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test', SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  APP_BASE_URL: APP, CRON_SECRET: 'cron-test', DRIVE_SCRIPT_URL: `${MOCK}/macros/s/e2e/exec`, DRIVE_SCRIPT_SECRET: 'drive-e2e-secret',
};
const procs = [];
const start = (cmd, args) => { const p = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true }); procs.push(p); return p; };
const waitFor = async (url, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { try { await fetch(url); return; } catch { await new Promise(r => setTimeout(r, 400)); } } throw new Error('timeout ' + url); };
const sql = async (q, args = []) => (await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: q, args }) })).json();
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };

try {
  start('node', ['e2e/mock-supabase.mjs']);
  await waitFor(`${MOCK}/rest/v1/teams`);
  if (!process.argv.includes('--no-build')) execSync('npx next build', { env, stdio: 'inherit' });
  // Database tiruan selalu baru, jadi buang cache data dari run sebelumnya.
  rmSync(new URL('../.next/cache/fetch-cache', import.meta.url), { recursive: true, force: true });
  const app = start('npx', ['next', 'start', '-p', '3100']);
  app.stderr.on('data', d => process.stderr.write(d));
  await waitFor(`${APP}/r`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  const noHScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // 1. Form dari QR
  await page.goto(`${APP}/r/L2-PANTRY`);
  check('lokasi terkunci dari QR', await page.getByText('Lantai 2 · Pantry').isVisible());
  check('chip masalah umum Pantry', await page.getByRole('button', { name: 'Galon habis' }).isVisible());
  check('tanpa pilihan urgensi', (await page.getByText(/urgensi/i).count()) === 0 || (await page.getByText('Prioritas penanganan diatur').count()) === 1);
  check('tidak ada scroll horizontal (form)', await noHScroll());
  await page.screenshot({ path: OUT + '01-form.png', fullPage: true });

  // 2. Validasi
  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  check('validasi kategori', await page.getByText('Pilih kategori.').isVisible());
  check('validasi nama', await page.getByText('Nama wajib diisi.').isVisible());

  // 3. Kirim laporan
  await page.getByRole('button', { name: 'Galon habis' }).click();
  check('kategori otomatis dari chip', (await page.locator('#f-cat option:checked').textContent()) === 'Konsumabel');
  check('routing tim Housekeeping', await page.getByText('Diteruskan ke Tim Housekeeping').isVisible());
  await page.fill('#f-nama', 'Rina Kartika');
  await page.selectOption('#f-div', 'Finance');
  await page.fill('#f-wa', '0812-3456-7890');
  await page.fill('#f-desc', 'Galon dispenser habis, stok cadangan juga kosong.');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#f-photo', { name: 'galon.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('img', { name: 'Foto 1' }).waitFor({ timeout: 5000 });
  check('foto dipilih dan dikompres di browser', await page.getByText(/Dikompres otomatis · \d+ KB/).isVisible());
  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9_-]+\?baru=1/, { timeout: 20000 });
  check('halaman sukses', await page.getByRole('heading', { name: 'Laporan terkirim' }).isVisible());
  const code = (await page.locator('text=/TKT-\\d{4}-\\d{4}/').first().textContent())?.trim();
  check('kode tiket TKT-YYMM-0001', /^TKT-\d{4}-0001$/.test(code ?? ''), code);
  check('status Baru', await page.getByText('Baru', { exact: true }).first().isVisible());
  check('tidak ada scroll horizontal (status)', await noHScroll());
  await page.screenshot({ path: OUT + '02-status.png', fullPage: true });

  const [t] = await sql(`select * from fasilitas.tickets where code = $1`, [code]);
  check('tiket tersimpan dengan tim Housekeeping', Boolean(t) && (await sql(`select nama from fasilitas.teams where id = $1`, [t.team_id]))[0]?.nama === 'Housekeeping');
  check('nomor WA dinormalisasi', t?.reporter_wa === '081234567890', t?.reporter_wa);
  check('token publik bukan kode tiket', t && t.public_token !== t.code && t.public_token.length >= 12);
  await new Promise(r => setTimeout(r, 1500));
  const notes = await sql(`select channel, status, target from fasilitas.notifications where ticket_id = $1`, [t.id]);
  check('notifikasi email tercatat (dilewati, SMTP belum diatur)', notes.some(n => n.channel === 'email' && n.status === 'skipped' && n.target.includes('operation@apotekalpro.id')), JSON.stringify(notes));
  const ph = await sql(`select id, fase, mime, drive_file_id from fasilitas.ticket_photos where ticket_id = $1`, [t.id]);
  check('foto laporan tersimpan ke Drive (Apps Script)', ph.length === 1 && ph[0].fase === 'before' && ph[0].drive_file_id.startsWith('e2efile_'), JSON.stringify(ph));
  if (ph[0]) {
    const img = await fetch(`${APP}/api/foto/${ph[0].id}?t=${t.public_token}`);
    check('foto tampil lewat proxy dengan token pelapor', img.ok && img.headers.get('content-type') === 'image/jpeg' && (await img.arrayBuffer()).byteLength > 50, String(img.status));
    const noTok = await fetch(`${APP}/api/foto/${ph[0].id}`);
    check('foto tanpa token/login ditolak', noTok.status === 403, String(noTok.status));
    await page.reload();
    check('gambar termuat di halaman status', await page.locator('img[alt="Foto laporan"]').evaluate(el => el.complete && el.naturalWidth > 0));
  }
  const ev = await sql(`select action, to_status from fasilitas.ticket_events where ticket_id = $1`, [t.id]);
  check('riwayat dibuat', ev.some(e => e.action === 'create' && e.to_status === 'BARU'));

  // 4. Duplikat + saya juga mengalami
  await page.goto(`${APP}/r/L2-PANTRY`);
  check('identitas diingat', await page.getByText('Diingat dari laporan sebelumnya').isVisible());
  await page.getByRole('button', { name: 'Galon habis' }).click();
  await page.getByText('Sudah dilaporkan.').waitFor({ timeout: 5000 });
  check('deteksi duplikat', await page.getByText('Sudah dilaporkan.').isVisible());
  await page.screenshot({ path: OUT + '03-duplikat.png', fullPage: true });
  await page.getByRole('button', { name: 'Saya juga mengalami' }).click();
  await page.waitForURL(/dukung=1/, { timeout: 20000 });
  check('dukungan tercatat', await page.getByRole('heading', { name: 'Dukungan tercatat' }).isVisible());
  const [t2] = await sql(`select me_too_count from fasilitas.tickets where id = $1`, [t.id]);
  check('me_too_count bertambah', t2.me_too_count === 1, String(t2.me_too_count));

  // 5. Laporan saya
  await page.goto(`${APP}/saya`);
  await page.getByText(code).first().waitFor({ timeout: 5000 });
  check('laporan saya', await page.getByText(code).first().isVisible());

  // 6. Konfirmasi pelapor setelah selesai (status diatur langsung di DB)
  await sql(`update fasilitas.tickets set status = 'SELESAI', done_at = now(), done_note = 'Galon diganti', auto_close_at = now() + interval '3 days' where id = $1`, [t.id]);
  await page.goto(`${APP}/t/${t.public_token}`);
  await page.getByRole('button', { name: 'Sudah beres' }).click();
  await page.getByRole('button', { name: '4 bintang' }).click();
  await page.getByRole('button', { name: 'Kirim penilaian' }).click();
  await page.getByText('Tiket ditutup.').waitFor({ timeout: 10000 });
  const [t3] = await sql(`select status, rating from fasilitas.tickets where id = $1`, [t.id]);
  check('konfirmasi → Closed dengan rating 4', t3.status === 'CLOSED' && t3.rating === 4, JSON.stringify(t3));

  // 7. Keamanan dasar
  const bad = await fetch(`${APP}/t/${encodeURIComponent(code)}`);
  check('kode tiket tidak bisa dipakai sebagai link status', bad.status === 404, String(bad.status));
  await page.goto(`${APP}/admin`);
  check('admin tanpa login diarahkan ke login', page.url().includes('/admin/login'));
  check('halaman login', await page.getByRole('button', { name: 'Masuk' }).isVisible());
  await page.screenshot({ path: OUT + '04-login.png' });
  const cron = await fetch(`${APP}/api/cron/daily`);
  check('cron tanpa secret ditolak', cron.status === 401);
  const cronOk = await fetch(`${APP}/api/cron/daily`, { headers: { authorization: 'Bearer cron-test' } });
  check('cron dengan secret berjalan', cronOk.ok, JSON.stringify(await cronOk.json()));
  const tg = await fetch(`${APP}/api/telegram/webhook`, { method: 'POST', body: '{}' });
  check('webhook Telegram tanpa secret ditolak', tg.status === 401);
  const exp = await fetch(`${APP}/api/laporan/export`);
  check('export Excel butuh login', exp.status === 401);

  // 8. Desktop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/r/L1-TOILET-PRIA-URINOIR`);
  check('chip toilet', await page.getByRole('button', { name: 'Kloset/urinoir mampet' }).isVisible());
  await page.screenshot({ path: OUT + '05-desktop.png' });

  // 8b. Cookie sesi palsu (JWT tanpa tanda tangan sah) harus ditolak halaman admin
  {
    const fakeB64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const fakeExp = Math.floor(Date.now() / 1000) + 3600;
    const fake = [fakeB64({ alg: 'HS256', typ: 'JWT' }), fakeB64({ sub: '00000000-0000-0000-0000-000000000000', exp: fakeExp, role: 'authenticated' }), 'palsu'].join('.');
    const fakeSession = { access_token: fake, refresh_token: 'x', token_type: 'bearer', expires_in: 3600, expires_at: fakeExp, user: { id: '00000000-0000-0000-0000-000000000000' } };
    const c2 = await browser.newContext();
    await c2.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(fakeSession)).toString('base64url'), url: APP }]);
    const p2 = await c2.newPage();
    await p2.goto(`${APP}/admin/master/admin`);
    await p2.waitForURL(/\/admin\/login/, { timeout: 15000 }).catch(() => {});
    check('cookie sesi palsu ditolak (diarahkan ke login)', p2.url().includes('/admin/login'), p2.url().replace(APP, ''));
    check('data admin tidak bocor dengan sesi palsu', (await p2.getByText('hendri@e2e.test').count()) === 0);
    await c2.close();
  }

  // 9. Panel admin dengan sesi tiruan (super admin)
  const [u] = await sql(`insert into auth.users (email) values ('hendri@e2e.test') returning id`);
  await sql(`insert into fasilitas.admins (user_id, email, nama, role) values ($1, 'hendri@e2e.test', 'Hendri', 'super_admin')`, [u.id]);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokenExp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: u.id, email: 'hendri@e2e.test', aud: 'authenticated', role: 'authenticated', exp: tokenExp, iat: tokenExp - 3600, iss: `${MOCK}/auth/v1`, session_id: 'e2e' }), 'e2e'].join('.');
  const session = { access_token: accessToken, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: u.id, email: 'hendri@e2e.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };
  await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: APP }]);
  const visit = async (path, name, text) => {
    const r = await page.goto(`${APP}${path}`);
    // Halaman dialirkan bertahap (loading.tsx); tunggu isinya muncul.
    await page.getByText(text).first().waitFor({ timeout: 15000 }).catch(() => {});
    const ok = r.status() === 200 && (await page.getByText(text).first().isVisible());
    check(`admin: ${name}`, ok, `${r.status()} ${page.url().replace(APP, '')}`);
    check(`admin: ${name} tanpa scroll horizontal`, await noHScroll());
  };
  await visit('/admin', 'dashboard', 'Perlu tindakan');
  await page.screenshot({ path: OUT + '06-dashboard.png', fullPage: true });
  await visit('/admin/tiket', 'kanban', 'Kanban');
  await visit('/admin/tiket?group=semua&view=daftar', 'daftar tiket', code);

  // Alur admin penuh pada tiket baru
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/r/L1-TOILET-PRIA-URINOIR`);
  await page.getByRole('button', { name: 'Kloset/urinoir mampet' }).click();
  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  await page.waitForURL(/baru=1/, { timeout: 20000 });
  const [tk] = await sql(`select id, code from fasilitas.tickets where status = 'BARU' order by created_at desc limit 1`);
  await page.setViewportSize({ width: 1280, height: 900 });
  const step = async (label, expect, fill) => {
    await page.goto(`${APP}/admin/tiket/${tk.id}`, { waitUntil: 'networkidle' });
    if (fill) await fill();
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForTimeout(1500);
    const [r] = await sql(`select status, wait_reason, approval_status from fasilitas.tickets where id = $1`, [tk.id]);
    check(`aksi "${label}" → ${expect}`, r.status === expect, JSON.stringify(r));
  };
  await step('Terima', 'DITERIMA');
  await step('Ajukan approval', 'MENUNGGU', async () => {
    await page.getByRole('button', { name: 'Vendor' }).click();
    await page.fill('#s-vendor', 'CV Lancar Pipa');
    await page.fill('#s-cost', '2500000');
  });
  await page.screenshot({ path: OUT + '07-approval.png', fullPage: true });
  await step('Setujui', 'DIJADWALKAN');
  await step('Mulai dikerjakan', 'DIKERJAKAN');
  await step('Tandai selesai', 'SELESAI', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('#f-after', { name: 'sesudah.png', mimeType: 'image/png', buffer: png });
    await page.waitForTimeout(500);
    await page.fill('#f-note', 'Saluran urinoir dibersihkan');
  });
  const evs = await sql(`select action from fasilitas.ticket_events where ticket_id = $1 order by at`, [tk.id]);
  const after = await sql(`select fase from fasilitas.ticket_photos where ticket_id = $1 and fase = 'after'`, [tk.id]);
  check('foto sesudah tersimpan ke Drive', after.length === 1, String(after.length));
  check('audit trail lengkap', ['create', 'accept', 'schedule', 'approve', 'start', 'finish'].every(a => evs.some(e => e.action === a)), evs.map(e => e.action).join(','));
  await page.goto(`${APP}/admin/tiket/${tk.id}`);
  await page.getByText('Saluran urinoir dibersihkan').first().waitFor({ timeout: 15000 }).catch(() => {});
  check('detail menampilkan riwayat', await page.getByText('Saluran urinoir dibersihkan').first().isVisible());
  await page.screenshot({ path: OUT + '08-detail.png', fullPage: true });

  await visit('/admin/jadwal', 'jadwal', 'Jadwal perbaikan');
  await visit('/admin/laporan', 'laporan', 'Laporan bulanan');
  const xl = await page.request.get(`${APP}/api/laporan/export`);
  check('export Excel dengan login', xl.ok() && (xl.headers()['content-type'] ?? '').includes('spreadsheet'), String(xl.status()));
  await visit('/admin/qr?lantai=2', 'stiker QR', 'Ruang Yong Xin Kaizen');
  await page.screenshot({ path: OUT + '09-qr.png', fullPage: true });
  await visit('/admin/master/lokasi', 'master lokasi', 'Tambah lokasi');
  check('master lokasi memuat 24 baris', (await page.locator('input[name=kode][value^="L"]').count()) === 24);
  // Master data di-cache lintas request; perubahan harus langsung tampil.
  await page.goto(`${APP}/r`);
  check('lokasi baru belum ada sebelum ditambah', (await page.getByText('Ruang Uji Cache').count()) === 0);
  await page.goto(`${APP}/admin/master/lokasi`);
  await page.fill('input[placeholder="L2-PANTRY"]', 'L4-UJI-CACHE');
  await page.fill('input[placeholder="Nama lokasi"]', 'Ruang Uji Cache');
  await page.fill('input[placeholder="Lantai"]', '4');
  await page.locator('form').filter({ has: page.locator('input[placeholder="L2-PANTRY"]') }).locator('select').selectOption({ label: 'Ruang Meeting' });
  await page.getByRole('button', { name: 'Tambah', exact: true }).click();
  await page.waitForURL(/master\/lokasi\?(ok|e)=/, { timeout: 15000, waitUntil: 'commit' });
  check('tambah lokasi lewat panel', page.url().includes('ok='), decodeURIComponent(page.url().split('?')[1] ?? ''));
  await page.goto(`${APP}/r`);
  check('lokasi baru langsung tampil di /r (cache diperbarui)', await page.getByText('Ruang Uji Cache').isVisible());
  await page.goto(`${APP}/admin/master/lokasi`);
  await visit('/admin/master/masalah', 'master masalah umum', 'Tipe area');
  await visit('/admin/master/kategori', 'master kategori', 'SLA respon');
  await visit('/admin/master/tim', 'master tim', 'Tim OASIS');
  await visit('/admin/master/admin', 'master admin', 'hendri@e2e.test');
  await visit('/admin/master/libur', 'master libur', 'Daftar libur');
  await visit('/admin/master/pengaturan', 'pengaturan', 'Status integrasi');
  await page.getByRole('button', { name: 'Tes koneksi Google Drive' }).click();
  await page.getByText('Terhubung ke Drive akun apotekalpro.master@gmail.com').waitFor({ timeout: 10000 });
  check('tes koneksi Drive di Pengaturan', await page.getByText('Terhubung ke Drive akun apotekalpro.master@gmail.com').isVisible());
  check('peringatan format URL Apps Script', await page.getByText('Web app URL').first().isVisible());
  await visit('/admin/profil', 'profil', 'Ganti password');
  await page.setViewportSize({ width: 390, height: 844 });
  await visit('/admin/tiket', 'kanban di HP', 'Kanban');
  await page.screenshot({ path: OUT + '10-admin-hp.png' });

  // 10. Pengukuran kinerja: latensi Supabase disimulasikan (250 ms ≈ Vercel iad1 → Supabase Singapore)
  await page.setViewportSize({ width: 1280, height: 900 });
  const LAT = Number(process.env.PERF_LATENCY_MS ?? 250);
  const perf = { latencyMs: LAT };
  await fetch(`${MOCK}/__latency?ms=${LAT}`);
  for (const [name, path] of [['dashboard', '/admin'], ['tiket', '/admin/tiket'], ['detail', `/admin/tiket/${tk.id}`], ['master-lokasi', '/admin/master/lokasi']]) {
    await page.goto(`${APP}${path}`);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await fetch(`${MOCK}/__count?reset=1`);
      const t0 = Date.now();
      const r = await page.goto(`${APP}${path}`, { waitUntil: 'domcontentloaded' });
      runs.push({ ms: Date.now() - t0, supabaseCalls: (await (await fetch(`${MOCK}/__count`)).json()).count, status: r.status() });
    }
    perf[name] = runs.sort((a, b) => a.ms - b.ms)[1];
  }
  await fetch(`${MOCK}/__latency?ms=0`);
  writeFileSync(OUT + 'perf.json', JSON.stringify(perf, null, 2));
  console.log('PERF ' + JSON.stringify(perf));

  check('tanpa error JavaScript di browser', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) {
  console.error(e);
  failed++;
} finally {
  procs.forEach(p => { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* sudah berhenti */ } });
}
console.log(failed ? `\n${failed} pemeriksaan gagal` : '\nSemua pemeriksaan lolos');
process.exit(failed ? 1 : 0);
