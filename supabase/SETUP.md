# Setup database di Supabase kantor

Project: `https://wjbyrbbqumqpbqhkdpus.supabase.co`. Semua tabel berada di schema terpisah **`fasilitas`**, jadi tidak menyentuh tabel aplikasi aset/seragam.

## 1. Jalankan migrasi (SQL Editor)

1. Buka Supabase → **SQL Editor** → New query.
2. Tempel isi `migrations/0001_fasilitas_schema.sql` → **Run**.
3. Query baru: tempel `migrations/0002_seed.sql` → **Run**. File ini aman dijalankan ulang.

Cek hasilnya:

```sql
select lantai, count(*) from fasilitas.locations group by lantai order by lantai;  -- 8, 7, 5, 4
select nama from fasilitas.teams order by urutan;                                   -- OSS, OASIS, Housekeeping
```

## 2. Buka akses API untuk schema `fasilitas`

**Project Settings → Data API → Exposed schemas** → tambahkan `fasilitas` → Save.

Tanpa langkah ini aplikasi mendapat galat `Invalid schema: fasilitas`.

Keamanan: RLS aktif tanpa policy dan hanya `service_role` yang diberi hak akses. Kunci `anon` tidak bisa membaca atau menulis tabel `fasilitas` walau schema-nya diekspos. Semua akses lewat server Next.js.

## 3. Buat akun super admin pertama (Hendri)

1. **Authentication → Users → Add user → Create new user**: isi email dan password, centang *Auto Confirm User*.
   Bila email ini sudah punya akun (mis. dari aplikasi aset), lewati langkah ini.
2. SQL Editor (ganti email):

```sql
insert into fasilitas.admins (user_id, email, nama, role)
select id, email, 'Hendri', 'super_admin' from auth.users where email = 'GANTI@apotekalpro.id';
```

3. Masuk ke `/admin/login`. Akun admin lain dibuat dari **Master data → Akun admin**.

## 4. Data yang diisi lewat panel admin

| Menu | Isi |
|---|---|
| Master data → Tim | Chat ID grup Telegram per tim (ketik `/id` di grup setelah bot ditambahkan) |
| Master data → Kategori & SLA | Target SLA per kategori (kosong = nonaktif) |
| Master data → Hari libur | Libur nasional dan cuti bersama |
| Master data → Pengaturan | Ambang approval (default Rp 1.000.000), auto-close, jam kerja, daftar divisi |

## Perubahan schema berikutnya

Tambahkan file baru `0003_….sql` dan jalankan berurutan; jangan ubah file yang sudah dijalankan.
