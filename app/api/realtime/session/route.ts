import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview",
        voice: "alloy",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Failed to create ephemeral session", details: text },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      id: data.id,
      client_secret: data.client_secret?.value,
      expires_at: data.expires_at,
      model: data.model,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
