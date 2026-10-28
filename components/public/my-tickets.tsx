'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { List } from 'lucide-react';
import { Chip, EmptyState, Skeleton } from '../ui';
import { loadMine, type MyTicket } from '@/lib/local';
import { relTime } from '@/lib/format';
import { STATUS_TONE, statusText } from '@/lib/labels';
import type { Status } from '@/lib/types';

interface Row { public_token: string; code: string; issue: string | null; status: Status; wait_reason: 'approval' | 'part' | null; location: string; category: string; created_at: string }

export function MyTickets() {
  const [mine, setMine] = useState<MyTicket[] | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  useEffect(() => {
    const m = loadMine(); setMine(m);
    if (!m.length) return;
    fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: m.map(x => x.token) }) })
      .then(r => r.json()).then((j: { tickets: Row[] }) => setRows(Object.fromEntries(j.tickets.map(t => [t.public_token, t])))).catch(() => {});
  }, []);
  if (mine === null) return <div className="flex flex-col gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (!mine.length) return <EmptyState icon={<List className="size-5" />} title="Belum ada laporan">Laporan yang Anda kirim dari HP ini akan muncul di sini.</EmptyState>;
  return (
    <div className="flex flex-col gap-2">
      {mine.map(m => {
        const r = rows[m.token];
        return (
          <Link key={m.token} href={`/t/${m.token}`} className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 hover:border-brand-300">
            <div className="flex items-center justify-between gap-2"><span className="num text-xs text-muted">{m.code}</span>{r && <Chip tone={STATUS_TONE[r.status]}>{statusText(r)}</Chip>}</div>
            <b className="font-bold">{r?.issue || m.issue || r?.category}</b>
            <span className="text-xs text-muted">{r?.location || m.location} · {relTime(r?.created_at ?? m.at)}</span>
          </Link>
        );
      })}
    </div>
  );
}
