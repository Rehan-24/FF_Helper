import type { DraftDetail, DraftPick, LeagueSettings, NewsItem, Player, Position, RosterSlotCounts, Team } from "./types";

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "856864482";
const SEASON_YEAR = process.env.ESPN_SEASON_YEAR || String(new Date().getFullYear());

const FANTASY_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons";
const NEWS_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news";
const PLAYER_NEWS_BASE = "https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players";

function leagueUrl() {
  return `${FANTASY_BASE}/${SEASON_YEAR}/segments/0/leagues/${LEAGUE_ID}`;
}

function hasAuth() {
  return Boolean(process.env.ESPN_S2 && process.env.ESPN_SWID);
}

function authCookie(): string | null {
  if (!hasAuth()) return null;
  const swid = process.env.ESPN_SWID!.trim();
  const s2 = process.env.ESPN_S2!.trim();
  return `SWID=${swid}; espn_s2=${s2}`;
}

async function espnFetch(url: string, opts: { fantasyFilter?: unknown } = {}): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const cookie = authCookie();
  if (cookie) headers["Cookie"] = cookie;
  if (opts.fantasyFilter) headers["x-fantasy-filter"] = JSON.stringify(opts.fantasyFilter);

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ESPN request failed (${res.status} ${res.statusText}) for ${url}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// --- Position / slot mapping ---------------------------------------------

const DEFAULT_POSITION_MAP: Record<number, Position> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

const SLOT_ID_MAP: Record<number, Position> = {
  0: "QB",
  2: "RB",
  3: "FLEX", // RB/WR
  4: "WR",
  5: "FLEX", // WR/TE
  6: "TE",
  16: "D/ST",
  17: "K",
  23: "FLEX", // RB/WR/TE
};

function proTeamAbbrev(id: number): string {
  const map: Record<number, string> = {
    0: "FA", 1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET",
    9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN",
    17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
    25: "SF", 26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
  };
  return map[id] || "FA";
}

const INJURY_MAP: Record<string, string> = {
  ACTIVE: "",
  QUESTIONABLE: "Q",
  DOUBTFUL: "D",
  OUT: "OUT",
  INJURY_RESERVE: "IR",
  SUSPENSION: "SUSP",
  PUP: "PUP",
};

// --- League settings -------------------------------------------------------

export async function getLeagueSettings(): Promise<LeagueSettings> {
  const url = `${leagueUrl()}?view=mSettings&view=mTeam`;
  const data = await espnFetch(url);

  const lineupSlotCounts: Record<string, number> = data?.settings?.rosterSettings?.lineupSlotCounts || {};
  const rosterSlotCounts: RosterSlotCounts = {};
  const startersBySlot: Partial<Record<Position, number>> = {};

  for (const [slotIdStr, count] of Object.entries(lineupSlotCounts)) {
    const slotId = Number(slotIdStr);
    const n = Number(count);
    if (!n) continue;
    if (slotId === 20) {
      rosterSlotCounts.BE = n;
      continue;
    }
    if (slotId === 21) {
      rosterSlotCounts.IR = n;
      continue;
    }
    const pos = SLOT_ID_MAP[slotId];
    if (!pos) continue;
    rosterSlotCounts[pos] = (rosterSlotCounts[pos] || 0) + n;
    startersBySlot[pos] = (startersBySlot[pos] || 0) + n;
  }

  const scoringItems: Array<{ statId: number; points: number }> =
    data?.settings?.scoringSettings?.scoringItems || [];
  // statId 53 = receptions
  const receptionItem = scoringItems.find((i) => i.statId === 53);
  const receptionPoints = receptionItem?.points ?? 0;

  const teams: Team[] = (data?.teams || []).map((t: any) => ({
    id: t.id,
    name: t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || `Team ${t.id}`,
    abbrev: t.abbrev,
    owners: (t.owners || []).map((o: string) => o.toUpperCase()),
  }));

  let myTeamId: number | null = null;
  const swid = process.env.ESPN_SWID?.trim().toUpperCase();
  if (swid) {
    const mine = teams.find((t) => t.owners.includes(swid));
    myTeamId = mine ? mine.id : null;
  }

  const draftSettings = data?.settings?.draftSettings || {};

  return {
    leagueId: Number(LEAGUE_ID),
    seasonYear: Number(SEASON_YEAR),
    name: data?.settings?.name || "League",
    size: data?.settings?.size ?? teams.length ?? 8,
    isPPR: receptionPoints >= 0.75,
    receptionPoints,
    rosterSlotCounts,
    startersBySlot,
    teams,
    myTeamId,
    draftOrder: draftSettings.pickOrder || [],
    draftType: draftSettings.type || "SNAKE",
  };
}

// --- Players ----------------------------------------------------------------

const PLAYERS_PAGE_SIZE = 400;
// Safety ceiling, not a real limit — ESPN's full tracked player pool
// (including practice squad / IR) can run past 4000, and low-ownership
// players (new rookies especially) sort to the very end, so this must sit
// comfortably above the real universe size or they get silently cut off.
const MAX_PLAYERS = 20000;

function extractProjectedPoints(player: any, seasonId: number): number {
  const stats: any[] = player?.stats || [];
  const projected = stats.find(
    (s) => s.statSourceId === 1 && s.statSplitTypeId === 0 && s.seasonId === seasonId
  );
  if (projected?.appliedTotal != null) return Number(projected.appliedTotal);
  // fall back to any season-long projection regardless of year field presence
  const anyProjected = stats.find((s) => s.statSourceId === 1 && s.statSplitTypeId === 0);
  return anyProjected?.appliedTotal != null ? Number(anyProjected.appliedTotal) : 0;
}

