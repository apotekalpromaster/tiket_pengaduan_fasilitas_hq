import { PublicHeader } from '@/components/public/header';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-4">{children}</main>
    </>
  );
}
