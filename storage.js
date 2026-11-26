/* ZUPA storage — keeps the store's data in a Neon (PostgreSQL) database.
   How it works: on start-up the data is pulled from Neon into data/db.json (a local working copy);
   every save() pushes the new state back to Neon. Neon is the source of truth, so the data
   survives restarts, a closed terminal, or moving the site to another computer or host.
   Only used when DATABASE_URL is set; otherwise the site keeps using data/db.json alone. */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
let pool = null;
let timer = null, pushing = false, dirty = false, latest = null;

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
  const r = await pool.query(`SELECT data FROM zupa_state WHERE id = 'main'`);
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (r.rows.length) {
    fs.writeFileSync(DB_FILE, JSON.stringify(r.rows[0].data, null, 2));
    console.log('[ZUPA] Data loaded from Neon.');
  } else {
    if (!fs.existsSync(DB_FILE)) { console.log('[ZUPA] Neon is empty and no local data found: creating sample data…'); require('./seed.js'); }
    await pool.query(`INSERT INTO zupa_state (id, data) VALUES ('main', $1::jsonb)`, [fs.readFileSync(DB_FILE, 'utf8')]);
    console.log('[ZUPA] First run: your data was copied to Neon.');
  }
}

async function flush() {
  if (!pool || pushing || !dirty) return;
  pushing = true; dirty = false;
  try {
    await pool.query(`UPDATE zupa_state SET data = $1::jsonb, updated_at = now() WHERE id = 'main'`, [latest]);
  } catch (e) {
    dirty = true; // try again on the next save
    console.error('[ZUPA] Could not save to Neon:', e.message);
  } finally {
    pushing = false;
    if (dirty && !timer) timer = setTimeout(() => { timer = null; flush(); }, 2000);
  }
}
// Called by server.js after every change (debounced so bursts become one write)
function push(db) {
  if (!pool) return;
  latest = JSON.stringify(db); dirty = true;
  if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 120);
}
async function drain() { if (timer) { clearTimeout(timer); timer = null; } while (dirty || pushing) { await flush(); await new Promise((r) => setTimeout(r, 50)); } }

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

module.exports = { enabled, boot, push, putUpload, getUpload, UPLOAD_DIR };
