import { NextRequest, NextResponse } from "next/server";
import { getLeagueNews, getPlayerNews } from "@/lib/espn";
import { withCache } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId");
  try {
    if (playerId) {
      const news = await withCache(`news-player-${playerId}`, 10 * 60 * 1000, () =>
        getPlayerNews(Number(playerId))
      );
      return NextResponse.json({ news });
    }
    const news = await withCache("news-general", 5 * 60 * 1000, () => getLeagueNews(40));
    return NextResponse.json({ news });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load news", news: [] }, { status: 502 });
  }
}
