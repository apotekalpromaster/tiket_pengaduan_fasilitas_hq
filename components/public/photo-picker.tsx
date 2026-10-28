'use client';
import { useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { fmtKB } from '@/lib/format';

export interface Photo { blob: Blob; url: string; size: number }

/** Kecilkan foto di browser: sisi terpanjang 1600 px, JPEG 0,72 (biasanya 150–400 KB). */
export async function compressImage(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const img: CanvasImageSource & { width: number; height: number } = bitmap ?? await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Foto tidak bisa dibaca.')); i.src = URL.createObjectURL(file);
  });
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.72, blob: Blob | null = null;
  do { blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', q)); q -= 0.12; } while (blob && blob.size > 1_000_000 && q > 0.3);
  if (!blob) throw new Error('Foto tidak bisa diproses.');
  return { blob, url: URL.createObjectURL(blob), size: blob.size };
}

export function PhotoPicker({ id, photos, onChange, max = 3, onError, label = 'Ambil foto' }:
  { id: string; photos: Photo[]; onChange: (p: Photo[]) => void; max?: number; onError?: (m: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(photos);
  latest.current = photos;
  useEffect(() => () => latest.current.forEach(p => URL.revokeObjectURL(p.url)), []);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - photos.length);
    e.target.value = '';
    const out: Photo[] = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); } catch { onError?.('Salah satu foto tidak bisa dibaca. Coba foto lain.'); }
    }
    onChange([...photos, ...out].slice(0, max));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p.url} className="relative size-[76px] overflow-hidden rounded-xl border border-line bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            <button type="button" aria-label={`Hapus foto ${i + 1}`} onClick={() => { URL.revokeObjectURL(p.url); onChange(photos.filter((_, j) => j !== i)); }}
              className="absolute right-1 top-1 grid size-[22px] place-items-center rounded-full bg-slate-900 text-white"><X className="size-3" /></button>
          </div>
        ))}
        {photos.length < max && (
          <label htmlFor={id} className="flex size-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-[11px] font-semibold text-muted hover:border-brand-400 hover:text-brand-text">
            <Camera className="size-5" aria-hidden />{label}
          </label>
        )}
      </div>
      <input ref={input} id={id} type="file" accept="image/*" capture="environment" multiple={max > 1} hidden onChange={onFiles} />
      {photos.length > 0 && <span className="text-xs text-muted">Dikompres otomatis · {fmtKB(photos.reduce((s, p) => s + p.size, 0))}</span>}
    </div>
  );
}
