# Deploy ke Vercel (apotekalpromasters-projects)

## 1. Import project
1. Vercel → tim **apotekalpromasters-projects** → **Add New → Project** → import `apotekalpromaster/tiket_pengaduan_fasilitas_hq`.
2. Framework: Next.js (otomatis). Build command dan output dibiarkan default.
3. Production Branch: `main`. Branch `claude/charming-archimedes-vjhxs5` otomatis jadi **Preview** untuk UAT.
4. Isi Environment Variables (langkah 2) **sebelum** deploy pertama. Variabel `NEXT_PUBLIC_*` ditanam saat build, jadi setelah mengubahnya lakukan **Redeploy**.

> Paket Hobby hanya untuk pemakaian non-komersial dan cron-nya maksimal sekali sehari. Untuk aplikasi resmi kantor, gunakan **Pro**.

## 2. Environment Variables
Lihat `.env.example`. Ringkasnya:

| Variabel | Dari mana |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API. Service role **hanya** di Vercel, jangan dibagikan |
| `APP_BASE_URL` | Domain final, mis. `https://tiket.apotekalpro.id`. Dipakai di QR, jadi tetapkan sebelum mencetak stiker |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Langkah 3 |
| `SMTP_*`, `MAIL_FROM`, `MAIL_OPS_TO` | Langkah 4 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Langkah 5 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Add site (opsional, anti-spam) |
| `CRON_SECRET` | String acak ≥ 32 karakter. Vercel Cron mengirimkannya otomatis |

Integrasi yang env-nya kosong dilewati dengan aman: notifikasinya tercatat "Dilewati" di detail tiket. Statusnya bisa dilihat di **Master data → Pengaturan → Status integrasi**.

## 3. Google Drive (foto)
Service Account **tidak punya kuota "My Drive"**, jadi folder tujuan wajib berada di **Shared Drive**.
1. Google Cloud Console → project kantor → aktifkan **Google Drive API**.
2. IAM → Service Accounts → Create → buat key **JSON**.
3. Google Drive → Shared drives → buat/gunakan Shared Drive, mis. *Tiket Fasilitas HQ* → **Manage members** → tambahkan email Service Account sebagai **Content manager**.
4. Buka folder tujuan di Shared Drive itu; ID folder adalah bagian URL setelah `/folders/`.
5. Isi `GOOGLE_SERVICE_ACCOUNT_EMAIL` (`client_email`), `GOOGLE_PRIVATE_KEY` (`private_key`, tempel apa adanya termasuk `\n`), dan `GOOGLE_DRIVE_FOLDER_ID`.

Foto tersimpan di subfolder per bulan (`2610`, `2611`, ...). Semua foto privat dan hanya tampil lewat aplikasi.

## 4. Email (SMTP Google Workspace)
1. Siapkan akun pengirim, mis. `noreply@apotekalpro.id`, dengan 2-Step Verification aktif.
2. Akun Google → Security → **App passwords** → buat untuk "Mail".
3. `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=noreply@apotekalpro.id`, `SMTP_PASS=<app password>`.

Laporan baru, eskalasi, dan permintaan approval dikirim ke `operation@apotekalpro.id`, ditambah email tambahan per tim. Pelapor menerima email jadwal dan selesai bila mengisi email.

## 5. Telegram
1. Chat **@BotFather** → `/newbot` → simpan token ke `TELEGRAM_BOT_TOKEN`.
2. Buat string acak untuk `TELEGRAM_WEBHOOK_SECRET`, lalu Redeploy.
3. Daftarkan webhook sekali saja (ganti TOKEN, DOMAIN, SECRET):

```bash
curl "https://api.telegram.org/botTOKEN/setWebhook?url=https://DOMAIN/api/telegram/webhook&secret_token=SECRET&allowed_updates=%5B%22message%22,%22callback_query%22%5D"
```

4. Tambahkan bot ke grup tiap tim (OSS, OASIS, Housekeeping). Ketik `/id` di grup, lalu salin angkanya ke **Master data → Tim**.
5. Setiap admin membuka **Profil → Telegram → Buat kode**, lalu mengirim `/link KODE` ke bot lewat chat pribadi. Setelah itu tombol **Terima / Ambil tiket / Setujui** di Telegram berjalan atas nama admin tersebut. Ops Manager juga menerima permintaan approval lewat chat pribadi.

## 6. Cron
`vercel.json` menjadwalkan `/api/cron/daily` Senin–Jumat pukul 02.00 UTC (09.00 WIB): auto-close tiket Selesai yang lewat batas dan eskalasi SLA. Untuk eskalasi per jam (paket Pro), ubah `schedule` menjadi `0 2-9 * * 1-5`.

## 7. Domain
Vercel → Project → Settings → Domains → tambahkan `tiket.apotekalpro.id` → buat record CNAME di DNS sesuai petunjuk Vercel. Setelah aktif, samakan `APP_BASE_URL` lalu Redeploy.

## 8. Checklist UAT (di Preview)
- [ ] `/r/L2-PANTRY` dari HP Android dan iPhone: lokasi terkunci, chip Pantry muncul
- [ ] Kirim laporan dengan foto → kode tiket tampil, foto ada di Shared Drive, email masuk ke operation@, pesan Telegram masuk ke grup Housekeeping
- [ ] Laporan kedua Pantry + "Galon habis" → muncul "Sudah dilaporkan" → "Saya juga mengalami" menambah hitungan
- [ ] Tombol **Terima** di Telegram oleh admin yang sudah `/link` → status berubah di panel
- [ ] Jadwalkan dengan biaya Rp 2,5 jt → Ops Manager menerima permintaan approval → Setujui → Dijadwalkan, pelapor menerima email jadwal
- [ ] Mulai → Selesai dengan foto sesudah → pelapor konfirmasi + rating → Closed
- [ ] Pelapor menekan "Belum" → tiket kembali Dikerjakan dan tim diberi tahu
- [ ] Teknisi hanya melihat tiket yang ditugaskan kepadanya
- [ ] Unduh Excel dari Laporan, lalu cetak satu lembar stiker QR dan scan

## 9. Rilis produksi
Merge branch ke `main` (lewat PR) → Vercel deploy Production → cetak semua stiker dari **Stiker QR** → pilot Lantai 2 selama 1 minggu → tempel semua QR → sosialisasi.
