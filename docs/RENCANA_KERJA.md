# Rencana Kerja — Aplikasi Tiket Fasilitas HQ Apotek Alpro

## Context
Karyawan kantor pusat (HQ) belum punya kanal resmi untuk melapor kerusakan/kebutuhan fasilitas. Laporan tercecer di chat sehingga tidak terlacak dan tidak ada data untuk evaluasi biaya/vendor.
Target alur: **Scan QR → Form → Submit → Notif Email + Telegram → Admin FU/jadwalkan → Closed**, lengkap dengan histori & laporan.

Repo: `apotekalpromaster/tiket_pengaduan_fasilitas_hq` (masih kosong), branch `claude/charming-archimedes-vjhxs5`.

## Keputusan yang sudah dikunci
| Aspek | Pilihan |
|---|---|
| Frontend/Backend | Next.js (App Router, TypeScript, **Tailwind v4**), deploy Vercel |
| Database | Supabase kantor `https://wjbyrbbqumqpbqhkdpus.supabase.co`, hanya untuk record |
| Foto | Google Drive perusahaan (upload lewat server) |
| Identitas pelapor | Tanpa login; Nama, Divisi, No WA diingat di browser |
| Notifikasi | Email ke **operation@apotekalpro.id** + Telegram Bot (grup menyusul); WA ditunda |
| Penanganan | Routing per kategori → tim (OSS / OASIS / Housekeeping), admin bisa assign ulang |
| Approver biaya | Ops Manager (Hendri) |
| Jam kerja | Senin–Jumat 09.00–16.00 |
| Urgensi | **Tidak dipilih oleh pelapor.** Target SLA per kategori diatur admin, nilainya *menunggu konfirmasi* |
| Desain | Design system **Aset Kantor Alpro** (artifact `PknXojpsHtasJaPFPXCzfL`) |

## Koreksi teknis penting
1. **Google Drive:** Service Account **tidak punya kuota** di "My Drive", jadi upload akan gagal. Wajib pakai **Shared Drive** (Service Account sebagai *Content Manager*). Struktur: `Tiket Fasilitas HQ/{YYYY-MM}/{kode_tiket}/`.
2. **Supabase bersama:** pakai schema terpisah `fasilitas` + RLS. Schema ini **harus ditambahkan ke "Exposed schemas"** (Settings → API) supaya `supabase-js` (`db: { schema: 'fasilitas' }`) bisa mengaksesnya. Service role key hanya disimpan di env Vercel, tidak pernah di-commit.
3. **Email:** Supabase tidak mengirim email bebas. Pakai SMTP Google Workspace (Nodemailer + App Password akun pengirim, mis. `noreply@apotekalpro.id`).
4. **Ejaan:** "Musalah" → **"Musala"** (baku KBBI) di label QR & master data.

## Desain — ikut Aset Kantor Alpro (aplikasi sejenis: Room Booking HQ, Short ED, Lapor Sales)
| Elemen | Ketentuan |
|---|---|
| Font | Plus Jakarta Sans 400–800 (Google Fonts), cadangan Inter |
| Warna merek | Satu oranye: `brand-500 #f97316` untuk tombol primer/fokus, `brand-600 #ea580c` untuk hover, `brand-text #c2410c` untuk teks |
| Netral | `page #f8fafc`, `surface #fff`, `line #e2e8f0`, `ink #0f172a`, `muted #64748b`, + varian tema gelap |
| Status chip | Pasangan `*-50` / `*-200` / `*-text`: merah, kuning, hijau, biru, violet |
| Bentuk | Kartu `radius-2xl` (16px), tombol/input `radius-xl` (12px), chip `radius-full`, `shadow-card` tipis, tanpa gradien |
| Ikon | lucide-react, **tanpa emoji** |
| Logo | `logo-alpro.png` (badge bulat 128px) selalu di atas latar putih |
| Layout | Sidebar desktop (≥1024px, bisa diringkas jadi rel 76px), drawer di HP; tabel berubah jadi kartu di layar sempit |
| Tema | Terang/Gelap mengikuti sistem (kunci localStorage `tiket-tema`); cetak QR selalu `paper`/`paper-ink` |
| Copy | Bahasa Indonesia, singkat, tombol kata kerja ("Kirim laporan", "Terima", "Jadwalkan"); galat format `KODE: pesan` |

Implementasi: salin `tokens.json` → `app/globals.css` (`@theme` Tailwind v4 + CSS variables tema gelap), lalu buat `components/ui.tsx` dengan pola yang sama: `Button`, `Field`, `Input`, `Select`, `Textarea`, `Card`, `Chip`, `Callout`, `Tabs`, `InfoTip`, `EmptyState`, `Skeleton`, `ErrorBlock`, plus `lib/labels.ts` dan `lib/format.ts` (Rupiah dan tanggal Indonesia). Logo diunduh dari asset artifact ke `public/logo-alpro.png`.

