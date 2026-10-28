import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { integrations } from '@/lib/env';
import { ROLE_LABEL } from '@/lib/labels';
import { Button, Callout, Card, Chip, PageHeader } from '@/components/ui';
import { PasswordForm } from './password-form';
import { makeLinkCode, unlinkTelegram } from './actions';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ wajib?: string }> }) {
  const admin = await requireAdmin(undefined, { allowPasswordChange: true });
  const sp = await searchParams;
  const ref = await getRefData();
  const team = ref.teams.find(t => t.id === admin.team_id);
  return (
    <>
      <PageHeader title="Profil" subtitle={`${admin.nama} · ${ROLE_LABEL[admin.role]}${team ? ' · Tim ' + team.nama : ''}`} />
      {(sp.wajib || admin.must_change_password) && <Callout tone="amber" title="Ganti password dulu.">Akun Anda masih memakai password sementara.</Callout>}
      <Card title="Ganti password"><PasswordForm /></Card>
      {!admin.must_change_password && (
        <Card title="Telegram" subtitle="Hubungkan agar tombol Terima, Ambil tiket, dan Setujui di notifikasi Telegram bisa dipakai atas nama Anda">
          {!integrations.telegram ? <p className="text-sm text-muted">Bot Telegram belum dikonfigurasi oleh super admin.</p> : admin.telegram_user_id ? (
            <div className="flex flex-wrap items-center gap-3"><Chip tone="violet">Terhubung</Chip><form action={unlinkTelegram}><Button type="submit" size="sm" variant="ghost">Putuskan</Button></form></div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {admin.link_code ? (
                <p>Buka chat pribadi dengan bot Tiket Fasilitas, lalu kirim: <code className="num rounded-lg bg-slate-100 px-2 py-1 font-bold">/link {admin.link_code}</code></p>
              ) : <p className="text-muted">Buat kode, lalu kirim ke bot lewat chat pribadi.</p>}
              <form action={makeLinkCode}><Button type="submit" size="sm" variant="soft">{admin.link_code ? 'Buat kode baru' : 'Buat kode'}</Button></form>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
