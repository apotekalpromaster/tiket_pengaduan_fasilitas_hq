import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat tiket">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[232px] shrink-0 flex-col gap-2 rounded-xl border border-line bg-slate-50 p-2">
            <Skeleton className="h-6 w-24" /><Skeleton className="h-24 rounded-[10px]" /><Skeleton className="h-24 rounded-[10px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
