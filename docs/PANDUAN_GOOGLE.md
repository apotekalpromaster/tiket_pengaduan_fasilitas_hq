# Panduan Google: Email (Gmail) dan Penyimpanan Foto (Google Drive)

Panduan ini untuk akun Google **gratis** `apotekalpro.master@gmail.com`. Ikuti berurutan; total ±20 menit.

| Bagian | Hasil | Isi ke Vercel |
|---|---|---|
| A. Email | Notifikasi terkirim dari apotekalpro.master@gmail.com | `SMTP_USER`, `SMTP_PASS` |
| B. Foto | Foto tersimpan di Drive akun itu, folder **Tiket Fasilitas HQ** | `DRIVE_SCRIPT_URL`, `DRIVE_SCRIPT_SECRET` |

## Perlu Google Cloud Console? Tidak.

Aplikasi ini **tidak memakai Google Cloud Console, Service Account, JSON key, maupun ID folder**. Alasannya:

- Service Account tidak punya kuota penyimpanan sendiri. File yang ia unggah ditolak Google, kecuali disimpan di **Shared Drive**.
- Shared Drive hanya tersedia di Google Workspace berbayar, bukan akun Gmail gratis.

Karena itu foto disimpan lewat **Google Apps Script** yang berjalan atas nama `apotekalpro.master@gmail.com` sendiri dan memakai kuota 15 GB akun itu. Apps Script otomatis memakai project Google Cloud tersembunyi, jadi Anda tidak perlu membuat project baru, dan project lama juga tidak tersentuh.

Kalau Anda sudah terlanjur membuat Service Account atau project di Cloud Console, biarkan saja atau hapus. Tidak dipakai.

---

## Sebelum mulai

1. Gunakan browser di komputer (bukan HP) dan **login sebagai `apotekalpro.master@gmail.com`**.
   Kalau Chrome Anda berisi beberapa akun Google, buka jendela profil Chrome khusus akun ini, atau pakai jendela Incognito lalu login. Jika tidak, langkah B sering terbuka dengan akun yang salah.
2. Siapkan tab Vercel: **Project tiket fasilitas → Settings → Environment Variables**.
3. Cara menambah variabel di Vercel (dipakai di semua langkah):
   - Isi kolom **Key** (nama variabel) dan **Value** (nilainya).
   - Pada **Environments**, centang **Production** dan **Preview**.
   - Klik **Save**.
   - Setelah semua variabel terisi: **Deployments** → titik tiga di deployment teratas → **Redeploy**. Variabel baru hanya terbaca setelah redeploy.

---

## A. Email lewat Gmail gratis

Gmail mengizinkan aplikasi mengirim email lewat SMTP memakai **App Password** (Sandi Aplikasi): password khusus 16 huruf, bukan password Gmail Anda.

### A1. Aktifkan Verifikasi 2 Langkah
App Password hanya bisa dibuat bila Verifikasi 2 Langkah aktif.

1. Buka **https://myaccount.google.com/security**.
2. Di bagian **Cara Anda login ke Google** (*How you sign in to Google*), klik **Verifikasi 2 Langkah** (*2-Step Verification*).
3. Bila statusnya sudah **Aktif**, lanjut ke A2. Bila belum, klik **Aktifkan Verifikasi 2 Langkah** dan ikuti petunjuk; nomor HP untuk SMS sudah cukup.

> Tips: pakai nomor HP kantor yang dipegang lebih dari satu orang, agar akun tidak terkunci saat satu orang tidak ada.

### A2. Buat App Password
1. Buka **https://myaccount.google.com/apppasswords**. Google mungkin meminta password lagi.
2. Kolom **Nama aplikasi** (*App name*): ketik `Tiket Fasilitas HQ`.
3. Klik **Buat** (*Create*).
4. Muncul kotak berisi **16 huruf** dalam 4 kelompok, misalnya `abcd efgh ijkl mnop`. **Salin sekarang.** Setelah ditutup, password ini tidak bisa dilihat lagi; kalau lupa, hapus lalu buat baru.
5. Klik **Selesai** (*Done*).

> Kalau halaman menampilkan "Setelan yang Anda cari tidak tersedia untuk akun Anda", berarti Verifikasi 2 Langkah belum aktif. Ulangi A1.

### A3. Isi ke Vercel
| Key | Value |
|---|---|
| `SMTP_USER` | `apotekalpro.master@gmail.com` |
| `SMTP_PASS` | 16 huruf dari A2 (spasi boleh ikut, aplikasi membuangnya) |
| `MAIL_OPS_TO` | `operation@apotekalpro.id` |

`SMTP_HOST` (`smtp.gmail.com`), `SMTP_PORT` (`465`), dan `MAIL_FROM` tidak perlu diisi; nilai bawaannya sudah benar.

Email akan terlihat dari **"Tiket Fasilitas HQ" <apotekalpro.master@gmail.com>**. Kalau penerima menekan *Balas*, balasannya menuju `operation@apotekalpro.id`, bukan ke inbox Gmail.

