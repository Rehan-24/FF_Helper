import { NextResponse } from "next/server";
import { getAllPlayers, getLeagueNews, getLeagueSettings, isConfigured } from "@/lib/espn";
import { buildRankings } from "@/lib/rankings";
import { flagPlayersFromNews } from "@/lib/newsFlags";
import { withCache } from "@/lib/cache";

export async function GET() {
  try {
    const [players, league, news] = await Promise.all([
      withCache("all-players", 10 * 60 * 1000, getAllPlayers),
      withCache("league-settings", 5 * 60 * 1000, getLeagueSettings),
      withCache("news-general", 5 * 60 * 1000, () => getLeagueNews(40)),
    ]);
    const ranked = buildRankings(players, league);

    const flags = flagPlayersFromNews(news, ranked);
    for (const player of ranked) {
      const flag = flags.get(player.id);
      if (flag) player.newsFlag = flag;
    }

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
