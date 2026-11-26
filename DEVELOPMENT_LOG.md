# ZUPA Development Log

Rule for this log: nothing is marked **Verified** unless it was actually run.

## Phase 1: Project foundation

### Done and verified (in the authoring workspace)
- Database schema `prisma/schema.prisma`: 34 models, 16 enums. All 24 tables from the brief plus Session, Currency, StockMovement, OrderStatusHistory, ProductSpecification, Banner, PromotionRedemption, WebhookEvent, SupportTicket, SupportMessage.
  - Verified with a custom lint: balanced braces, every relation has its opposite side, foreign-key fields exist, one-to-one keys are unique, enum defaults are valid.
- Seed `prisma/seed.ts` (13 categories, 26 sample products with stock and specifications, 5 delivery zones, sample rider, `WELCOME10` promotion, platform settings, super-admin).
  - Verified by dry-run against an in-memory fake database: counts, unique SKUs/slugs, valid categories, integer prices, safe to re-run, admin password hashed with bcrypt cost 12.
- `src/lib/money.ts` unit-tested (formatting, parsing, rejection of bad input).
- `src/lib/env.ts` tested: rejects bad config, accepts good config.
- `src/lib/*.ts` type-checks with `tsc --strict`.
- Status page server-renders correctly for: DB connected, DB down (dev), DB down (production, no error leakage).
- `scripts/configure-project.mjs` tested on a fake project, and is safe to run twice.

### NOT yet verified (needs a run on the developer machine)
- `npx prisma validate` and `npm run db:migrate` against Neon (Prisma and Postgres are not available in the authoring workspace).
- `npm run dev` / `npm run build` with real Next.js and Tailwind (styling has not been seen rendered).
- `npm run db:seed` against real PostgreSQL.
- `npm run typecheck` for the `.tsx` files and Prisma-typed code.

### Decisions
- Prisma pinned to v6 for a predictable setup; `directUrl` supports Neon pooled + direct connections.
- Money stored as integer minor units; currency exponent in the `currencies` table.
- Own session auth with hashed tokens rather than a third-party auth library (decided in Phase 3 review).
- Products are single-SKU for now (no variants). Add a `ProductVariant` model when a real need appears.

### Outstanding / next
- **Phase 2**: design system components (buttons, inputs, cards, nav), responsive header/footer, real homepage layout with banners.
- **Phase 3**: registration/login/sessions, catalogue, search, filters, product page, cart, wishlist, checkout.
- **Phase 4**: admin dashboard (RBAC, products, inventory, orders, customers, reports, audit logs, settings).
- **Phase 5**: delivery management; Monime adapter (blocked on official docs + credentials); COD and manual-verification flows.
- **Phase 6**: automated tests, security review (rate limiting, CSP/HSTS), responsive checks, deployment.

### Known issues / caveats
- Sample prices, stock and delivery fees are placeholders for development.
- No product photos yet: the Cloudinary upload flow is Phase 4. Real product photography must be supplied or shot.
- Delivery zone fees, free-delivery thresholds and neighbourhood lists need the business's real values.
- Monime: no endpoints, keys or signing rules are assumed anywhere in the code.
- The earlier Express/mobile prototype (`zupa` folder) is separate and still runs on `data/db.json`. The mobile app will be re-pointed to this API after Phase 3/4.
