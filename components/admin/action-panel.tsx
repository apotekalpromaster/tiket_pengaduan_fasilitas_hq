'use client';
import { useActionState, useState } from 'react';
import { Bell, CalendarDays, Camera, Hourglass, ShieldCheck, Wrench } from 'lucide-react';
import { Button, Callout, Field, Input, Select, Textarea, cx } from '../ui';
import { PhotoPicker, type Photo } from '../public/photo-picker';
import { fmtRp } from '@/lib/format';
import type { ActionType } from '@/lib/flow';
import type { ActionState } from '@/app/admin/(panel)/tiket/[id]/actions';

export interface PanelProps {
  ticketId: string;
  status: string;
  allowed: ActionType[];
  teamId: string;
  teams: { id: string; nama: string }[];
  techs: { id: string; nama: string }[];
  staffNames: string[];
  dupCandidates: { id: string; label: string }[];
  threshold: number;
  defaultWhen: string;
  current: { exec: 'internal' | 'vendor'; assigneeName: string | null; assigneeAdminId: string | null; vendor: string | null; cost: number; approvalCost: number | null };
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5">
      <h3 className="flex items-center gap-2 text-sm font-bold">{icon}{title}</h3>
      {children}
    </div>
  );
}

export function ActionPanel(p: PanelProps) {
  const [state, formAction, pending] = useActionState(p.action, {});
  const [mode, setMode] = useState<'' | 'reject' | 'dup' | 'reassign' | 'deny' | 'hold'>('');
  const [exec, setExec] = useState(p.current.exec);
  const [assignee, setAssignee] = useState(p.current.assigneeAdminId ? `admin:${p.current.assigneeAdminId}` : p.current.assigneeName ?? (p.techs[0] ? `admin:${p.techs[0].id}` : ''));
  const [cost, setCost] = useState(String(p.current.cost || ''));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const has = (a: ActionType) => p.allowed.includes(a);
  const costNum = Number(cost.replace(/\D/g, '') || 0);
  const needsApproval = costNum > p.threshold && !(p.current.approvalCost !== null && p.current.approvalCost >= costNum);

  if (!p.allowed.length) return null;

  const options = (
    <>
      {p.techs.map(t => <option key={t.id} value={`admin:${t.id}`}>{t.nama} (teknisi)</option>)}
      {p.staffNames.filter(n => !p.techs.some(t => t.nama === n)).map(n => <option key={n} value={n}>{n}</option>)}
    </>
  );

  const submitFinish = (form: FormData) => {
    form.delete('foto');
    photos.forEach((ph, i) => form.append('foto', ph.blob, `sesudah-${i + 1}.jpg`));
    return formAction(form);
  };

  return (
    <div className="flex flex-col gap-3">
      {state.error && <Callout tone="red">{state.error}</Callout>}
      {state.ok && <Callout tone="emerald">{state.ok}</Callout>}

      {(has('accept') || has('reassign') || has('reject') || has('duplicate')) && p.status === 'BARU' && (
        <Section icon={<Bell className="size-4" />} title="Tindak lanjut">
          {has('accept') && (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="op" value="accept" />
              <Field label="Pelaksana (opsional)" htmlFor="a-who">
                <Select id="a-who" name="assignee" value={assignee} onChange={e => setAssignee(e.target.value)}>
                  <option value="">Belum ditentukan</option>{options}
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={pending}>Terima</Button>
                {has('reassign') && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'reassign' ? '' : 'reassign')}>Alihkan tim</Button>}
                {has('reject') && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'reject' ? '' : 'reject')}>Tolak</Button>}
                {has('duplicate') && p.dupCandidates.length > 0 && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'dup' ? '' : 'dup')}>Tandai duplikat</Button>}
              </div>
            </form>
          )}
        </Section>
      )}

      {has('schedule') && (
        <Section icon={<CalendarDays className="size-4" />} title={p.status === 'DIJADWALKAN' ? 'Ubah jadwal' : 'Jadwalkan perbaikan'}>
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="op" value="schedule" /><input type="hidden" name="exec" value={exec} />
            <Field label="Waktu (WIB)" htmlFor="s-when" required hint="Jam kerja HQ Senin–Jumat 09.00–16.00">
              <Input id="s-when" name="when" type="datetime-local" defaultValue={p.defaultWhen} required />
            </Field>
            <Field label="Dikerjakan oleh">
              <div className="flex gap-1.5" role="group">
                {(['internal', 'vendor'] as const).map(k => (
                  <button key={k} type="button" aria-pressed={exec === k} onClick={() => setExec(k)}
                    className={cx('flex-1 rounded-[10px] border px-2 py-2 text-[13px] font-semibold', exec === k ? 'border-brand-500 bg-surface text-brand-text' : 'border-line bg-surface')}>{k === 'internal' ? 'Internal' : 'Vendor'}</button>
                ))}
              </div>
            </Field>
            {exec === 'internal' ? (
              <>
                <Field label="Pelaksana" htmlFor="s-who" required>
                  <Select id="s-who" name="assignee" value={assignee} onChange={e => setAssignee(e.target.value)}>
                    <option value="" disabled>Pilih pelaksana</option>{options}<option value="__lain">Lainnya (ketik nama)</option>
                  </Select>
                </Field>
                {assignee === '__lain' && <Field label="Nama pelaksana" htmlFor="s-other" required><Input id="s-other" name="assignee_other" required /></Field>}
              </>
            ) : (
              <Field label="Nama vendor" htmlFor="s-vendor" required><Input id="s-vendor" name="vendor" defaultValue={p.current.vendor ?? ''} placeholder="Mis. CV Sejuk Teknik" required /></Field>
            )}
            <Field label="Estimasi biaya (Rp)" htmlFor="s-cost" error={needsApproval ? `Di atas ${fmtRp(p.threshold)}: perlu persetujuan Ops Manager sebelum dijadwalkan.` : undefined}
              hint={`Kosongkan bila tanpa biaya. Ambang approval ${fmtRp(p.threshold)}.`}>
              <Input id="s-cost" name="cost" inputMode="numeric" className="num" value={cost} onChange={e => setCost(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pending}>{needsApproval ? 'Ajukan approval' : 'Jadwalkan'}</Button>
              {p.status === 'DITERIMA' && has('reassign') && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'reassign' ? '' : 'reassign')}>Alihkan tim</Button>}
              {p.status === 'DITERIMA' && has('reject') && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'reject' ? '' : 'reject')}>Tolak</Button>}
              {p.status === 'DITERIMA' && has('duplicate') && p.dupCandidates.length > 0 && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'dup' ? '' : 'dup')}>Tandai duplikat</Button>}
            </div>
          </form>
        </Section>
      )}

      {mode === 'reassign' && (
        <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
          <input type="hidden" name="op" value="reassign" />
          <Field label="Alihkan ke tim" htmlFor="r-team">
            <Select id="r-team" name="team" defaultValue="">{[<option key="" value="" disabled>Pilih tim</option>, ...p.teams.filter(t => t.id !== p.teamId).map(t => <option key={t.id} value={t.id}>{t.nama}</option>)]}</Select>
          </Field>
          <Button type="submit" loading={pending} className="self-start">Alihkan</Button>
        </form>
      )}
      {mode === 'reject' && (
        <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
          <input type="hidden" name="op" value="reject" />
          <Field label="Alasan penolakan" htmlFor="r-reason" required hint="Dikirim ke pelapor bila mengisi email, dan tampil di halaman status.">
            <Textarea id="r-reason" name="reason" required minLength={5} maxLength={500} />
          </Field>
          <Button type="submit" variant="danger" loading={pending} className="self-start">Tolak tiket</Button>
        </form>
      )}
      {mode === 'dup' && (
        <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
          <input type="hidden" name="op" value="duplicate" />
          <Field label="Gabungkan ke tiket" htmlFor="r-parent"><Select id="r-parent" name="parent">{p.dupCandidates.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Button type="submit" loading={pending} className="self-start">Gabungkan</Button>
        </form>
      )}

      {(has('approve') || has('deny')) && (
        <Section icon={<ShieldCheck className="size-4" />} title="Persetujuan biaya">
          <p className="text-sm">Estimasi <b className="num">{fmtRp(p.current.cost)}</b> oleh {p.current.exec === 'vendor' ? p.current.vendor : p.current.assigneeName}.</p>
          <div className="flex flex-wrap gap-2">
            <form action={formAction}><input type="hidden" name="op" value="approve" /><Button type="submit" loading={pending}>Setujui</Button></form>
            <Button type="button" variant="secondary" onClick={() => setMode(mode === 'deny' ? '' : 'deny')}>Tolak biaya</Button>
          </div>
          {mode === 'deny' && (
            <form action={formAction} className="flex flex-col gap-2">
              <input type="hidden" name="op" value="deny" />
              <Field label="Catatan untuk tim (opsional)" htmlFor="d-note"><Textarea id="d-note" name="note" maxLength={300} placeholder="Mis. cari pembanding vendor lain" /></Field>
              <Button type="submit" variant="danger" loading={pending} className="self-start">Tolak biaya</Button>
            </form>
          )}
        </Section>
      )}

      {has('start') && (
        <Section icon={<Wrench className="size-4" />} title="Hari pengerjaan">
          <form action={formAction}><input type="hidden" name="op" value="start" /><Button type="submit" loading={pending}>Mulai dikerjakan</Button></form>
        </Section>
      )}

      {has('resume') && (
        <Section icon={<Hourglass className="size-4" />} title="Menunggu part/vendor">
          <form action={formAction}><input type="hidden" name="op" value="resume" /><Button type="submit" loading={pending}>Lanjutkan pekerjaan</Button></form>
        </Section>
      )}

      {has('finish') && (
        <Section icon={<Camera className="size-4" />} title="Selesaikan pekerjaan">
          <form action={submitFinish} className="flex flex-col gap-3">
            <input type="hidden" name="op" value="finish" />
            <Field label="Foto sesudah" required hint="Wajib sebagai bukti pekerjaan."><PhotoPicker id="f-after" photos={photos} onChange={setPhotos} label="Unggah" /></Field>
            <Field label="Catatan pekerjaan" htmlFor="f-note"><Input id="f-note" name="note" maxLength={300} placeholder="Mis. ganti karet keran" /></Field>
            <Field label="Biaya aktual (Rp)" htmlFor="f-cost" hint="Kosongkan bila sama dengan estimasi."><Input id="f-cost" name="cost" inputMode="numeric" className="num" placeholder={String(p.current.cost || 0)} /></Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pending} disabled={!photos.length}>Tandai selesai</Button>
              {has('hold') && <Button type="button" variant="secondary" onClick={() => setMode(mode === 'hold' ? '' : 'hold')}>Tunda: menunggu part</Button>}
            </div>
            {!photos.length && <span className="text-xs text-muted">Tombol aktif setelah foto sesudah diunggah.</span>}
          </form>
          {mode === 'hold' && (
            <form action={formAction} className="flex flex-col gap-2">
              <input type="hidden" name="op" value="hold" />
              <Field label="Menunggu apa?" htmlFor="h-note"><Input id="h-note" name="note" maxLength={200} placeholder="Mis. kompresor dipesan, tiba Senin" /></Field>
              <Button type="submit" variant="secondary" loading={pending} className="self-start">Tunda</Button>
            </form>
          )}
        </Section>
      )}
    </div>
  );
}

export function ResendButton({ action }: { action: () => Promise<ActionState> }) {
  const [state, run, pending] = useActionState(async () => action(), {} as ActionState);
  return (
    <form action={run} className="inline-flex items-center gap-2">
      <Button type="submit" size="sm" variant="ghost" loading={pending}>Kirim ulang</Button>
      {state.error && <span className="text-xs text-red-text">{state.error}</span>}
      {state.ok && <span className="text-xs text-emerald-text">{state.ok}</span>}
    </form>
  );
}
