import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { ROLE_LABEL } from '@/lib/labels';
import { AdminShell, type NavItem } from '@/components/admin/shell';
import { signOut } from '../login/actions';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin(undefined, { allowPasswordChange: true });
  let q = db().from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'BARU');
  if (admin.role === 'admin' && admin.team_id) q = q.eq('team_id', admin.team_id);
  const { count } = await q;
  const nav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: 'dash' },
    { href: '/admin/tiket', label: 'Tiket', icon: 'tiket', badge: admin.role === 'teknisi' ? undefined : count ?? 0 },
    { href: '/admin/jadwal', label: 'Jadwal', icon: 'jadwal' },
    { href: '/admin/laporan', label: 'Laporan', icon: 'laporan' },
    ...(admin.role === 'super_admin' || admin.role === 'admin' ? [
      { href: '/admin/qr', label: 'Stiker QR', icon: 'qr' as const },
      { href: '/admin/master', label: 'Master data', icon: 'master' as const },
    ] : []),
    { href: '/admin/profil', label: 'Profil', icon: 'profil' },
  ];
  return <AdminShell nav={nav} user={{ nama: admin.nama, peran: ROLE_LABEL[admin.role] }} signOut={signOut}>{children}</AdminShell>;
}
