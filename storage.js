/* ZUPA storage — keeps the store's data in a Neon (PostgreSQL) database.
   How it works: on start-up the data is pulled from Neon into data/db.json (a local working copy);
   every save() pushes the new state back to Neon. Neon is the source of truth, so the data
   survives restarts, a closed terminal, or moving the site to another computer or host.
   Only used when DATABASE_URL is set; otherwise the site keeps using data/db.json alone.

   Stale-copy protection: two copies of the server (e.g. Render + a laptop) must never overwrite each other.
   - every write is conditional: it only succeeds if Neon still has the version this copy last saw;
   - if Neon changed meanwhile, both versions are merged (three-way, by record id) instead of overwritten;
   - API requests first check (at most every 5 s) whether Neon has newer data and merge it in. */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
let pool = null;
let timer = null, pushing = false, dirty = false, latest = null;
let base = null, knownAt = null;      // last document / version stamp this copy has seen in Neon
let getDb = null, applyDb = null;     // set by server.js through bind()
let checking = null, lastCheck = 0;

/* ---- three-way merge: base = last synced, ours = this copy now, theirs = Neon now ---- */
function eq(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => k in b && eq(a[k], b[k]));
}
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const hasIds = (arr) => arr.every((x) => isObj(x) && typeof x.id === 'string');
function merge3(b, o, t) {
  if (eq(o, b)) return t;               // we changed nothing here: take Neon's
  if (eq(t, b)) return o;               // Neon changed nothing here: keep ours
  if (eq(o, t)) return o;
  if (isObj(b) && isObj(o) && isObj(t)) {
    const out = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)])) {
      const v = merge3(b[k], o[k], t[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(b) && Array.isArray(o) && Array.isArray(t)) {
    if (hasIds(b) && hasIds(o) && hasIds(t)) {     // lists of records: merge record by record
      const by = (arr) => new Map(arr.map((x) => [x.id, x]));
      const B = by(b), O = by(o), T = by(t), out = [], seen = new Set();
      for (const x of t) { // keep Neon's order
        seen.add(x.id);
        if (B.has(x.id) && !O.has(x.id)) continue;                 // we deleted it
        out.push(O.has(x.id) ? merge3(B.get(x.id), O.get(x.id), x) : x);
      }
      for (const x of o) if (!seen.has(x.id) && !B.has(x.id)) out.push(x); // we added it
      return out;
    }
    if (b.every((x) => typeof x !== 'object') && o.every((x) => typeof x !== 'object') && t.every((x) => typeof x !== 'object')) {
      const removed = new Set(b.filter((x) => !o.includes(x)));     // plain lists (e.g. category names): set merge
      const out = t.filter((x) => !removed.has(x));
      for (const x of o) if (!b.includes(x) && !out.includes(x)) out.push(x);
      return out;
    }
  }
  return o;                              // both changed the same thing differently: ours wins
}

function loadDotEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file: fine */ }
}
loadDotEnv();
const enabled = () => !!process.env.DATABASE_URL;

