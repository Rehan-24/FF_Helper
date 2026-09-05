import { NextResponse } from "next/server";
import { getLeagueSettings, isConfigured } from "@/lib/espn";
import { withCache } from "@/lib/cache";

export async function GET() {
  try {
    const league = await withCache("league-settings", 5 * 60 * 1000, getLeagueSettings);
    return NextResponse.json({ league, authConfigured: isConfigured() });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Failed to load league settings",
        authConfigured: isConfigured(),
        hint: !isConfigured()
          ? "Set ESPN_S2 and ESPN_SWID in .env.local for this private league. See .env.local.example."
          : "Double-check ESPN_LEAGUE_ID and that your ESPN_S2/ESPN_SWID cookies are still valid.",
      },
      { status: 502 }
    );
  }
}
