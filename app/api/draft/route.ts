import { NextResponse } from "next/server";
import { getDraftDetail, isConfigured } from "@/lib/espn";

// No caching here — this is polled during the live draft and needs to be
// as close to real-time as ESPN's API allows.
export async function GET() {
  try {
    const draft = await getDraftDetail();
    return NextResponse.json({ draft, authConfigured: isConfigured() });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Failed to load draft state",
        authConfigured: isConfigured(),
        hint: !isConfigured()
          ? "Live draft sync requires ESPN_S2 and ESPN_SWID in .env.local for this private league."
          : undefined,
      },
      { status: 502 }
    );
  }
}
