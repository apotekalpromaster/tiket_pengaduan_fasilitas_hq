import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { requireAdmin } from '@/lib/auth';
import { getRefData } from '@/lib/data';
import { env } from '@/lib/env';
import { Callout, PageHeader, Tabs } from '@/components/ui';
import { PrintButton } from '@/components/admin/print-button';

export const metadata: Metadata = { title: 'Stiker QR' };

export default async function QrPage({ searchParams }: { searchParams: Promise<{ lantai?: string }> }) {
  await requireAdmin(['super_admin', 'admin']);
  const sp = await searchParams;
  const ref = await getRefData();
  const floors = [...new Set(ref.locations.map(l => l.lantai))].sort((a, b) => a - b);
  const lantai = sp.lantai && /^-?\d+$/.test(sp.lantai) ? Number(sp.lantai) : null;
  const locs = ref.locations.filter(l => l.aktif && (lantai === null || l.lantai === lantai));
  const items = await Promise.all(locs.map(async l => ({
    l, url: `${env.baseUrl}/r/${l.kode}`,
    svg: await QRCode.toString(`${env.baseUrl}/r/${l.kode}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#0f172a', light: '#ffffff' } }),
  })));

  return (
    <>
      <div className="no-print flex flex-col gap-4">
        <PageHeader title="Stiker QR" subtitle={`${locs.length} titik · isi QR: ${env.baseUrl}/r/[kode]`} action={<PrintButton />} />
        <Tabs items={[{ href: '/admin/qr', label: 'Semua', active: lantai === null, count: ref.locations.filter(l => l.aktif).length },
          ...floors.map(f => ({ href: `/admin/qr?lantai=${f}`, label: `Lantai ${f}`, active: lantai === f, count: ref.locations.filter(l => l.aktif && l.lantai === f).length }))]} />
        {env.baseUrl.includes('localhost') && <Callout tone="amber">APP_BASE_URL masih localhost. Isi domain produksi di Vercel sebelum mencetak stiker.</Callout>}
        <p className="text-xs text-muted">Ukuran stiker 63 × 88 mm, 9 per lembar A4. Gunakan vinyl tahan air untuk toilet dan tempat wudhu. Pilih &quot;Simpan sebagai PDF&quot; di dialog cetak bila ingin dikirim ke percetakan.</p>
      </div>
      <style>{`
        .sheet { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .sticker { background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; break-inside: avoid; }
        .sticker .qr svg { width: 132px; height: 132px; display: block; }
        @media print {
          @page { size: A4; margin: 10mm; }
          .sheet { grid-template-columns: repeat(3, 63mm); grid-auto-rows: 88mm; gap: 3mm; justify-content: center; }
          .sticker { border: 0.3mm dashed #94a3b8; border-radius: 3mm; padding: 4mm 3mm; justify-content: space-between; }
          .sticker .qr svg { width: 40mm; height: 40mm; }
        }
      `}</style>
      <div className="sheet">
        {items.map(({ l, svg }) => (
          <div key={l.id} className="sticker">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-alpro.png" alt="" width={22} height={22} className="rounded-full bg-white" />Lapor Fasilitas
            </div>
            <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="w-full border-t-2 border-[#f97316] pt-1.5">
              <b className="block text-[13px] leading-[18px]">{l.nama}</b>
              <span className="block text-[10px] text-[#475569]">Lantai {l.lantai} · {l.kode}</span>
              <span className="block text-[10px] text-[#475569]">Scan untuk lapor kerusakan atau kebutuhan</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