### A4. Yang perlu diketahui
- **Batas kirim Gmail gratis ±500 penerima per hari.** Untuk kantor pusat ini jauh di atas kebutuhan (perkiraan puluhan email per hari).
- **Jika password Gmail diganti, semua App Password ikut batal.** Buat App Password baru (A2), ganti `SMTP_PASS` di Vercel, lalu Redeploy.
- Email pertama mungkin masuk folder Spam di `operation@apotekalpro.id`. Tandai **Bukan spam** sekali.
- Folder **Terkirim** di Gmail akan berisi salinan semua notifikasi. Itu normal.

---

## B. Penyimpanan foto lewat Google Apps Script

Anda menempel satu skrip dan menerbitkannya sebagai **Web App**. Aplikasi tiket mengirim foto ke Web App ini, lalu skrip menyimpannya ke Drive Anda. Folder **Tiket Fasilitas HQ** dibuat otomatis di **My Drive**, dengan subfolder per bulan (`2611`, `2612`, ...).

### B1. Siapkan kata sandi rahasia (SECRET)
Kata sandi ini membuktikan bahwa yang mengirim foto adalah aplikasi Anda, bukan orang lain yang menemukan URL skrip.

- Buat **minimal 32 karakter, hanya huruf dan angka**, tanpa spasi atau tanda kutip. Contoh **bentuk** (jangan dipakai persis): `Tk7fQ2mZp9LwX4vB8nR3sD6hJ1yC5gA0`.
- Bisa memakai saran kata sandi otomatis dari Chrome atau pengelola kata sandi apa pun.
- Simpan sementara di Notepad; dipakai di B3 dan B6.

### B2. Buat project Apps Script
1. Buka **https://script.google.com** (masih sebagai apotekalpro.master@gmail.com; cek foto profil di kanan atas).
2. Klik **Proyek baru** (*New project*) di kiri atas.
3. Editor terbuka dengan judul **Proyek tanpa judul** (*Untitled project*). Klik judul itu, ganti menjadi `Tiket Fasilitas HQ - Drive`, lalu klik **Ganti nama** (*Rename*).

### B3. Tempel kode
1. Di panel kiri ada file **Code.gs** yang berisi `function myFunction() { }`.
2. Klik di area kode, tekan **Ctrl+A** lalu **Delete**, sampai editor kosong.
3. Buka file **`apps-script/Code.gs`** di repository GitHub (tombol **Raw** → Ctrl+A → Ctrl+C). Tempel ke editor (**Ctrl+V**).
4. Cari baris ke-11:
   ```js
   var SECRET = 'GANTI-DENGAN-KATA-SANDI-ACAK-MINIMAL-32-KARAKTER';
   ```
   Ganti teks di antara tanda kutip dengan SECRET dari B1. Tanda kutipnya tetap ada:
   ```js
   var SECRET = 'Tk7fQ2mZp9LwX4vB8nR3sD6hJ1yC5gA0';
   ```
5. Klik ikon **Simpan** (disket), atau tekan **Ctrl+S**.

### B4. Deploy sebagai Web App
1. Klik tombol biru **Terapkan** (*Deploy*) di kanan atas → **Deployment baru** (*New deployment*).
2. Di jendela yang muncul, sebelah kiri tertulis **Pilih jenis** (*Select type*). Klik **ikon roda gigi** di sebelahnya → pilih **Aplikasi web** (*Web app*).
3. Isi kolom:

| Kolom | Isi |
|---|---|
| **Deskripsi** (*Description*) | `Versi 1` |
| **Jalankan sebagai** (*Execute as*) | **Saya (apotekalpro.master@gmail.com)** — *Me* |
| **Yang memiliki akses** (*Who has access*) | **Siapa saja** (*Anyone*) |

   > **Siapa saja** wajib dipilih karena server aplikasi (Vercel) tidak login ke Google. Tetap aman: tanpa SECRET yang benar, skrip menolak semua permintaan. Skrip juga hanya bisa membaca file di folder Tiket Fasilitas HQ, bukan isi Drive lain.
   > Jangan pilih "Siapa saja yang memiliki Akun Google" (*Anyone with Google account*); pilihan itu membuat aplikasi gagal.

4. Klik **Terapkan** (*Deploy*).

