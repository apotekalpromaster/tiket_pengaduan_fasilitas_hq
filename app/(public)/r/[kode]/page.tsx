import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getRefData } from '@/lib/data';
import { env } from '@/lib/env';
import { ReportForm } from '@/components/public/report-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ kode: string }> }): Promise<Metadata> {
  const { kode } = await params;
  return { title: `Lapor · ${kode.toUpperCase()}` };
}

export default async function ReportPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const ref = await getRefData();
  const location = ref.locations.find(l => l.kode === decodeURIComponent(kode).toUpperCase() && l.aktif);
  if (!location) redirect('/r?e=lokasi');
  return (
    <ReportForm
      location={location}
      locations={ref.locations.filter(l => l.aktif)}
      areaTypes={ref.areaTypes}
      categories={ref.categories.filter(c => c.aktif)}
      quickIssues={ref.quickIssues.filter(q => q.aktif)}
      teams={ref.teams}
      divisi={ref.settings.divisi}
      turnstileSiteKey={env.turnstile.secret ? env.turnstile.siteKey : ''}
    />
  );
}
