import { Logo } from "@/components/brand/Logo";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

// Phase 1 status page. The real storefront homepage arrives in Phase 3.
// Everything shown here is read live from PostgreSQL, so if you can see
// numbers, the app, Prisma and the database are all connected.
export const dynamic = "force-dynamic";

async function loadStatus() {
  const started = Date.now();
  try {
    const [categories, products, zones, cheapest] = await Promise.all([
      prisma.productCategory.count(),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.deliveryZone.count({ where: { active: true } }),
      prisma.product.findFirst({ where: { status: "ACTIVE" }, orderBy: { priceMinor: "asc" }, select: { name: true, priceMinor: true } }),
    ]);
    return { ok: true as const, ms: Date.now() - started, categories, products, zones, cheapest };
  } catch (e) {
    // Details only in development: never leak connection errors to visitors.
    const detail = process.env.NODE_ENV === "production" ? undefined : e instanceof Error ? e.message : String(e);
    return { ok: false as const, detail };
  }
}

export default async function Home() {
  const s = await loadStatus();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-dark">Phase 1 · Foundation</span>
      </header>

      <section className="mt-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Your everyday shopping destination</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          ZUPA is being built <span className="text-brand">properly</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          This page confirms the foundation works: Next.js, TypeScript, Tailwind and PostgreSQL are connected.
          The storefront, checkout and admin dashboard come in the next phases.
        </p>
      </section>

      <section aria-labelledby="status" className="mt-10">
        <h2 id="status" className="text-lg font-bold">System status</h2>

        {s.ok ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="flex items-center gap-2 font-bold text-ok">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-ok" /> Database connected
              </p>
              <p className="mt-1 text-sm text-muted">Answered in {s.ms} ms</p>
            </div>
            <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-white p-5 text-center">
              {[
                ["Categories", s.categories],
                ["Products", s.products],
                ["Delivery zones", s.zones],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-2xl font-extrabold">{value}</dd>
                </div>
              ))}
            </dl>
            {s.products === 0 ? (
              <p className="rounded-2xl bg-gold/20 p-4 text-sm sm:col-span-2">
                The database is connected but empty. Run <code className="font-mono">npm run db:seed</code> to load sample data.
              </p>
            ) : s.cheapest ? (
              <p className="text-sm text-muted sm:col-span-2">
                Live data check: cheapest product is <strong className="text-charcoal">{s.cheapest.name}</strong> at{" "}
                <strong className="text-charcoal">{formatMoney(s.cheapest.priceMinor)}</strong>.
              </p>
            ) : null}
          </div>
        ) : (
          <div role="alert" className="mt-3 rounded-2xl border border-danger/30 bg-danger-light p-5">
            <p className="font-bold text-danger">Database not reachable</p>
            <p className="mt-1 text-sm text-ink-soft">
              Check <code className="font-mono">DATABASE_URL</code> in your <code className="font-mono">.env</code> file, then run{" "}
              <code className="font-mono">npm run db:migrate</code>. See README.md, step 4.
            </p>
            {s.detail && <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs text-ink-soft">{s.detail}</pre>}
          </div>
        )}
      </section>
    </main>
  );
}
