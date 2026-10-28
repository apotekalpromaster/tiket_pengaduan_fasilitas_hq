-- Data awal: tim, tipe area, 24 lokasi QR, kategori, masalah umum, pengaturan.
-- Aman dijalankan ulang (on conflict do nothing).

insert into fasilitas.settings (id, divisi) values (1, array[
  'Finance','Accounting','Tax','HR','OSS','OASIS','Operation','Procurement','Marketing','Legal','Business Development','Sekretariat Direksi','Lainnya'
]) on conflict (id) do nothing;

insert into fasilitas.teams (kode, nama, urutan) values
  ('oss', 'OSS', 1),
  ('oasis', 'OASIS', 2),
  ('hk', 'Housekeeping', 3)
on conflict (kode) do nothing;

insert into fasilitas.area_types (kode, nama, urutan) values
  ('meeting', 'Ruang Meeting', 1),
  ('direksi', 'Ruang Direksi', 2),
  ('kerja', 'Area Kerja', 3),
  ('toilet', 'Toilet', 4),
  ('pantry', 'Pantry', 5),
  ('training', 'Ruang Training', 6),
  ('musala', 'Musala', 7),
  ('wudhu', 'Tempat Wudhu', 8)
on conflict (kode) do nothing;

insert into fasilitas.locations (kode, nama, lantai, area_type_id, urutan)
select v.kode, v.nama, v.lantai, a.id, v.urutan
from (values
  ('L1-GENUINE', 'Ruang Genuine', 1, 'meeting', 1),
  ('L1-WELCOMING', 'Ruang Welcoming', 1, 'meeting', 2),
  ('L1-INVOLVED', 'Ruang Involved', 1, 'meeting', 3),
  ('L1-TOILET-PRIA-URINOIR', 'Toilet Pria (Urinoir)', 1, 'toilet', 4),
  ('L1-TOILET-CAMPUR', 'Toilet Campur', 1, 'toilet', 5),
  ('L1-AREA-KERJA', 'Area Kerja', 1, 'kerja', 6),
  ('L1-CCO', 'Ruang CCO', 1, 'direksi', 7),
  ('L1-CSO', 'Ruang CSO', 1, 'direksi', 8),
  ('L2-ACCOUNTABLE', 'Ruang Accountable', 2, 'meeting', 1),
  ('L2-CONSIDERATE', 'Ruang Considerate', 2, 'meeting', 2),
  ('L2-YONG-XIN-KAIZEN', 'Ruang Yong Xin Kaizen', 2, 'meeting', 3),
  ('L2-PANTRY', 'Pantry', 2, 'pantry', 4),
  ('L2-COO', 'Ruang COO', 2, 'direksi', 5),
  ('L2-AREA-KERJA', 'Area Kerja', 2, 'kerja', 6),
  ('L2-TOILET-CAMPUR', 'Toilet Campur', 2, 'toilet', 7),
  ('L3-CEO', 'Ruang CEO', 3, 'direksi', 1),
  ('L3-CRO', 'Ruang CRO', 3, 'direksi', 2),
  ('L3-AREA-KERJA', 'Area Kerja', 3, 'kerja', 3),
  ('L3-TOILET-WANITA', 'Toilet Wanita', 3, 'toilet', 4),
  ('L3-TOILET-PRIA', 'Toilet Pria', 3, 'toilet', 5),
  ('L4-TRAINING', 'Ruang Training', 4, 'training', 1),
  ('L4-MUSALA', 'Musala', 4, 'musala', 2),
  ('L4-TOILET-WANITA', 'Toilet Wanita', 4, 'toilet', 3),
  ('L4-TEMPAT-WUDHU', 'Tempat Wudhu', 4, 'wudhu', 4)
) as v(kode, nama, lantai, area, urutan)
join fasilitas.area_types a on a.kode = v.area
on conflict (kode) do nothing;

