# Tiket Fasilitas HQ — Apotek Alpro

Aplikasi pelaporan kerusakan dan kebutuhan fasilitas kantor pusat. Alurnya: karyawan scan QR di area → isi form → submit → email ke operation@apotekalpro.id dan Telegram ke tim → admin follow up/jadwalkan → tiket Closed.

## Isi repo

| Path | Isi |
|---|---|
| `docs/RENCANA_KERJA.md` | Rencana kerja: keputusan, data lokasi QR, model data, tahapan, biaya, verifikasi |
| `prototype/index.html` | Prototype klikable untuk visualisasi proses (data contoh, tanpa backend) |

## Menjalankan prototype

Buka `prototype/index.html` di browser (perlu internet untuk React, htm, qrcode-generator, dan Google Fonts dari CDN).

- Tombol di kartu alur menjalankan demo langkah demi langkah: scan QR → isi form → kirim → Terima dari Telegram → jadwal → dikerjakan → foto sesudah → konfirmasi pelapor → Closed.
- Coba manual: scan Pantry Lt 2 lalu pilih "Galon habis" untuk melihat deteksi duplikat ("Saya juga mengalami").
- Biaya di atas Rp 1 jt saat menjadwalkan memicu approval Ops Manager.
- Tab Stiker QR berisi QR asli untuk 24 titik; klik stiker untuk simulasi scan.

Tampilan mengikuti design system Aset Kantor Alpro (Plus Jakarta Sans, oranye `#f97316`, tema terang/gelap).

## Stack aplikasi final

Next.js (Vercel), Supabase kantor (schema `fasilitas`), foto di Google Drive (Shared Drive), email SMTP Google Workspace, Telegram Bot.
