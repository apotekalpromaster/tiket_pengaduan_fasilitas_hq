import 'server-only';

const v = (k: string) => (process.env[k] ?? '').trim();

export const env = {
  supabaseUrl: v('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: v('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: v('SUPABASE_SERVICE_ROLE_KEY'),
  baseUrl: (v('APP_BASE_URL') || 'http://localhost:3000').replace(/\/$/, ''),
  google: {
    email: v('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    // Vercel menyimpan newline sebagai "\n" literal.
    key: v('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    folderId: v('GOOGLE_DRIVE_FOLDER_ID'),
  },
  smtp: {
    host: v('SMTP_HOST'), port: Number(v('SMTP_PORT') || 465), user: v('SMTP_USER'), pass: v('SMTP_PASS'),
    from: v('MAIL_FROM') || 'Tiket Fasilitas HQ <noreply@apotekalpro.id>',
  },
  opsEmail: v('MAIL_OPS_TO') || 'operation@apotekalpro.id',
  telegram: { token: v('TELEGRAM_BOT_TOKEN'), secret: v('TELEGRAM_WEBHOOK_SECRET') },
  turnstile: { siteKey: v('NEXT_PUBLIC_TURNSTILE_SITE_KEY'), secret: v('TURNSTILE_SECRET_KEY') },
  cronSecret: v('CRON_SECRET'),
  ipSalt: v('IP_HASH_SALT') || v('SUPABASE_SERVICE_ROLE_KEY').slice(-16),
};

/** Integrasi aktif hanya bila env lengkap; selain itu dilewati dengan aman. */
export const integrations = {
  drive: Boolean(env.google.email && env.google.key && env.google.folderId),
  email: Boolean(env.smtp.host && env.smtp.user && env.smtp.pass),
  telegram: Boolean(env.telegram.token),
  turnstile: Boolean(env.turnstile.secret && env.turnstile.siteKey),
};

export function assertSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('CONFIG: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi.');
  }
}