async function boot() {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 15000 });
  await pool.query(`CREATE TABLE IF NOT EXISTS zupa_state (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS zupa_uploads (name text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  const r = await pool.query(`SELECT data, updated_at::text AS at FROM zupa_state WHERE id = 'main'`);
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (r.rows.length) {
    fs.writeFileSync(DB_FILE, JSON.stringify(r.rows[0].data, null, 2));
    base = r.rows[0].data; knownAt = r.rows[0].at;
    console.log('[ZUPA] Data loaded from Neon.');
  } else {
    if (!fs.existsSync(DB_FILE)) { console.log('[ZUPA] Neon is empty and no local data found: creating sample data…'); require('./seed.js'); }
    const ins = await pool.query(`INSERT INTO zupa_state (id, data) VALUES ('main', $1::jsonb) RETURNING updated_at::text AS at`, [fs.readFileSync(DB_FILE, 'utf8')]);
    base = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); knownAt = ins.rows[0].at;
    console.log('[ZUPA] First run: your data was copied to Neon.');
  }
}

/* Merge a copy of Neon's document into this server's memory (synchronous, so nothing can slip in between). */
function mergeIn(remote, at) {
  const live = JSON.parse(JSON.stringify(getDb()));
  const merged = merge3(base, live, remote);
  applyDb(merged);
  base = remote; knownAt = at;
  latest = JSON.stringify(merged);
  dirty = !eq(merged, remote);           // anything Neon doesn't have yet must still be saved
}
async function pullAndMerge() {
  const r = await pool.query(`SELECT data, updated_at::text AS at FROM zupa_state WHERE id = 'main'`);
  if (r.rows.length) mergeIn(r.rows[0].data, r.rows[0].at);
  return r.rows.length > 0;
}

async function flush() {
  if (!pool || pushing || !dirty) return;
  pushing = true; dirty = false;
  const sent = latest;
  let retryMs = 2000;
  try {
    const r = await pool.query(
      `UPDATE zupa_state SET data = $1::jsonb, updated_at = now() WHERE id = 'main' AND updated_at::text = $2 RETURNING updated_at::text AS at`,
      [sent, knownAt]);
    if (r.rowCount) { knownAt = r.rows[0].at; base = JSON.parse(sent); }
    else if (getDb && applyDb) {         // Neon changed since we last looked: merge, then save the merged result
      retryMs = 50; // save the merged result right away
      if (await pullAndMerge()) console.log('[ZUPA] Another copy changed the data: both versions were merged.');
      else { const ins = await pool.query(`INSERT INTO zupa_state (id, data) VALUES ('main', $1::jsonb) RETURNING updated_at::text AS at`, [sent]); knownAt = ins.rows[0].at; base = JSON.parse(sent); }
    } else dirty = true;
  } catch (e) {
    dirty = true; // try again on the next save
    console.error('[ZUPA] Could not save to Neon:', e.message);
  } finally {
    pushing = false;
    if (dirty && !timer) timer = setTimeout(() => { timer = null; flush(); }, retryMs);
  }
}
// Called by server.js after every change (debounced so bursts become one write)
function push(db) {
  if (!pool) return;
  latest = JSON.stringify(db); dirty = true;
  if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 120);
}
async function drain() { if (timer) { clearTimeout(timer); timer = null; } for (let i = 0; (dirty || pushing) && i < 40; i++) { await flush(); await new Promise((r) => setTimeout(r, 50)); } }

/* server.js hands over how to read and replace its in-memory data */
function bind(get, apply) { getDb = get; applyDb = apply; }

/* Called before API requests: if Neon has newer data than this copy, merge it in (checked at most every 5 s). */
function refresh() {
  if (!pool || !getDb || pushing || dirty) return Promise.resolve();
  if (checking) return checking;
  if (Date.now() - lastCheck < 5000) return Promise.resolve();
  checking = (async () => {
    try {
      const r = await pool.query(`SELECT updated_at::text AS at FROM zupa_state WHERE id = 'main'`);
      if (r.rows.length && r.rows[0].at !== knownAt && !pushing && !dirty) await pullAndMerge();
    } catch (e) { console.error('[ZUPA] Freshness check failed:', e.message); }
    finally { lastCheck = Date.now(); checking = null; }
  })();
  return checking;
}

async function putUpload(name, mime, buf) {
  if (!pool) return;
  await pool.query(`INSERT INTO zupa_uploads (name, mime, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`, [name, mime, buf]);
}
async function getUpload(name) {
  if (!pool) return null;
  const r = await pool.query(`SELECT mime, data FROM zupa_uploads WHERE name = $1`, [name]);
  return r.rows[0] || null;
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { try { await drain(); } finally { process.exit(0); } });
}

module.exports = { enabled, boot, push, bind, refresh, putUpload, getUpload, UPLOAD_DIR, _merge3: merge3 };
