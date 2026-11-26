import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Liveness + database check for uptime monitors and deployment platforms.
// Deliberately reveals nothing about the configuration.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
