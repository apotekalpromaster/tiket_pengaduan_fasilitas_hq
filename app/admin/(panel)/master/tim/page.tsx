import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { integrations } from '@/lib/env';
import { Button, Callout, Card, Field, Input } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { saveTeam } from '../actions';

export const metadata: Metadata = { title: 'Tim' };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  return (
    <>
      <MasterHeader active="tim" role={admin.role} title="Master data" subtitle="Tim penanganan dan tujuan notifikasinya" ok={sp.ok} error={sp.e} />
      <Callout tone={integrations.telegram ? 'sky' : 'amber'} title={integrations.telegram ? 'Cara mengisi Chat ID:' : 'Bot Telegram belum dikonfigurasi.'}>
        {integrations.telegram ? 'Tambahkan bot ke grup Telegram tim, ketik /id di grup, lalu salin angkanya (diawali tanda minus) ke kolom di bawah.' : 'Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET di Vercel. Sampai itu, notifikasi hanya lewat email.'}
      </Callout>
      {[...ref.teams, null].map(t => (
        <Card key={t?.id ?? 'baru'} title={t ? `Tim ${t.nama}` : 'Tambah tim'} subtitle={t ? `${ref.categories.filter(c => c.team_id === t.id).map(c => c.nama).join(', ') || 'Belum ada kategori'}` : undefined}>
          <form action={saveTeam} className="grid gap-3 md:grid-cols-2">
            {t && <input type="hidden" name="id" value={t.id} />}
            <Field label="Kode" htmlFor={`k-${t?.id ?? 'n'}`}><Input id={`k-${t?.id ?? 'n'}`} name="kode" defaultValue={t?.kode} required /></Field>
            <Field label="Nama tim" htmlFor={`n-${t?.id ?? 'n'}`}><Input id={`n-${t?.id ?? 'n'}`} name="nama" defaultValue={t?.nama} required /></Field>
            <Field label="Chat ID grup Telegram" htmlFor={`c-${t?.id ?? 'n'}`} hint="Kosong = tidak ada notifikasi Telegram untuk tim ini."><Input id={`c-${t?.id ?? 'n'}`} name="telegram_chat_id" defaultValue={t?.telegram_chat_id ?? ''} placeholder="-1001234567890" className="num" /></Field>
            <Field label="Email tambahan" htmlFor={`e-${t?.id ?? 'n'}`} hint="Selain email operasional. Pisahkan dengan koma."><Input id={`e-${t?.id ?? 'n'}`} name="email_extra" defaultValue={t?.email_extra.join(', ')} /></Field>
            <input type="hidden" name="urutan" value={t?.urutan ?? ref.teams.length + 1} />
            <div className="md:col-span-2"><Button type="submit" variant={t ? 'secondary' : 'primary'}>{t ? 'Simpan' : 'Tambah tim'}</Button></div>
          </form>
        </Card>
      ))}
    </>
  );
}
