import { Skeleton } from '@/components/ui';

/** Tampil seketika saat pindah menu, sementara data dimuat. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat">
      <div className="flex flex-col gap-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-40" /></div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}
