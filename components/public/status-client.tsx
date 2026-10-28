'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Lock, Star, ThumbsUp } from 'lucide-react';
import { Button, Textarea, cx } from '../ui';
import { rememberTicket, type MyTicket } from '@/lib/local';

/** Simpan tiket ke "Laporan saya" saat halaman dibuka (mis. dari link email). */
export function RememberTicket(t: MyTicket) {
  useEffect(() => { rememberTicket(t); }, [t]);
  return null;
}

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const select = () => { if (!ref.current) return; const r = document.createRange(); r.selectNodeContents(ref.current); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500); } catch { select(); }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
      <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
      <span ref={ref} className="min-w-0 flex-1 break-all text-xs">{url}</span>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>{done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? 'Tersalin' : 'Salin'}</Button>
    </div>
  );
}

export function ConfirmPanel({ token, autoClose }: { token: string; autoClose: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'ok' | 'belum'>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function send() {
    setBusy(true); setErr('');
    const body = mode === 'ok' ? { result: 'ok', rating, feedback: text } : { result: 'belum', note: text };
    const r = await fetch(`/api/t/${token}/konfirmasi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setErr(String(j.error ?? 'Koneksi terputus. Coba lagi.').replace(/^[A-Z_]+: /, '')); setBusy(false); return; }
    router.refresh();
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <b className="font-bold">Apakah masalahnya sudah beres?</b>
      {autoClose && <span className="text-xs text-muted">Tanpa jawaban, tiket otomatis Closed {autoClose}.</span>}
      {mode === null && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => setMode('ok')}><ThumbsUp className="size-4" aria-hidden />Sudah beres</Button>
          <Button type="button" variant="secondary" onClick={() => setMode('belum')}>Belum</Button>
        </div>
      )}
      {mode === 'ok' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1" role="group" aria-label="Penilaian">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" aria-pressed={n <= rating} aria-label={`${n} bintang`} onClick={() => setRating(n)} className={cx('p-0.5', n <= rating ? 'text-brand-500' : 'text-slate-400')}>
                <Star className="size-7" fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <Textarea id="f-fb" placeholder="Masukan untuk tim (opsional)" value={text} maxLength={500} onChange={e => setText(e.target.value)} />
          <Button type="button" onClick={send} loading={busy}>Kirim penilaian</Button>
        </div>
      )}
      {mode === 'belum' && (
        <div className="flex flex-col gap-3">
          <Textarea id="f-no" placeholder="Apa yang masih bermasalah?" value={text} maxLength={500} onChange={e => setText(e.target.value)} />
          <Button type="button" onClick={send} loading={busy} disabled={text.trim().length < 3}>Kirim ke tim</Button>
        </div>
      )}
      {err && <p className="text-sm text-red-text" role="alert">{err}</p>}
    </section>
  );
}
