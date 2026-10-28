import { Callout, PageHeader, Tabs } from '../ui';

const ALL = [
  { href: '/admin/master/lokasi', label: 'Lokasi', roles: ['super_admin', 'admin'] },
  { href: '/admin/master/masalah', label: 'Tipe area & masalah umum', roles: ['super_admin', 'admin'] },
  { href: '/admin/master/kategori', label: 'Kategori & SLA', roles: ['super_admin'] },
  { href: '/admin/master/tim', label: 'Tim', roles: ['super_admin'] },
  { href: '/admin/master/admin', label: 'Akun admin', roles: ['super_admin'] },
  { href: '/admin/master/libur', label: 'Hari libur', roles: ['super_admin'] },
  { href: '/admin/master/pengaturan', label: 'Pengaturan', roles: ['super_admin'] },
];

export function MasterHeader({ active, role, title, subtitle, ok, error }: { active: string; role: string; title: string; subtitle?: string; ok?: string; error?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Tabs items={ALL.filter(i => i.roles.includes(role)).map(i => ({ href: i.href, label: i.label, active: i.href.endsWith(active) }))} />
      {error && <Callout tone="red">{error}</Callout>}
      {ok && <Callout tone="emerald">{ok}</Callout>}
    </>
  );
}
