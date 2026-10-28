import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, assertSupabaseEnv } from '../env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, 'fasilitas', 'fasilitas'>;
let client: Db | null = null;

/** Client service-role ke schema `fasilitas`. Hanya dipakai di server. */
export function db(): Db {
  if (!client) {
    assertSupabaseEnv();
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      db: { schema: 'fasilitas' },
      auth: { persistSession: false, autoRefreshToken: false },
    }) as Db;
  }
  return client;
}

/** Lempar galat bila query Supabase gagal; kembalikan data. */
export function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`DB: ${what} gagal (${r.error.message})`);
  return r.data as T;
}
