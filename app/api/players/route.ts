import { NextResponse } from "next/server";
import { getAllPlayers, getLeagueSettings, isConfigured } from "@/lib/espn";
import { buildRankings } from "@/lib/rankings";
import { withCache } from "@/lib/cache";

export async function GET() {
  try {
    const [players, league] = await Promise.all([
      withCache("all-players", 10 * 60 * 1000, getAllPlayers),
      withCache("league-settings", 5 * 60 * 1000, getLeagueSettings),
    ]);
    const ranked = buildRankings(players, league);
    return NextResponse.json({ players: ranked, count: ranked.length, league });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Failed to load players",
        authConfigured: isConfigured(),
        hint: !isConfigured()
          ? "Set ESPN_S2 and ESPN_SWID in .env.local for this private league. See .env.local.example."
          : undefined,
      },
      { status: 502 }
    );
  }
}
