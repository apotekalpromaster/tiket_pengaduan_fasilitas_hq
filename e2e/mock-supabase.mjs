// Supabase tiruan untuk uji e2e lokal: PostgREST minimal di atas PGlite
// dengan migrasi asli (supabase/migrations). Hanya untuk pengujian.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('..', import.meta.url);
const db = new PGlite({ parsers: { 20: Number, 1700: Number } });
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text);`);
for (const f of ['0001_fasilitas_schema.sql', '0002_seed.sql']) await db.exec(readFileSync(new URL(`supabase/migrations/${f}`, root), 'utf8'));

const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return `"${s}"`; };
const table = s => `fasilitas.${ident(s)}`;

function where(params, args) {
  const parts = [];
  const add = (col, expr) => {
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is|ilike)\.(.*)$/s.exec(expr);
    if (!m) throw new Error('bad filter ' + expr);
    const [, not, op, raw] = m;
    const c = ident(col);
    let sql;
    if (op === 'is') sql = `${c} is ${raw === 'null' ? 'null' : raw === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const vals = raw.replace(/^\(|\)$/g, '').split(',').map(v => v.replace(/^"|"$/g, ''));
      sql = `${c}::text in (${vals.map(v => { args.push(v); return `$${args.length}`; }).join(',') || 'null'})`;
    } else {
      args.push(op === 'ilike' ? raw.replace(/\*/g, '%') : raw);
      const o = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ilike' }[op];
      sql = `${c}::text ${o} $${args.length}`;
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) sql = `${c} ${o} $${args.length}`;
    }
    parts.push(not ? `not (${sql})` : sql);
  };
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    if (k === 'or') {
      const ors = v.replace(/^\(|\)$/g, '').split(',').map(p => { const i = p.indexOf('.'); return [p.slice(0, i), p.slice(i + 1)]; });
      const sub = [];
      for (const [col, expr] of ors) { const before = parts.length; add(col, expr); sub.push(parts.pop()); parts.length = before; }
      parts.push(`(${sub.join(' or ')})`);
    } else add(k, v);
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}
function orderLimit(params) {
  const orders = params.getAll('order').flatMap(o => o.split(',')).map(o => { const [c, dir] = o.split('.'); return `${ident(c)} ${dir === 'desc' ? 'desc' : 'asc'}`; });
  const limit = params.get('limit');
  return (orders.length ? ` order by ${orders.join(', ')}` : '') + (limit ? ` limit ${Number(limit)}` : '');
}
const val = v => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);

async function handle(req, body) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__sql') return { status: 200, json: (await db.query(body.sql, body.args ?? [])).rows };
  if (url.pathname === '/auth/v1/user' && req.headers.authorization === 'Bearer e2e-access') {
    const [u] = (await db.query(`select id, email from auth.users where email = 'hendri@e2e.test'`)).rows;
    if (u) return { status: 200, json: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
  }
  if (url.pathname.startsWith('/auth/v1/')) return { status: 401, json: { code: 401, msg: 'no session' } };
  const m = /^\/rest\/v1\/(rpc\/)?([a-z_]+)$/.exec(url.pathname);
  if (!m) return { status: 404, json: { message: 'not found' } };
  const [, rpc, name] = m;
  const p = url.searchParams, args = [];
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const prefer = req.headers.prefer ?? '';
  if (rpc) {
    const keys = Object.keys(body ?? {});
    const r = await db.query(`select fasilitas.${ident(name)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(',')}) as r`, keys.map(k => body[k]));
    return { status: 200, json: r.rows[0]?.r ?? null };
  }
  let rows, count;
  if (req.method === 'GET' || req.method === 'HEAD') {
    const w = where(p, args);
    if (prefer.includes('count=exact')) count = (await db.query(`select count(*)::int n from ${table(name)}${w}`, args)).rows[0].n;
    rows = req.method === 'HEAD' ? [] : (await db.query(`select * from ${table(name)}${w}${orderLimit(p)}`, args)).rows;
  } else if (req.method === 'POST') {
    const list = Array.isArray(body) ? body : [body];
    rows = [];
    for (const o of list) {
      const keys = Object.keys(o);
      const conflict = prefer.includes('resolution=merge-duplicates') ? ` on conflict (${ident(p.get('on_conflict') ?? (name === 'holidays' ? 'tanggal' : 'id'))}) do update set ${keys.map(k => `${ident(k)} = excluded.${ident(k)}`).join(', ')}` : '';
      const r = await db.query(`insert into ${table(name)} (${keys.map(ident).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})${conflict} returning *`, keys.map(k => val(o[k])));
      rows.push(...r.rows);
    }
  } else if (req.method === 'PATCH') {
    const keys = Object.keys(body);
    keys.forEach(k => args.push(val(body[k])));
    const set = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(', ');
    rows = (await db.query(`update ${table(name)} set ${set}${where(p, args)} returning *`, args)).rows;
  } else if (req.method === 'DELETE') {
    rows = (await db.query(`delete from ${table(name)}${where(p, args)} returning *`, args)).rows;
  }
  const headers = count !== undefined ? { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${count}` } : {};
  if (single) {
    if (rows.length !== 1) return { status: 406, json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `Results contain ${rows.length} rows` } };
    return { status: 200, json: rows[0], headers };
  }
  if (req.method !== 'GET' && !prefer.includes('return=representation')) return { status: 201, json: null, headers };
  return { status: 200, json: rows, headers };
}

const port = Number(process.env.MOCK_PORT ?? 54329);
http.createServer((req, res) => {
  let data = '';
  req.on('data', c => (data += c));
  req.on('end', async () => {
    try {
      const out = await handle(req, data ? JSON.parse(data) : null);
      res.writeHead(out.status, { 'Content-Type': 'application/json', ...(out.headers ?? {}) });
      res.end(out.json === null && out.status === 201 ? '' : JSON.stringify(out.json));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: String(e.message), code: e.code }));
    }
  });
}).listen(port, '127.0.0.1', () => console.log(`mock supabase on ${port}`));
