import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = (f: string) => readFileSync(join(__dirname, '..', 'supabase', 'migrations', f), 'utf8');

// Simulasi lingkungan Supabase: role bawaan dan tabel auth.users.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
`;

describe('migrasi fasilitas', () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(SUPABASE_STUB);
    await db.exec(sql('0001_fasilitas_schema.sql'));
    await db.exec(sql('0002_seed.sql'));
  });

  it('seed membuat 24 lokasi, 10 kategori, 3 tim', async () => {
    const r = await db.query<{ l: number; c: number; t: number; q: number }>(`select
      (select count(*)::int from fasilitas.locations) l,
      (select count(*)::int from fasilitas.categories) c,
      (select count(*)::int from fasilitas.teams) t,
      (select count(*)::int from fasilitas.quick_issues) q`);
    expect(r.rows[0]).toMatchObject({ l: 24, c: 10, t: 3 });
    expect(r.rows[0].q).toBeGreaterThan(30);
  });

  it('nama tim OSS, OASIS, Housekeeping', async () => {
    const r = await db.query<{ nama: string }>('select nama from fasilitas.teams order by urutan');
    expect(r.rows.map(x => x.nama)).toEqual(['OSS', 'OASIS', 'Housekeeping']);
  });

  it('per lantai: 8, 7, 5, 4 titik', async () => {
    const r = await db.query<{ lantai: number; n: number }>('select lantai, count(*)::int n from fasilitas.locations group by lantai order by lantai');
    expect(r.rows.map(x => x.n)).toEqual([8, 7, 5, 4]);
  });

  it('seed aman dijalankan ulang', async () => {
    await db.exec(sql('0002_seed.sql'));
    const r = await db.query<{ l: number; q: number }>('select (select count(*)::int from fasilitas.locations) l, (select count(*)::int from fasilitas.quick_issues) q');
    expect(r.rows[0].l).toBe(24);
    const again = r.rows[0].q;
    await db.exec(sql('0002_seed.sql'));
    const r2 = await db.query<{ q: number }>('select count(*)::int q from fasilitas.quick_issues');
    expect(r2.rows[0].q).toBe(again);
  });

  it('kode tiket berurutan per bulan dan trigger mengisinya', async () => {
    const ins = (tok: string) => db.query<{ code: string }>(`
      insert into fasilitas.tickets (public_token, location_id, category_id, team_id, jenis, reporter_name, reporter_wa)
      select $1, l.id, c.id, c.team_id, 'Kerusakan', 'Uji', '081234567890'
      from fasilitas.locations l, fasilitas.categories c where l.kode = 'L2-PANTRY' and c.kode = 'konsumabel'
      returning code`, [tok]);
    const a = (await ins('tok-a')).rows[0].code;
    const b = (await ins('tok-b')).rows[0].code;
    expect(a).toMatch(/^TKT-\d{4}-0001$/);
    expect(b).toMatch(/^TKT-\d{4}-0002$/);
  });

  it('add_me_too menambah hitungan', async () => {
    const t = await db.query<{ id: string }>(`select id from fasilitas.tickets where public_token = 'tok-a'`);
    const r = await db.query<{ add_me_too: number }>('select fasilitas.add_me_too($1, 2)', [t.rows[0].id]);
    expect(r.rows[0].add_me_too).toBe(2);
  });

  it('status di luar daftar ditolak constraint', async () => {
    await expect(db.query(`update fasilitas.tickets set status = 'HILANG' where public_token = 'tok-a'`)).rejects.toThrow();
  });

  it('role anon dan authenticated tidak bisa membaca tabel', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query('select * from fasilitas.tickets')).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
  });

  it('service_role bisa membaca dan menulis', async () => {
    await db.exec('set role service_role');
    const r = await db.query<{ n: number }>('select count(*)::int n from fasilitas.tickets');
    expect(r.rows[0].n).toBe(2);
    await db.query(`update fasilitas.settings set auto_close_days = 3 where id = 1`);
    await db.exec('reset role');
  });
});