insert into fasilitas.categories (kode, nama, team_id, urutan)
select v.kode, v.nama, t.id, v.urutan
from (values
  ('listrik', 'Listrik & lampu', 'oss', 1),
  ('ac', 'AC', 'oss', 2),
  ('plumbing', 'Plumbing & air', 'oss', 3),
  ('bangunan', 'Bangunan', 'oss', 4),
  ('furnitur', 'Furnitur', 'oss', 5),
  ('keamanan', 'Keamanan', 'oss', 6),
  ('it', 'IT & jaringan', 'oasis', 7),
  ('av', 'Proyektor/TV', 'oasis', 8),
  ('kebersihan', 'Kebersihan', 'hk', 9),
  ('konsumabel', 'Konsumabel', 'hk', 10)
) as v(kode, nama, team, urutan)
join fasilitas.teams t on t.kode = v.team
on conflict (kode) do nothing;

insert into fasilitas.quick_issues (area_type_id, category_id, label, urutan)
select a.id, c.id, v.label, v.urutan
from (values
  ('toilet', 'plumbing', 'Air mati', 1),
  ('toilet', 'plumbing', 'Kloset/urinoir mampet', 2),
  ('toilet', 'plumbing', 'Keran bocor', 3),
  ('toilet', 'konsumabel', 'Sabun/tisu habis', 4),
  ('toilet', 'kebersihan', 'Bau tidak sedap', 5),
  ('toilet', 'listrik', 'Lampu mati', 6),
  ('pantry', 'konsumabel', 'Galon habis', 1),
  ('pantry', 'listrik', 'Dispenser rusak', 2),
  ('pantry', 'listrik', 'Kulkas tidak dingin', 3),
  ('pantry', 'plumbing', 'Wastafel mampet', 4),
  ('pantry', 'konsumabel', 'Peralatan makan kurang', 5),
  ('pantry', 'kebersihan', 'Area kotor', 6),
  ('kerja', 'ac', 'AC tidak dingin', 1),
  ('kerja', 'listrik', 'Lampu mati', 2),
  ('kerja', 'listrik', 'Stop kontak mati', 3),
  ('kerja', 'furnitur', 'Kursi/meja rusak', 4),
  ('kerja', 'it', 'WiFi lambat/putus', 5),
  ('meeting', 'ac', 'AC tidak dingin', 1),
  ('meeting', 'av', 'Proyektor/TV bermasalah', 2),
  ('meeting', 'furnitur', 'Kursi/meja rusak', 3),
  ('meeting', 'listrik', 'Lampu mati', 4),
  ('meeting', 'it', 'WiFi lambat/putus', 5),
  ('direksi', 'ac', 'AC tidak dingin', 1),
  ('direksi', 'av', 'Proyektor/TV bermasalah', 2),
  ('direksi', 'furnitur', 'Kursi/meja rusak', 3),
  ('direksi', 'listrik', 'Lampu mati', 4),
  ('direksi', 'it', 'WiFi lambat/putus', 5),
  ('training', 'ac', 'AC tidak dingin', 1),
  ('training', 'av', 'Proyektor/TV bermasalah', 2),
  ('training', 'furnitur', 'Kursi/meja rusak', 3),
  ('training', 'listrik', 'Lampu mati', 4),
  ('training', 'it', 'WiFi lambat/putus', 5),
  ('musala', 'kebersihan', 'Karpet/sajadah kotor', 1),
  ('musala', 'konsumabel', 'Mukena/sarung kurang', 2),
  ('musala', 'listrik', 'Lampu mati', 3),
  ('musala', 'ac', 'AC tidak dingin', 4),
  ('wudhu', 'plumbing', 'Air mati', 1),
  ('wudhu', 'plumbing', 'Keran bocor', 2),
  ('wudhu', 'kebersihan', 'Lantai licin/kotor', 3),
  ('wudhu', 'listrik', 'Lampu mati', 4)
) as v(area, cat, label, urutan)
join fasilitas.area_types a on a.kode = v.area
join fasilitas.categories c on c.kode = v.cat
where not exists (
  select 1 from fasilitas.quick_issues q where q.area_type_id = a.id and q.label = v.label
);