Pemetaan warna status tiket: Baru = biru · Diterima = violet · Dijadwalkan/Dikerjakan = brand · Menunggu = kuning · Selesai/Closed = hijau · Ditolak = merah.

## Titik QR (seed awal, 24 titik)
| Lantai | Lokasi | Tipe area |
|---|---|---|
| 1 | Ruang Genuine, Ruang Welcoming, Ruang Involved | Ruang Meeting |
| 1 | Ruang CCO, Ruang CSO | Ruang Direksi |
| 1 | Toilet Pria (Urinoir), Toilet Campur | Toilet |
| 1 | Area Kerja | Area Kerja |
| 2 | Ruang Accountable, Ruang Considerate, Ruang Yong Xin Kaizen | Ruang Meeting |
| 2 | Ruang COO | Ruang Direksi |
| 2 | Pantry | Pantry |
| 2 | Area Kerja | Area Kerja |
| 2 | Toilet Campur | Toilet |
| 3 | Ruang CEO, Ruang CRO | Ruang Direksi |
| 3 | Area Kerja | Area Kerja |
| 3 | Toilet Wanita, Toilet Pria | Toilet |
| 4 | Ruang Training | Ruang Training |
| 4 | Musala | Musala |
| 4 | Toilet Wanita | Toilet |
| 4 | Tempat Wudhu | Tempat Wudhu |

Kode QR mengikuti pola `L{lantai}-{SLUG}`, mis. `L1-TOILET-PRIA-URINOIR`, `L2-PANTRY`, `L4-MUSALA`. Titik baru bisa ditambah dari panel admin tanpa coding.

> Catatan: Area Kerja satu QR per lantai. Area kerja yang luas bisa dipecah per zona (mis. "Area Kerja Sisi Timur"); pelapor juga bisa menambahkan detail meja di kolom deskripsi.

## Form general tapi *location-aware*
- **Setiap QR = 1 lokasi** → `/r/{kode}`. Lokasi terisi otomatis dan dikunci. Ada opsi "Lokasi lain" (dropdown lantai + lokasi) untuk pelapor yang melapor dari meja.
- **Isi form:** Jenis (Kerusakan · Permintaan/Kebutuhan · Kebersihan · Keamanan) → Kategori → chip masalah umum → Deskripsi → Foto (maks 3, dikompres ≤1 MB) → Identitas (tersimpan otomatis). **Tidak ada pilihan urgensi.**
- **Chip masalah umum per tipe area** (dari master data):
  - Toilet: Air mati · Kloset/urinoir mampet · Sabun/tisu habis · Bau · Lampu mati · Keran bocor
  - Pantry: Dispenser · Kulkas · Galon habis · Wastafel · Peralatan makan
  - Area Kerja: AC · Lampu · Stop kontak · Kursi/meja · WiFi/jaringan
  - Ruang Meeting/Training/Direksi: AC · Proyektor/TV · Kursi/meja · Lampu · WiFi
  - Musala/Tempat Wudhu: Air · Karpet/sajadah · Lampu · Kebersihan
- **Deteksi duplikat:** jika masih ada tiket terbuka di lokasi + kategori yang sama, tampilkan "Sudah dilaporkan (TKT-…) — status: Dijadwalkan" + tombol **"Saya juga mengalami"** (menambah hitungan, tidak membuat tiket baru).

## Routing kategori → tim
| Kategori | Tim |
|---|---|
| Listrik, AC, Plumbing/Air, Bangunan, Furnitur | OSS |
| IT/Jaringan, Proyektor/TV | OASIS |
| Kebersihan, Konsumabel (sabun, tisu, galon) | Housekeeping |
| Keamanan | OSS |

Semua tiket mengirim email ke **operation@apotekalpro.id**. Telegram dikirim ke grup tim terkait (chat_id diisi setelah grup dibuat). Mapping bisa diubah di panel admin.

