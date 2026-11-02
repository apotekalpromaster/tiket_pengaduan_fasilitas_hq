import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat detail tiket">
      <div className="flex flex-col gap-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-40" /></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-40 rounded-xl" /></div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
