import { NextResponse } from "next/server";

import { hasEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    databaseUrl: hasEnv("DATABASE_URL"),
    openAIApiKey: hasEnv("OPENAI_API_KEY"),
  };

  const status = checks.databaseUrl && checks.openAIApiKey ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