## Kebutuhan tambahan yang masuk ke rencana
| # | Kebutuhan | Keterangan |
|---|---|---|
| 1 | Lacak status oleh pelapor | Halaman sukses berisi kode tiket + link `/t/{kode}` (tanpa login); "Laporan saya" disimpan di localStorage |
| 2 | Notif ke pelapor | Email opsional (jika diisi) saat Dijadwalkan dan Selesai |
| 3 | Konfirmasi selesai + rating | Pelapor klik "Sudah beres" / "Belum" + rating 1–5. Tidak ada respons dalam 3 hari kerja → otomatis Closed |
| 4 | Foto sebelum/sesudah | Admin wajib unggah foto "sesudah" saat menandai Selesai |
| 5 | Biaya & vendor | Internal/vendor, nama vendor, biaya. Biaya di atas ambang (usulan Rp 1 jt, **menunggu konfirmasi**) → perlu approval Ops Manager |
| 6 | SLA (opsional) | Target respon/selesai per kategori, dihitung dalam jam kerja Sen–Jum 09–16 + libur nasional. Kosong = tanpa SLA/eskalasi. Aktif setelah nilainya dikonfirmasi |
| 7 | Eskalasi | Hanya untuk kategori yang punya SLA: lewat target → notif ulang ke tim + Ops Manager |
| 8 | Anti-spam | Cloudflare Turnstile, rate-limit per device/IP |
| 9 | Master data | Lantai, lokasi, tipe area, kategori, chip, tim, admin |
| 10 | Generator QR | PDF stiker A4 (logo Alpro, nama lokasi, "Scan untuk lapor fasilitas") |
| 11 | Dashboard & laporan | Tiket terbuka, rata-rata waktu respon/selesai, top lokasi/kategori, biaya per bulan, export Excel |
| 12 | Audit trail | Setiap perubahan status/assign tercatat |
| 13 | Fase 2 | Preventive maintenance (servis AC, cek APAR), WA gateway, tautan ke data aset di Aset Kantor |

## Alur & Status Tiket
```
[Scan QR] → [Form] → [Submit] → BARU ── Email operation@ + Telegram tim
                                  │
                   Admin "Terima" → DITERIMA
                                  │
          Set jadwal + teknisi/vendor → DIJADWALKAN ── notif pelapor
                                  │
                              DIKERJAKAN ⇄ MENUNGGU (part/vendor/approval)
                                  │
             Unggah foto sesudah → SELESAI ── minta konfirmasi pelapor
                                  │
          Pelapor OK / otomatis 3 hari kerja → CLOSED   (pelapor "Belum" → DIKERJAKAN)
  Cabang lain: DITOLAK (alasan wajib) · DUPLIKAT (ditautkan ke tiket induk)
```

## Model Data (schema `fasilitas`)
| Tabel | Kolom inti |
|---|---|
| `floors` | id, nama, urutan |
| `area_types` | id, nama |
| `locations` | id, kode, floor_id, area_type_id, nama, aktif |
| `categories` | id, nama, team_id, sla_respon_jam (nullable), sla_selesai_jam (nullable) |
| `quick_issues` | id, area_type_id, category_id, label |
| `teams` | id, nama, telegram_chat_id, email_list (default `operation@apotekalpro.id`) |
| `admins` | id (= auth.users), nama, email, team_id, role (`super_admin`/`admin`/`teknisi`/`approver`) |
| `settings` | jam kerja, libur nasional, ambang approval biaya, hari auto-close |
| `tickets` | id, kode `TKT-2611-0001`, location_id, category_id, jenis, deskripsi, nama/divisi/wa/email pelapor, device_id, status, team_id, assignee_id, jadwal_at, sla_due (nullable), vendor, biaya, approval_status, rating, feedback, parent_ticket_id, me_too_count, timestamps |
| `ticket_photos` | id, ticket_id, fase (`before`/`after`), drive_file_id |
| `ticket_events` | id, ticket_id, actor, aksi, status_dari/ke, catatan, created_at |

RLS: role anon tidak boleh mengakses tabel langsung; semua lewat Route Handler Next.js dengan service role. Admin login lewat Supabase Auth (email + password), dibatasi per `team_id`.

## Struktur Aplikasi
```
app/
  r/[kode]/page.tsx        # landing scan QR → form (mobile-first)
  t/[kode]/page.tsx        # status tiket publik + konfirmasi/rating
  admin/login
  admin/page.tsx           # dashboard
  admin/tiket/             # list + kanban + detail
  admin/jadwal/            # kalender jadwal perbaikan
  admin/master/            # lokasi, kategori, chip, tim, admin, pengaturan
  admin/qr/                # generator & cetak stiker QR
  admin/laporan/           # laporan + export xlsx
  api/tickets/route.ts     # buat tiket (Turnstile, rate-limit, cek duplikat)
  api/upload/route.ts      # foto → Shared Drive
  api/cron/route.ts        # eskalasi SLA + auto-close (Vercel Cron)
  api/telegram/webhook     # tombol inline [Terima] [Ambil tiket]
components/ui.tsx          # komponen ala Aset Kantor
lib/ supabase.ts · drive.ts · notify/email.ts · notify/telegram.ts · workhours.ts · labels.ts · format.ts
supabase/migrations/       # schema fasilitas + seed 4 lantai / 24 lokasi / kategori / chip
```

