import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { db, must } from '@/lib/supabase/admin';
import { ROLE_LABEL } from '@/lib/labels';
import type { Admin, Role } from '@/lib/types';
import { Button, Callout, Card, Chip, Field, Input, Select } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { createAdmin, resetPassword, updateAdmin } from '../actions';

export const metadata: Metadata = { title: 'Akun admin' };
const ROLES = Object.entries(ROLE_LABEL) as [Role, string][];

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requireAdmin(['super_admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  const flash = sp.ok === '1' ? (await cookies()).get('flash')?.value : undefined;
  const admins = must(await db().from('admins').select('*').order('aktif', { ascending: false }).order('nama'), 'memuat admin') as Admin[];
  const teamOpts = [<option key="" value="">Tanpa tim</option>, ...ref.teams.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)];
  return (
    <>
      <MasterHeader active="admin" role={me.role} title="Master data" subtitle="Akun yang bisa masuk ke panel admin" ok={sp.ok && sp.ok !== '1' ? sp.ok : undefined} error={sp.e} />
      {flash && <Callout tone="emerald">{flash}</Callout>}
      <Callout>
        <b>Super admin</b> semua akses. <b>Admin tim</b> menangani tiket timnya. <b>Teknisi</b> hanya tiket yang ditugaskan kepadanya (mulai, tunda, selesai). <b>Approver</b> hanya menyetujui biaya.
        Email yang sudah punya akun di Supabase kantor (mis. aplikasi aset) otomatis memakai akun itu.
      </Callout>
      <Card title="Tambah akun">
        <form action={createAdmin} className="grid gap-3 md:grid-cols-4">
          <Field label="Email" htmlFor="n-email"><Input id="n-email" name="email" type="email" required /></Field>
          <Field label="Nama" htmlFor="n-nama"><Input id="n-nama" name="nama" required /></Field>
          <Field label="Peran" htmlFor="n-role"><Select id="n-role" name="role" defaultValue="admin">{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Tim" htmlFor="n-team" hint="Wajib untuk admin tim dan teknisi."><Select id="n-team" name="team_id">{teamOpts}</Select></Field>
          <div className="md:col-span-4"><Button type="submit">Buat akun</Button></div>
        </form>
      </Card>
      <div className="flex flex-col gap-2">
        {admins.map(a => (
          <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm"><b className="font-bold">{a.email}</b>{!a.aktif && <Chip tone="red">Nonaktif</Chip>}{a.must_change_password && <Chip tone="amber">Password sementara</Chip>}{a.telegram_user_id ? <Chip tone="violet">Telegram terhubung</Chip> : <Chip>Telegram belum</Chip>}{a.id === me.id && <Chip tone="brand">Anda</Chip>}</div>
            <form action={updateAdmin} className="grid items-end gap-2 md:grid-cols-[1fr_180px_180px_auto_auto]">
              <input type="hidden" name="id" value={a.id} />
              <Input name="nama" defaultValue={a.nama} aria-label="Nama" />
              <Select name="role" defaultValue={a.role} aria-label="Peran">{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              <Select name="team_id" defaultValue={a.team_id ?? ''} aria-label="Tim">{teamOpts}</Select>
              <label className="flex items-center gap-1.5 pb-2.5 text-sm"><input type="checkbox" name="aktif" defaultChecked={a.aktif} className="size-4 accent-[#f97316]" />Aktif</label>
              <Button type="submit" variant="secondary">Simpan</Button>
            </form>
            {a.id !== me.id && <form action={resetPassword}><input type="hidden" name="id" value={a.id} /><Button type="submit" size="sm" variant="ghost">Atur ulang password</Button></form>}
          </div>
        ))}
      </div>
    </>
  );
}
