/* One-time helper: copies the product images saved on this computer (public/uploads)
   into Neon, so the live site can show them. Safe to run more than once.
   Run from the project folder:  node upload-local-images.js
   It reads DATABASE_URL from your .env file. Nothing is printed that contains the password. */
const fs = require('fs');
const path = require('path');
const storage = require('./storage');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

(async () => {
  if (!storage.enabled()) { console.log('DATABASE_URL is not set. Add it to your .env file first.'); process.exit(1); }
  const dir = storage.UPLOAD_DIR;
  if (!fs.existsSync(dir)) { console.log('No folder found at ' + dir + ' - nothing to upload.'); process.exit(0); }
  const files = fs.readdirSync(dir).filter((f) => MIME[path.extname(f).toLowerCase()]);
  if (!files.length) { console.log('The uploads folder has no images.'); process.exit(0); }

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 15000 });
  await pool.query(`CREATE TABLE IF NOT EXISTS zupa_uploads (name text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);

  let added = 0, skipped = 0;
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const r = await pool.query(
      `INSERT INTO zupa_uploads (name, mime, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [f, MIME[path.extname(f).toLowerCase()], buf]);
    if (r.rowCount) { added++; console.log('uploaded ' + f); } else { skipped++; console.log('already in Neon: ' + f); }
  }
  await pool.end();
  console.log(`\nDone. ${added} uploaded, ${skipped} already there.`);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