## Langkah pertama (disetujui): Prototype klikable untuk visualisasi proses
Satu halaman HTML (React 18 via CDN, Tailwind CDN, lucide, Plus Jakarta Sans, token Aset Kantor, logo `logo-alpro.png`) dengan data dummy di memori, tanpa backend:
1. **Mode Simulasi alur**: stepper 6 langkah (Scan QR → Form → Submit → Notifikasi → FU/Jadwal → Closed) yang menggerakkan semua panel.
2. **Panel HP pelapor**: pilih titik QR (24 lokasi), form dengan lokasi terkunci + chip per tipe area, deteksi duplikat "Saya juga mengalami", halaman sukses + status `/t/{kode}`, konfirmasi "Sudah beres" + rating.
3. **Panel notifikasi**: preview email ke operation@apotekalpro.id dan pesan Telegram tim (tombol Terima/Ambil tiket).
4. **Panel admin**: dashboard KPI, kanban per status, detail tiket (assign, jadwal, vendor/biaya → approval Ops Manager, foto sesudah, audit trail), contoh cetak stiker QR.
5. Tema terang/gelap, responsif (HP: tab Pelapor/Admin).
Output: `prototype/index.html` di repo (commit + push ke branch) dan dipublikasikan sebagai Artifact privat untuk dibuka di browser/HP.

## Tahapan & Timeline (±4 minggu)
| Fase | Durasi | Output |
|---|---|---|
| 0. Persiapan | 2 hari | Shared Drive + Service Account, akun SMTP, exposed schema Supabase, domain, grup Telegram |
| 1. Fondasi | 3 hari | Scaffold Next.js, tema Aset Kantor, migrasi + seed, login admin |
| 2. Alur pelapor | 4 hari | Form `/r/[kode]`, chip, upload foto ke Drive, cek duplikat, halaman sukses & `/t/[kode]` |
| 3. Notifikasi | 2 hari | Template email Alpro → operation@, Telegram per tim + tombol inline |
| 4. Panel admin | 5 hari | List/kanban/detail, assign, jadwal, status, foto sesudah, biaya/vendor, approval, audit |
| 5. Otomasi | 1 hari | Auto-close 3 hari kerja, kerangka SLA/eskalasi (aktif setelah target dikonfirmasi) |
| 6. Master data & QR | 2 hari | CRUD master, PDF stiker 24 titik |
| 7. Dashboard & laporan | 2 hari | KPI, grafik, export Excel |
| 8. UAT & pilot | 1 minggu | Pilot Lantai 2 (pantry + toilet = trafik tertinggi) → perbaikan → tempel semua QR → sosialisasi |

## Biaya Operasional
| Komponen | Biaya |
|---|---|
| Vercel | Hobby Rp 0 (ToS non-komersial) → disarankan **Pro US$20/bln** untuk penggunaan resmi perusahaan |
| Supabase, Shared Drive, SMTP Workspace, Telegram, Turnstile | Rp 0 (memakai infrastruktur yang sudah ada) |
| Stiker QR vinyl tahan air (24 titik + cadangan) | ±Rp 100–200 rb sekali |

## Masih menunggu (tidak menahan Fase 1–2)
1. Target SLA per kategori (TBC). Sampai dikonfirmasi, SLA nonaktif
2. Ambang biaya yang perlu approval (usulan Rp 1 jt)
3. Grup Telegram per tim (akan ditambahkan)
4. Kredensial lewat env Vercel: Supabase anon/service key, JSON Service Account + ID Shared Drive, SMTP App Password
5. Domain/subdomain (usulan `tiket.apotekalpro.id`)
6. Nama & email admin per tim (OSS, OASIS, Housekeeping)

## Verifikasi (end-to-end)
1. `npm run lint && npm run build` bersih; unit test `lib/workhours.ts` (Sen–Jum 09–16, libur, lintas hari/akhir pekan) dan logika duplikat.
2. Migrasi di-apply ke Supabase (schema `fasilitas`); cek request anon langsung ke tabel ditolak RLS; seed menghasilkan 4 lantai / 24 lokasi.
3. Playwright (viewport HP): `/r/L2-PANTRY` → lokasi terkunci, chip Pantry muncul → isi + foto → submit → kode tiket tampil, record ada di DB, file ada di Shared Drive, email masuk ke operation@, pesan Telegram terkirim (grup test).
4. Submit kedua di lokasi + kategori yang sama → muncul prompt "Saya juga mengalami", `me_too_count` bertambah.
5. Alur admin: Terima → Jadwalkan → Selesai (foto sesudah) → konfirmasi pelapor → Closed; `ticket_events` lengkap. Biaya di atas ambang → status Menunggu approval Ops Manager.
6. Cek tampilan terang/gelap dan kontras sesuai token Aset Kantor; cetak 1 lembar QR dan scan dengan Android & iPhone.
