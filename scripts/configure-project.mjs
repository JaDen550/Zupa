// Run once after copying these files over a fresh create-next-app project:
//   node scripts/configure-project.mjs
// Adds the database/dev scripts to package.json, the Prisma seed command, and makes
// sure .env.example is committed while real .env files are never committed.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

const pkgPath = "package.json";
if (!existsSync(pkgPath)) {
  console.error("package.json not found. Run this from the zupa-web project folder.");
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

pkg.scripts = {
  ...pkg.scripts,
  postinstall: "prisma generate",
  typecheck: "tsc --noEmit",
  "db:validate": "prisma validate",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:seed": "prisma db seed",
  "db:studio": "prisma studio",
  "db:reset": "prisma migrate reset",
};
pkg.prisma = { ...(pkg.prisma ?? {}), seed: "tsx prisma/seed.ts" };
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("✔ package.json: scripts and prisma.seed configured");

// .gitignore created by create-next-app ignores `.env*`; keep the example file tracked.
const giPath = ".gitignore";
if (existsSync(giPath)) {
  const gi = readFileSync(giPath, "utf8");
  if (!gi.includes("!.env.example")) {
    writeFileSync(giPath, gi.replace(/\s*$/, "\n") + "\n# keep the template, never the real secrets\n!.env.example\n");
    console.log("✔ .gitignore: .env.example stays tracked, real .env files stay private");
  }
}

// The generated favicon.ico would compete with the ZUPA icon at src/app/icon.png.
if (existsSync("src/app/favicon.ico")) {
  rmSync("src/app/favicon.ico");
  console.log("✔ removed default favicon.ico (using ZUPA icon)");
}

console.log("\nDone. Next: copy .env.example to .env and fill in your Neon connection strings.");
