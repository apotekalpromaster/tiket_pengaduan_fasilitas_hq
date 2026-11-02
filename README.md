# Tiket Fasilitas HQ — Apotek Alpro

Pelaporan kerusakan dan kebutuhan fasilitas kantor pusat. Karyawan memindai QR di area, mengisi form tanpa login, lalu email (ke operation@apotekalpro.id) dan Telegram terkirim ke tim penanganan (OSS, OASIS, Housekeeping). Admin menerima, menjadwalkan, meminta approval biaya bila perlu, lalu menyelesaikan dengan foto sesudah. Pelapor mengonfirmasi, dan tiket Closed.

## Stack
Next.js 15 (App Router) · Tailwind CSS v4 (token Aset Kantor Alpro) · Supabase kantor (schema `fasilitas`) · Google Drive via Apps Script · Gmail SMTP · Telegram Bot · Vercel.

## Struktur
| Path | Isi |
|---|---|
| `app/(public)` | Form QR `/r/[kode]`, status pelapor `/t/[token]`, `/saya` |
| `app/admin` | Panel admin: dashboard, tiket, jadwal, laporan, stiker QR, master data, profil |
| `app/api` | Laporan, duplikat, konfirmasi, foto (proxy Drive), webhook Telegram, cron, export Excel |
| `lib/flow.ts` | State machine tiket dan hak akses per peran |
| `lib/workhours.ts` | Jam kerja WIB, hari libur, SLA, auto-close |
| `lib/notify/` | Template dan pengiriman email/Telegram |
| `supabase/` | Migrasi SQL + `SETUP.md` |
| `apps-script/` | `Code.gs`: jembatan penyimpanan foto ke Google Drive |
| `docs/` | `RENCANA_KERJA.md`, `DEPLOY.md`, `PANDUAN_GOOGLE.md` |
| `prototype/` | Prototype klikable (data contoh) |

## Pengembangan lokal

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

## Pemeriksaan

```bash
npm run lint && npm run typecheck && npm test
```

```bash
npm run e2e
```

`npm test` menjalankan uji unit dan uji migrasi SQL di PGlite. `npm run e2e` mem-build aplikasi dengan Supabase tiruan (PGlite + migrasi asli), lalu menjalankan alur pelapor dan admin di Chromium. Tangkapan layarnya ada di `e2e/.output/`.

## Deploy
Lihat `supabase/SETUP.md` (database), `docs/PANDUAN_GOOGLE.md` (email Gmail dan foto Drive, klik demi klik), dan `docs/DEPLOY.md` (Vercel, Telegram, domain, checklist UAT).