### B5. Izinkan akses (hanya sekali)
1. Muncul jendela **Otorisasi akses diperlukan** → klik **Otorisasi akses** (*Authorize access*).
2. Pilih akun **apotekalpro.master@gmail.com**.
3. Muncul layar peringatan **"Google belum memverifikasi aplikasi ini"** (*Google hasn't verified this app*). Ini normal untuk skrip buatan sendiri:
   - Klik **Lanjutan** (*Advanced*) di kiri bawah.
   - Klik **Buka Tiket Fasilitas HQ - Drive (tidak aman)** (*Go to … (unsafe)*).
4. Google menampilkan izin yang diminta: melihat, mengedit, membuat, dan menghapus file Google Drive, serta melihat alamat email. Klik **Izinkan** (*Allow*).
   Izin Drive dipakai untuk membuat folder dan menyimpan foto. Alamat email dipakai untuk menampilkan akun yang terhubung di tombol Tes koneksi.
5. Jendela **Deployment baru** menampilkan:
   - **ID Deployment**: tidak perlu.
   - **Aplikasi web → URL**: berbentuk `https://script.google.com/macros/s/AKfycb…panjang…/exec`. Klik **Salin** (*Copy*). **Ini yang dibutuhkan.**
6. Klik **Selesai** (*Done*).

### B6. Isi ke Vercel
| Key | Value |
|---|---|
| `DRIVE_SCRIPT_URL` | URL dari B5, harus diawali `https://script.google.com/macros/s/` dan diakhiri **`/exec`** |
| `DRIVE_SCRIPT_SECRET` | SECRET dari B1, sama persis dengan yang ditulis di skrip |

Lalu **Redeploy** di Vercel.

### B7. Tes
1. **Tes cepat:** tempel `DRIVE_SCRIPT_URL` di tab browser baru. Harus muncul teks `Tiket Fasilitas HQ Drive aktif`.
2. **Tes dari aplikasi:** login panel admin → **Master data → Pengaturan** → **Tes koneksi Google Drive**. Harus muncul "Terhubung ke Drive akun apotekalpro.master@gmail.com" beserta link folder. Folder **Tiket Fasilitas HQ** sekarang ada di My Drive.
3. **Tes nyata:** buka `/r/L2-PANTRY` di HP, kirim laporan dengan foto. Foto muncul di halaman status dan di Drive: **Tiket Fasilitas HQ → (bulan ini)**.

---

## C. Kalau suatu saat skrip perlu diubah

Misalnya mengganti SECRET, atau ada pembaruan `Code.gs`:
1. Ubah kode di editor → **Simpan**.
2. **Terapkan → Kelola deployment** (*Manage deployments*).
3. Pilih deployment yang ada → klik **ikon pensil** (*Edit*).
4. **Versi** (*Version*) → pilih **Versi baru** (*New version*) → **Terapkan**.

URL tetap sama, jadi Vercel tidak perlu diubah (kecuali SECRET yang diganti: ubah `DRIVE_SCRIPT_SECRET` juga, lalu Redeploy).

> Jebakan paling umum: memakai **Deployment baru** lagi. Cara itu menghasilkan **URL baru**, sementara Vercel masih memakai URL lama yang menjalankan kode lama.

---

## D. Masalah yang sering terjadi

| Pesan di Tes koneksi / detail tiket | Penyebab | Solusi |
|---|---|---|
| `DRIVE: AUTH … DRIVE_SCRIPT_SECRET tidak sama` | SECRET di skrip dan di Vercel berbeda | Samakan, lalu ikuti bagian C (Versi baru) atau Redeploy Vercel |
| `DRIVE: SECRET_BELUM_DIGANTI` | Baris `var SECRET` masih teks contoh | Ganti (B3 langkah 4), lalu bagian C |
| `balasan Apps Script bukan JSON … /exec dan akses "Anyone"` | URL berakhiran `/dev`, link editor yang ikut tersalin, atau akses bukan **Siapa saja** | Salin ulang URL dari **Kelola deployment**; pastikan akses **Siapa saja** |
| Membuka URL di browser memunculkan halaman login atau "Tidak dapat membuka file" | Akses masih "Hanya saya" atau "Siapa saja yang memiliki Akun Google" | Kelola deployment → Edit → akses **Siapa saja** → Versi baru |
| `Authorization is required` / "Otorisasi diperlukan" | Langkah B5 terlewat | Di editor, pilih fungsi `doGet` di menu atas → klik **Jalankan** (*Run*) → ikuti B5 langkah 2–4 |
| Foto tidak muncul, riwayat tiket: "Foto tidak disimpan: Google Drive belum dikonfigurasi" | Variabel Vercel belum diisi atau belum Redeploy | B6, lalu Redeploy |
| Drive penuh | Kuota 15 GB dipakai bersama Gmail | Hapus email lama berlampiran besar, atau beli Google One. Foto aplikasi ±150–400 KB, jadi 1 GB ≈ 3.000–6.000 foto |

## E. Hal yang jangan dilakukan
- Jangan memindahkan atau mengganti nama folder **Tiket Fasilitas HQ** dan subfolder bulannya. Folder boleh dibagikan (*Share*) ke tim untuk dilihat.
- Jangan menghapus project Apps Script. Kalau terhapus, foto lama tetap ada di Drive, tetapi aplikasi tidak bisa menampilkan dan menyimpan foto sampai skrip dipasang ulang.
- Jangan membagikan SECRET dan App Password lewat chat. Simpan hanya di Vercel.
