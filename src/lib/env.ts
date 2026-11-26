import { z } from "zod";

/**
 * Server-side environment, validated once on first use (not at import time, so
 * `next build` does not need production secrets).
 *
 * NEVER import this file from a Client Component: it contains secrets.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().startsWith("postgres", "DATABASE_URL must be a PostgreSQL connection string"),
  DIRECT_URL: z.string().startsWith("postgres").optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
