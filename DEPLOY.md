# ZUPA: connect Neon and keep the site online

## Why the site stops when you close the terminal
`node server.js` runs the website *inside* that terminal window. Close it (or shut the laptop) and the site stops.
To have it always on, it must run on a hosting service (a computer that never sleeps), with its data in Neon.

## Part 1: Connect Neon (on your laptop)
1. Neon dashboard → your project → **Connect** → copy the **pooled** connection string (it starts with `postgresql://`).
2. In the `zupa` folder: copy `.env.example` to `.env` (PowerShell: `copy .env.example .env`), open `.env` in Notepad and paste the string after `DATABASE_URL=`.
   - `.env` is private. Never paste it in chat, email or GitHub (`.gitignore` already protects it).
3. Run:
   ```
   npm install
   $env:PORT=3001
   node server.js
   ```
4. You should see `[ZUPA] First run: your data was copied to Neon.` From now on every product, order, user and uploaded image is saved in Neon. You can delete `data/db.json` and nothing is lost.

## Part 2: Put the site online (so it runs 24/7)
Any Node.js host works. Example with Render (render.com, free plan available; menu names may change slightly):
1. Put the project on GitHub as a **private** repository (the `.gitignore` keeps `.env`, `data/` and `node_modules/` out).
2. Render → **New → Web Service** → pick the repository.
   - Build command: `npm install`
   - Start command: `node server.js`
   - Environment variable: `DATABASE_URL` = your Neon string (paste it in Render's settings, not in the code)
3. Deploy. Render gives you an address like `https://zupa-xxxx.onrender.com` with HTTPS.
4. Phone app: Account → **Server address** → enter that https address.

Notes
- Free plans on most hosts "sleep" after ~15 minutes without visitors; the first visit then takes ~30 seconds. A paid plan removes that.
- Run **one** copy of the server only (the data is saved as one document in Neon).
- This keeps your current data model in Neon. The fully relational Neon design (`zupa-web`, Next.js + Prisma) is the long-term target; this step makes today's site persistent and hostable.