function extractActualPoints(player: any, seasonId: number): number {
  const stats: any[] = player?.stats || [];
  const actual = stats.find(
    (s) => s.statSourceId === 0 && s.statSplitTypeId === 0 && s.seasonId === seasonId
  );
  return actual?.appliedTotal != null ? Number(actual.appliedTotal) : 0;
}

function mapPlayer(raw: any, seasonId: number): Player {
  const p = raw.player ?? raw;
  const eligibleSlots: Position[] = Array.from(
    new Set((p.eligibleSlots || []).map((s: number) => SLOT_ID_MAP[s]).filter(Boolean))
  ) as Position[];

  return {
    id: p.id,
    fullName: p.fullName,
    position: DEFAULT_POSITION_MAP[p.defaultPositionId] || "UNKNOWN",
    eligibleSlots,
    proTeam: proTeamAbbrev(p.proTeamId),
    injuryStatus: p.injuryStatus ? INJURY_MAP[p.injuryStatus] ?? p.injuryStatus : null,
    percentOwned: p.ownership?.percentOwned ?? 0,
    percentStarted: p.ownership?.percentStarted ?? 0,
    adp: p.ownership?.averageDraftPosition ?? null,
    projectedPoints: extractProjectedPoints(p, seasonId),
    actualPointsSoFar: extractActualPoints(p, seasonId),
    draftedByTeamId: raw.onTeamId && raw.onTeamId > 0 ? raw.onTeamId : null,
  };
}

/**
 * Pulls the full NFL player universe (not just free agents) with projections,
 * ownership %, ADP, and injury status, scored using this league's actual
 * scoring settings (PPR/half-PPR/standard).
 */
export async function getAllPlayers(): Promise<Player[]> {
  const seasonId = Number(SEASON_YEAR);
  const players: Player[] = [];
  const seenIds = new Set<number>();
  let offset = 0;

  while (offset < MAX_PLAYERS) {
    const filter = {
      players: {
        filterStatsForTopScoringPeriodIds: { value: 16 },
        // Secondary sort key: percOwned alone ties thousands of players at
        // 0% (rookies and deep bench included), and paginating a fixed
        // offset over a huge tie-block isn't guaranteed stable across
        // requests — draft rank breaks those ties so nobody gets skipped.
        sortPercOwned: { sortAsc: false, sortPriority: 2 },
        sortDraftRanks: { sortAsc: true, sortPriority: 1, value: "STANDARD" },
        limit: PLAYERS_PAGE_SIZE,
        offset,
      },
    };
    const url = `${leagueUrl()}?view=kona_player_info`;
    const data = await espnFetch(url, { fantasyFilter: filter });
    const batch: any[] = data?.players || [];
    if (batch.length === 0) break;

    for (const raw of batch) {
      const player = mapPlayer(raw, seasonId);
      if (!seenIds.has(player.id)) {
        seenIds.add(player.id);
        players.push(player);
      }
    }

    if (batch.length < PLAYERS_PAGE_SIZE) break;
    offset += PLAYERS_PAGE_SIZE;
  }

  return players;
}

// --- Draft --------------------------------------------------------------

export async function getDraftDetail(): Promise<DraftDetail> {
  const url = `${leagueUrl()}?view=mDraftDetail`;
  const data = await espnFetch(url);
  const dd = data?.draftDetail || {};
  // ESPN pre-populates every slot for the entire draft (all rounds, all
  // teams) before it even starts, using playerId -1 (sometimes 0/null) as
  // a "not yet picked" placeholder. Only keep entries that represent an
  // actual completed selection, or picks.length reads as the whole
  // draft's slot count instead of how many picks have really happened.
  const picks: DraftPick[] = (dd.picks || [])
    .filter((p: any) => typeof p.playerId === "number" && p.playerId > 0)
    .map((p: any) => ({
      id: p.id,
      playerId: p.playerId,
      teamId: p.teamId,
      roundId: p.roundId,
      roundPickNumber: p.roundPickNumber,
      overallPickNumber: p.overallPickNumber,
      keeper: Boolean(p.keeper),
    }));
  return {
    inProgress: Boolean(dd.inProgress),
    drafted: Boolean(dd.drafted),
    picks,
  };
}

// --- News -----------------------------------------------------------------

export async function getLeagueNews(limit = 30): Promise<NewsItem[]> {
  const url = `${NEWS_BASE}?limit=${limit}`;
  const data = await espnFetch(url);
  const articles: any[] = data?.articles || [];
  return articles.map((a) => ({
    id: String(a.id ?? a.headline),
    headline: a.headline,
    description: a.description || "",
    link: a.links?.web?.href || null,
    published: a.published || null,
    imageUrl: a.images?.[0]?.url || null,
  }));
}

export async function getPlayerNews(playerId: number, limit = 10): Promise<NewsItem[]> {
  const url = `${PLAYER_NEWS_BASE}?playerId=${playerId}&limit=${limit}`;
  try {
    const data = await espnFetch(url);
    const feed: any[] = data?.feed || data?.news || [];
    return feed.map((a: any, idx: number) => ({
      id: String(a.id ?? `${playerId}-${idx}`),
      headline: a.headline,
      description: a.description || a.contentMobile || "",
      link: a.links?.web?.href || null,
      published: a.published || a.lastModified || null,
      imageUrl: a.images?.[0]?.url || null,
    }));
  } catch {
    return [];
  }
}

export function isConfigured() {
  return hasAuth();
}

export function getLeagueId() {
  return LEAGUE_ID;
}
