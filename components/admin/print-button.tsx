'use client';
import { Printer } from 'lucide-react';
import { Button } from '../ui';

export function PrintButton() {
  return <Button type="button" variant="soft" onClick={() => window.print()}><Printer className="size-4" aria-hidden />Cetak / simpan PDF</Button>;
}
