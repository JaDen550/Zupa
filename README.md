# ZUPA

**Your everyday shopping destination.** A single-retailer e-commerce platform for Sierra Leone.

ZUPA owns its catalogue, stock, prices, orders, payments and deliveries (no marketplace). Currency is the new Leone (NLe); the data model is ready for more currencies and locations.

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (Neon) through Prisma 6 |
| Auth (Phase 3) | Server-side sessions, hashed tokens, bcrypt passwords |
| Images (Phase 4) | Cloudinary |
| Payments (Phase 5) | Monime adapter (awaiting official docs), cash on delivery, manual verification |

Status: **Phase 1 (foundation)**. See [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) for what is done, what is not, and known issues, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions.

---

## First-time setup (Windows, PowerShell)

Requirements: Node.js 20+ (you have 24), Git, and a free [Neon](https://neon.tech) account.

### 1. Create the Next.js base project

Run this **once**, in the folder where you keep projects (not inside another project):

```powershell
npx create-next-app@latest zupa-web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

### 2. Copy the ZUPA files over it

Extract the `zupa-web` folder from the zip **on top of** the one you just created, choosing **Replace** when asked. Then:

```powershell
cd zupa-web
node scripts/configure-project.mjs
npm install prisma@6 @prisma/client@6 zod@3 bcryptjs
npm install -D tsx
```

### 3. Create the Neon database

1. Sign in at neon.tech → **Create project** (name it `zupa`, pick the region closest to you).
2. On the project dashboard click **Connect**. Copy the **pooled** connection string and the **direct** connection string (turn the "Connection pooling" toggle on/off to get each).
3. Create your private settings file:
   ```powershell
   copy .env.example .env
   ```
4. Open `.env` in a text editor and fill in `DATABASE_URL`, `DIRECT_URL` and `SESSION_SECRET`.
   Generate the secret with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

> `.env` holds passwords. It is ignored by Git. Never commit it, screenshot it or paste it into chats.

### 4. Create the tables and load sample data

```powershell
npx prisma validate
npm run db:migrate -- --name init
npm run db:seed
```

`db:seed` prints the admin email and a one-time random password. **Save it immediately.**

### 5. Run it

```powershell
npm run dev
```

Open <http://localhost:3000>. You should see the ZUPA status page showing **Database connected** with 13 categories, 26 products and 5 delivery zones. <http://localhost:3000/api/health> should return `{"status":"ok","db":"up"}`.

To browse the data: `npm run db:studio`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:validate` | Validate `prisma/schema.prisma` |
| `npm run db:migrate -- --name <name>` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:seed` | Load sample data (safe to re-run) |
| `npm run db:studio` | Visual database browser |
| `npm run db:reset` | **Erase everything**, re-migrate and re-seed (development only) |

## Folder structure

```
prisma/            schema.prisma, migrations/, seed.ts
src/app/           routes (App Router) and route handlers under api/
src/components/    reusable UI (brand/, later ui/, shop/, admin/)
src/lib/           db.ts (Prisma client), env.ts (validated config), money.ts
scripts/           one-off project scripts
docs/              architecture notes
```

Later phases add `src/server/` (business logic: orders, payments, inventory), `src/lib/auth`, `src/lib/rbac.ts` and `src/lib/payments/`.

## Security rules for this project

- Secrets live only in `.env` (local) or the hosting provider's environment settings. Never in code, Git or the browser.
- Anything under `src/lib/env.ts` is server-only.
- Money is always integer minor units (NLe 12.50 = 1250).
- A payment is marked **paid** only after server-side verified confirmation. Nothing the browser says can mark an order paid.
- Admin routes are protected on the server (Phase 3/4); hiding a button is never the protection.

## Deploying (outline, finalised in Phase 6)

1. Push to a private Git repository (secrets stay out).
2. Create a Vercel (or similar) project; add the same environment variables.
3. Run `npm run db:deploy` against the production database.
4. Use a separate Neon branch/database for production and for testing.
