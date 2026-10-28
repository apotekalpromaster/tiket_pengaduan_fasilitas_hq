import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { integrations } from '@/lib/env';
import { Button, Card, Chip, Field, Input, Textarea } from '@/components/ui';
import { MasterHeader } from '@/components/admin/master-nav';
import { saveSettings } from '../actions';

export const metadata: Metadata = { title: 'Pengaturan' };
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const admin = await requireAdmin(['super_admin']);
  const sp = await searchParams;
  const { settings: s } = await getRefData();
  const status: [string, boolean, string][] = [
    ['Email (SMTP)', integrations.email, 'SMTP_HOST, SMTP_USER, SMTP_PASS'], ['Telegram', integrations.telegram, 'TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET'],
    ['Google Drive', integrations.drive, 'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID'], ['Anti-spam Turnstile', integrations.turnstile, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY'],
  ];
  return (
    <>
      <MasterHeader active="pengaturan" role={admin.role} title="Master data" ok={sp.ok} error={sp.e} />
      <Card title="Aturan tiket">
        <form action={saveSettings} className="grid gap-4 md:grid-cols-2">
          <Field label="Ambang approval biaya (Rp)" htmlFor="p-th" hint="Biaya di atas angka ini perlu persetujuan Ops Manager."><Input id="p-th" name="approval_threshold" type="number" min="0" step="50000" defaultValue={s.approval_threshold} className="num" /></Field>
          <Field label="Auto-close (hari kerja)" htmlFor="p-ac" hint="Tiket Selesai tanpa konfirmasi pelapor otomatis Closed."><Input id="p-ac" name="auto_close_days" type="number" min="1" max="30" defaultValue={s.auto_close_days} /></Field>
          <Field label="Jam kerja mulai" htmlFor="p-ws"><Input id="p-ws" name="work_start" type="number" min="0" max="23" defaultValue={s.work_start} /></Field>
          <Field label="Jam kerja selesai" htmlFor="p-we"><Input id="p-we" name="work_end" type="number" min="1" max="24" defaultValue={s.work_end} /></Field>
          <Field label="Hari kerja" className="md:col-span-2">
            <div className="flex flex-wrap gap-3">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="work_days" value={i} defaultChecked={s.work_days.includes(i)} className="size-4 accent-[#f97316]" />{d}</label>)}</div>
          </Field>
          <Field label="Email operasional" htmlFor="p-em" hint="Menerima semua laporan baru dan permintaan approval."><Input id="p-em" name="ops_email" type="email" defaultValue={s.ops_email} /></Field>
          <Field label="Daftar divisi" htmlFor="p-div" hint="Satu divisi per baris; muncul di form pelapor."><Textarea id="p-div" name="divisi" rows={6} defaultValue={s.divisi.join('\n')} /></Field>
          <div className="md:col-span-2"><Button type="submit">Simpan pengaturan</Button></div>
        </form>
      </Card>
      <Card title="Status integrasi" subtitle="Diatur lewat Environment Variables di Vercel">
        <ul className="flex flex-col gap-2 text-sm">
          {status.map(([n, ok, vars]) => <li key={n} className="flex flex-wrap items-center gap-2"><Chip tone={ok ? 'emerald' : 'amber'}>{ok ? 'Aktif' : 'Belum diatur'}</Chip><b className="font-semibold">{n}</b>{!ok && <span className="text-xs text-muted">{vars}</span>}</li>)}
        </ul>
      </Card>
    </>
  );
}
