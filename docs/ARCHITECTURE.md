# ZUPA Architecture

## Shape of the system

```
Browser / mobile app
        │
        ▼
Next.js (App Router)
  ├─ Server Components   read data directly through Prisma (no extra API hop)
  ├─ Route Handlers      /api/*  JSON endpoints for the mobile app and client actions
  └─ Server Actions      form mutations (checkout, account, admin forms)
        │
        ▼
src/server/*   business rules (orders, inventory, payments, delivery)   ← one place for rules
        │
        ▼
Prisma 6  ──►  PostgreSQL (Neon)
```

Business rules live in `src/server/` so that web pages, API routes and the future mobile app all enforce the same rules. UI code never writes to the database directly.

## Key decisions

**Money.** Integer minor units everywhere. `Currency.exponent` says how many decimals. Floats are never used for money. To add a currency: add a row to `currencies`, an entry in `src/lib/money.ts`, and exchange-rate handling at display time.

**Order integrity.** Orders copy product name, SKU, unit price and the delivery address at checkout time (snapshot columns). Editing a product or an address book never rewrites history. `Order.idempotencyKey` is unique, so a retried checkout request cannot create two orders.

**Inventory.** `Inventory.quantity` is current stock; `reserved` holds stock committed to open orders. Every change writes an append-only `StockMovement` row (who, why, how much). Stock is decremented inside the same database transaction that creates the order, so two buyers cannot take the last unit.

**Payments (adapter pattern, Phase 5).**
```
interface PaymentProvider {
  initiate(order, payment)   → { providerReference, redirectUrl? }
  verify(providerReference)  → verified status from the provider (server-to-server)
  parseWebhook(request)      → validated event or rejection
}
```
Implementations: `cod`, `manual` (always `PENDING_VERIFICATION` until an authorised admin confirms), `monime` (a stub that throws "not configured" until official docs and credentials exist).
Rules: a payment becomes `PAID` only after a verified `SUCCEEDED` transaction. `Transaction.idempotencyKey` and `WebhookEvent(provider, eventId)` are unique, so retries and replayed webhooks are harmless. Webhook signatures are verified before anything is processed. Secrets are read only on the server.

**Authentication (Phase 3).** Passwords hashed with bcrypt. Login creates a random 32-byte token, stored **hashed** in `sessions`; the cookie is `HttpOnly`, `Secure`, `SameSite=Lax`. Failed-login counters and `lockedUntil` slow brute force. Rate limiting on auth, checkout and webhook endpoints.

**Authorisation (Phase 4).** `AdminProfile.adminRole` (SUPER_ADMIN, MANAGER, INVENTORY, SUPPORT, DELIVERY_MANAGER, FINANCE) maps to permissions in `src/lib/rbac.ts`. Every admin route handler and server action checks permission on the server. Customer phone numbers and addresses are exposed only to roles that need them (e.g. DELIVERY_MANAGER, assigned riders). Every admin mutation writes an `audit_logs` row with before/after JSON.

**Delivery.** `DeliveryZone` holds fee, free-delivery threshold and ETA, configurable in the admin. Each delivery attempt is a `DeliveryAssignment` row (attempt 1, 2, …) with status PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED or FAILED (with reason). A failed attempt keeps its row; reassigning creates the next attempt.

**Images.** Product images are uploaded to Cloudinary from the server; the database stores `url` and `publicId`. `next.config.ts` allows only `res.cloudinary.com`.

**Search.** Phase 3 starts with indexed `contains` search; if the catalogue grows, add PostgreSQL `pg_trgm` / full-text search without changing the API.

## Environments

| | Database | Notes |
|---|---|---|
| Local dev | Neon dev branch | `npm run db:reset` is safe here |
| Production | separate Neon project/branch | only `npm run db:deploy`, never `db:reset` |

## Not decided yet
- Email/SMS provider for order notifications (in-app notifications are in the schema).
- Hosting target (Vercel assumed).
- Whether guests can check out without an account (schema assumes accounts; carts are per user).
