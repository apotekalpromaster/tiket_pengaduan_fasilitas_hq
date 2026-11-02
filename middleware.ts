import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Segarkan sesi Supabase dan arahkan tamu ke halaman login untuk /admin. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // Hanya untuk redirect tamu dan menyegarkan token kedaluwarsa (cookie baru ditulis lewat setAll).
  // getSession() tidak memanggil server bila token masih berlaku. Verifikasi sesungguhnya
  // dilakukan halaman lewat requireAdmin() → getClaims(), jadi tidak diulang di sini.
  const { data } = await supabase.auth.getSession();
  const user = Boolean(data.session);
  const path = req.nextUrl.pathname;
  if (!user && path.startsWith('/admin') && path !== '/admin/login') {
    const to = req.nextUrl.clone();
    to.pathname = '/admin/login';
    to.search = path === '/admin' ? '' : `?ke=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = { matcher: ['/admin/:path*'] };
