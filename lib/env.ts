import 'server-only';

const v = (k: string) => (process.env[k] ?? '').trim();

export const env = {
  supabaseUrl: v('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: v('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: v('SUPABASE_SERVICE_ROLE_KEY'),
  baseUrl: (v('APP_BASE_URL') || 'http://localhost:3000').replace(/\/$/, ''),
  // Google Apps Script Web App (apps-script/Code.gs) yang menyimpan foto ke Drive.
  drive: { url: v('DRIVE_SCRIPT_URL'), secret: v('DRIVE_SCRIPT_SECRET') },
  smtp: {
    host: v('SMTP_HOST') || 'smtp.gmail.com', port: Number(v('SMTP_PORT') || 465), user: v('SMTP_USER'),
    // App Password Gmail ditampilkan berspasi ("abcd efgh ..."); spasi dibuang.
    pass: v('SMTP_PASS').replace(/\s+/g, ''),
    // Gmail mengganti From yang berbeda dari akun login, jadi bawaannya akun SMTP itu sendiri.
    from: v('MAIL_FROM') || `Tiket Fasilitas HQ <${v('SMTP_USER')}>`,
  },
  opsEmail: v('MAIL_OPS_TO') || 'operation@apotekalpro.id',
  telegram: { token: v('TELEGRAM_BOT_TOKEN'), secret: v('TELEGRAM_WEBHOOK_SECRET') },
  turnstile: { siteKey: v('NEXT_PUBLIC_TURNSTILE_SITE_KEY'), secret: v('TURNSTILE_SECRET_KEY') },
  cronSecret: v('CRON_SECRET'),
  ipSalt: v('IP_HASH_SALT') || v('SUPABASE_SERVICE_ROLE_KEY').slice(-16),
};

/** Integrasi aktif hanya bila env lengkap; selain itu dilewati dengan aman. */
export const integrations = {
  drive: Boolean(env.drive.url && env.drive.secret),
  email: Boolean(env.smtp.user && env.smtp.pass),
  telegram: Boolean(env.telegram.token),
  turnstile: Boolean(env.turnstile.secret && env.turnstile.siteKey),
};

/** URL Web App yang benar berakhiran /exec (bukan /dev, bukan link editor). */
export const driveUrlLooksRight = () => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.drive.url);

export function assertSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('CONFIG: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi.');
  }
}
