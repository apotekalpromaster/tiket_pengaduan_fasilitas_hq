import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="text-xl font-extrabold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted">Link mungkin salah ketik atau tiketnya sudah tidak tersedia.</p>
      <Link href="/r" className="font-semibold text-brand-text hover:underline">Buat laporan baru</Link>
    </main>
  );
}
