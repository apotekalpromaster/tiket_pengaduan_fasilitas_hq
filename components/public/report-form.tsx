'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Lock, MapPin, Send, ThumbsUp } from 'lucide-react';
import { Button, Chip, Field, Input, Select, Textarea, cx } from '../ui';
import { PhotoPicker, type Photo } from './photo-picker';
import { Turnstile } from './turnstile';
import { deviceId, loadIdentity, rememberTicket, saveIdentity, type Identity } from '@/lib/local';
import { initials, relTime } from '@/lib/format';
import { JENIS, jenisFor, STATUS_TONE, statusText } from '@/lib/labels';
import type { AreaType, Category, Location, QuickIssue, Status, Team } from '@/lib/types';

interface Dup { id: string; code: string; issue: string | null; status: Status; wait_reason: 'approval' | 'part' | null; me_too_count: number; created_at: string }

export interface ReportFormProps {
  location: Location; locations: Location[]; areaTypes: AreaType[]; categories: Category[]; quickIssues: QuickIssue[]; teams: Team[];
  divisi: string[]; turnstileSiteKey: string;
}

export function ReportForm(p: ReportFormProps) {
  const router = useRouter();
  const [locId, setLocId] = useState(p.location.id);
  const [pickLoc, setPickLoc] = useState(false);
  const [jenis, setJenis] = useState<string>('');
  const [catId, setCatId] = useState('');
  const [issue, setIssue] = useState('');
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [id, setId] = useState<Identity>({ nama: '', divisi: '', wa: '', email: '' });
  const [remembered, setRemembered] = useState(false);
  const [editId, setEditId] = useState(true);
  const [dup, setDup] = useState<Dup | null>(null);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setCaptcha(t), []);

  useEffect(() => {
    const saved = loadIdentity();
    if (saved?.nama && saved.wa) { setId({ ...saved, email: saved.email ?? '' }); setRemembered(true); setEditId(false); }
  }, []);

  const loc = p.locations.find(l => l.id === locId) ?? p.location;
  const area = p.areaTypes.find(a => a.id === loc.area_type_id);
  const chips = useMemo(() => p.quickIssues.filter(q => q.area_type_id === loc.area_type_id), [p.quickIssues, loc.area_type_id]);
  const cat = p.categories.find(c => c.id === catId);
  const team = cat && p.teams.find(t => t.id === cat.team_id);

  useEffect(() => {
    setDup(null);
    if (!catId) return;
    const ctl = new AbortController();
    fetch(`/api/duplikat?lokasi=${locId}&kategori=${catId}`, { signal: ctl.signal })
      .then(r => r.json()).then((j: { ticket: Dup | null }) => setDup(j.ticket)).catch(() => {});
    return () => ctl.abort();
  }, [locId, catId]);

  const clearErr = (k: string) => errors[k] && setErrors(e => ({ ...e, [k]: '' }));
  const pickChip = (q: QuickIssue) => {
    if (issue === q.label) { setIssue(''); return; }
    const c = p.categories.find(x => x.id === q.category_id);
    setIssue(q.label); setCatId(q.category_id); setJenis(jenisFor(c?.kode)); setDupDismissed(false); clearErr('categoryId'); clearErr('description');
  };

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!catId) e.categoryId = 'Pilih kategori.';
    if (!issue && desc.trim().length < 10) e.description = 'Tulis minimal 10 karakter atau pilih masalah umum.';
    if (id.nama.trim().length < 2) e.reporterName = 'Nama wajib diisi.';
    if (!/^(\+?62|0)8\d{8,12}$/.test(id.wa.replace(/[\s-]/g, ''))) e.reporterWa = 'No WhatsApp tidak valid (contoh 0812xxxxxxx).';
    if (id.email && !/^\S+@\S+\.\S+$/.test(id.email)) e.reporterEmail = 'Format email tidak valid.';
    if (p.turnstileSiteKey && !captcha) e.form = 'Tunggu verifikasi keamanan selesai, lalu kirim lagi.';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    if (Object.values(e).some(Boolean)) {
      setErrors(e); if (e.reporterName || e.reporterWa) setEditId(true); if (e.form) setFormError(e.form);
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set('data', JSON.stringify({
      locationId: locId, categoryId: catId, jenis: jenis || jenisFor(cat?.kode), issue: issue || null, description: desc.trim() || null,
      reporterName: id.nama.trim(), reporterDivision: id.divisi || null, reporterWa: id.wa, reporterEmail: id.email.trim() || null,
      deviceId: deviceId(), turnstile: captcha,
    }));
    photos.forEach((ph, i) => fd.append('foto', ph.blob, `foto-${i + 1}.jpg`));
    try {
      const r = await fetch('/api/tickets', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErrors(j.fields ?? {}); setFormError(String(j.error ?? 'Gagal mengirim.').replace(/^[A-Z_]+: /, '')); setBusy(false); return; }
      saveIdentity({ ...id, nama: id.nama.trim(), email: id.email.trim() });
      rememberTicket({ token: j.token, code: j.code, issue: issue || cat?.nama || '', location: `Lt ${loc.lantai} · ${loc.nama}`, at: new Date().toISOString() });
      router.push(`/t/${j.token}?baru=1`);
    } catch {
      setFormError('Koneksi terputus. Periksa internet lalu kirim lagi.'); setBusy(false);
    }
  }

  async function meToo() {
    if (!dup) return;
    if (id.nama.trim().length < 2) { setEditId(true); setErrors(e => ({ ...e, reporterName: 'Isi nama dulu untuk menambahkan dukungan.' })); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/tickets/${dup.id}/me-too`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: id.nama.trim(), deviceId: deviceId(), turnstile: captcha }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setFormError(String(j.error ?? 'Gagal.').replace(/^[A-Z_]+: /, '')); setBusy(false); return; }
      saveIdentity({ ...id, nama: id.nama.trim() });
      rememberTicket({ token: j.token, code: j.code, issue: dup.issue || cat?.nama || '', location: `Lt ${loc.lantai} · ${loc.nama}`, at: new Date().toISOString() });
      router.push(`/t/${j.token}?dukung=1`);
    } catch { setFormError('Koneksi terputus. Coba lagi.'); setBusy(false); }
  }

  const floors = [...new Set(p.locations.map(l => l.lantai))].sort((a, b) => a - b);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface text-brand-text"><MapPin className="size-[18px]" aria-hidden /></div>
          <div className="min-w-0 flex-1">
            <b className="block font-bold">Lantai {loc.lantai} · {loc.nama}</b>
            <span className="text-xs text-muted"><Lock className="mr-1 inline size-3" aria-hidden />{loc.id === p.location.id ? `Terisi otomatis dari QR ${loc.kode}` : 'Lokasi dipilih manual'}</span>
          </div>
        </div>
        <div className="mt-1.5 flex justify-end"><button type="button" className="text-xs font-semibold text-brand-text hover:underline" onClick={() => setPickLoc(v => !v)}>{pickLoc ? 'Tutup' : 'Bukan lokasi ini?'}</button></div>
        {pickLoc && (
          <Field label="Pilih lokasi lain" htmlFor="f-loc">
            <Select id="f-loc" value={locId} onChange={e => { setLocId(e.target.value); setIssue(''); setCatId(''); setJenis(''); setPickLoc(false); setDupDismissed(false); }}>
              {floors.map(f => (
                <optgroup key={f} label={`Lantai ${f}`}>
                  {p.locations.filter(l => l.lantai === f).map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {chips.length > 0 && (
        <Field label={`Masalah umum di ${area?.nama ?? 'lokasi ini'}`} hint="Pilih salah satu, atau isi kategori dan deskripsi sendiri.">
          <div className="flex flex-wrap gap-1.5" role="group">
            {chips.map(q => (
              <button key={q.id} type="button" aria-pressed={issue === q.label} onClick={() => pickChip(q)}
                className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', issue === q.label ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface text-slate-700 hover:border-brand-300')}>
                {q.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Jenis laporan">
        <div className="grid grid-cols-2 gap-1.5" role="group">
          {JENIS.map(j => (
            <button key={j} type="button" aria-pressed={jenis === j} onClick={() => setJenis(j)}
              className={cx('rounded-xl border px-2.5 py-2 text-[13px] font-semibold', jenis === j ? 'border-brand-500 bg-brand-50 text-brand-text' : 'border-line bg-surface')}>{j}</button>
          ))}
        </div>
      </Field>

      <Field label="Kategori" htmlFor="f-cat" required error={errors.categoryId} hint={team ? `Diteruskan ke Tim ${team.nama}` : undefined}>
        <Select id="f-cat" value={catId} invalid={!!errors.categoryId} onChange={e => { setCatId(e.target.value); setDupDismissed(false); clearErr('categoryId'); if (!jenis) setJenis(jenisFor(p.categories.find(c => c.id === e.target.value)?.kode)); }}>
          <option value="">Pilih kategori</option>
          {p.categories.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
        </Select>
      </Field>

      {dup && !dupDismissed && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-text" aria-hidden />
          <div className="flex min-w-0 flex-col gap-2 text-sm">
            <div><b className="font-bold">Sudah dilaporkan.</b> {dup.code} · {dup.issue || cat?.nama}, {relTime(dup.created_at)}. Status <Chip tone={STATUS_TONE[dup.status]}>{statusText(dup)}</Chip>{dup.me_too_count > 0 && ` · ${dup.me_too_count + 1} orang mengalami`}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={meToo} loading={busy}><ThumbsUp className="size-3.5" aria-hidden />Saya juga mengalami</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setDupDismissed(true)}>Masalahnya berbeda</Button>
            </div>
          </div>
        </div>
      )}

      <Field label="Deskripsi" htmlFor="f-desc" required={!issue} error={errors.description}
        hint={issue ? 'Opsional, tambahkan detail posisi.' : 'Wajib jika tidak memilih masalah umum.'}>
        <Textarea id="f-desc" value={desc} maxLength={1000} invalid={!!errors.description} placeholder="Mis. bilik paling ujung, sejak pagi."
          onChange={e => { setDesc(e.target.value); clearErr('description'); }} />
      </Field>

      <Field label="Foto (maks 3)" hint={photos.length ? undefined : 'Disimpan di Google Drive kantor.'}>
        <PhotoPicker id="f-photo" photos={photos} onChange={setPhotos} onError={setFormError} />
      </Field>

      <Field label="Pelapor">
        {!editId ? (
          <>
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">{initials(id.nama)}</div>
              <div className="min-w-0 flex-1"><b className="block font-bold">{id.nama}</b><span className="text-xs text-muted">{id.divisi || '-'} · {id.wa}</span></div>
              <button type="button" className="text-xs font-semibold text-brand-text hover:underline" onClick={() => setEditId(true)}>Ubah</button>
            </div>
            {remembered && <span className="text-xs text-muted">Diingat dari laporan sebelumnya di HP ini. Tanpa login.</span>}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Nama" htmlFor="f-nama" required error={errors.reporterName}>
              <Input id="f-nama" autoComplete="name" value={id.nama} invalid={!!errors.reporterName} onChange={e => { setId({ ...id, nama: e.target.value }); clearErr('reporterName'); }} />
            </Field>
            <Field label="Divisi" htmlFor="f-div">
              <Select id="f-div" value={id.divisi} onChange={e => setId({ ...id, divisi: e.target.value })}>
                <option value="">Pilih divisi</option>
                {p.divisi.map(d => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="No WhatsApp" htmlFor="f-wa" required error={errors.reporterWa}>
              <Input id="f-wa" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812xxxxxxx" value={id.wa} invalid={!!errors.reporterWa} onChange={e => { setId({ ...id, wa: e.target.value }); clearErr('reporterWa'); }} />
            </Field>
          </div>
        )}
        <Field label="Email (opsional)" htmlFor="f-email" error={errors.reporterEmail} hint="Untuk kabar jadwal dan penyelesaian.">
          <Input id="f-email" type="email" inputMode="email" autoComplete="email" value={id.email} invalid={!!errors.reporterEmail} onChange={e => { setId({ ...id, email: e.target.value }); clearErr('reporterEmail'); }} />
        </Field>
      </Field>

      <Turnstile siteKey={p.turnstileSiteKey} onToken={onToken} />
      {formError && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-text" role="alert">{formError}</p>}
      <Button type="submit" block loading={busy}><Send className="size-4" aria-hidden />Kirim laporan</Button>
      <p className="text-center text-xs text-muted">Prioritas penanganan diatur oleh tim per kategori.</p>
    </form>
  );
}
