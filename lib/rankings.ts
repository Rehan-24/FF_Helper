import type { LeagueSettings, Player, Position, RankedPlayer } from "./types";

const FLEX_ELIGIBLE: Position[] = ["RB", "WR", "TE"];
const SINGLE_SLOT_POSITIONS: Position[] = ["QB", "K", "D/ST"];

/**
 * Value-Based Drafting: ranks every player by how many points they're worth
 * *above the last player who'd start at that position in an 8-team league*,
 * not just raw projected points. This is what makes the tool league-aware
 * instead of just reusing ESPN's generic overall rank.
 */
export function buildRankings(players: Player[], league: LeagueSettings): RankedPlayer[] {
  const teams = league.size || 8;
  const starters = league.startersBySlot;

  const byPosition = new Map<Position, Player[]>();
  for (const p of players) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }
  for (const list of byPosition.values()) {
    list.sort((a, b) => b.projectedPoints - a.projectedPoints);
  }

  const replacementLevel = new Map<Position, number>();

  // Single-slot positions: replacement = next player after teams * starters.
  for (const pos of SINGLE_SLOT_POSITIONS) {
    const list = byPosition.get(pos) || [];
    const idx = Math.max(0, teams * (starters[pos] || 0));
    const replacement = list[idx] ?? list[list.length - 1];
    replacementLevel.set(pos, replacement?.projectedPoints ?? 0);
  }

  // Flex-eligible positions: pool RB/WR/TE together so the shared FLEX slot(s)
  // pull replacement level up across all three, not just each in isolation.
  const flexStarters =
    (starters.RB || 0) + (starters.WR || 0) + (starters.TE || 0) + (starters.FLEX || 0);
  const combinedPool = FLEX_ELIGIBLE.flatMap((pos) => byPosition.get(pos) || []).sort(
    (a, b) => b.projectedPoints - a.projectedPoints
  );
  const startableCount = teams * flexStarters;
  const startablePool = combinedPool.slice(0, startableCount);

  for (const pos of FLEX_ELIGIBLE) {
    const lastStartableOfPos = [...startablePool].reverse().find((p) => p.position === pos);
    if (lastStartableOfPos) {
      replacementLevel.set(pos, lastStartableOfPos.projectedPoints);
    } else {
      // Fewer startable players at this position than flex slots available —
      // fall back to single-position replacement level.
      const list = byPosition.get(pos) || [];
      const idx = Math.max(0, teams * (starters[pos] || 0));
      replacementLevel.set(pos, list[idx]?.projectedPoints ?? 0);
    }
  }

  const ranked: RankedPlayer[] = players.map((p) => {
    const replacementLevelPoints = replacementLevel.get(p.position) ?? 0;
    return {
      ...p,
      rank: 0,
      positionRank: 0,
      replacementLevelPoints,
      valueOverReplacement: Math.round((p.projectedPoints - replacementLevelPoints) * 10) / 10,
      tier: 1,
    };
  });

  ranked.sort((a, b) => b.valueOverReplacement - a.valueOverReplacement);
  ranked.forEach((p, i) => {
    p.rank = i + 1;
  });

  for (const pos of byPosition.keys()) {
    const posRanked = ranked
      .filter((p) => p.position === pos)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    posRanked.forEach((p, i) => {
      p.positionRank = i + 1;
    });
  }

  assignTiers(ranked);

  return ranked;
}

function assignTiers(ranked: RankedPlayer[]) {
  if (ranked.length === 0) return;
  let tier = 1;
  ranked[0].tier = tier;
  for (let i = 1; i < ranked.length; i++) {
    const prev = ranked[i - 1];
    const cur = ranked[i];
    const gap = prev.valueOverReplacement - cur.valueOverReplacement;
    const scale = Math.max(1, Math.abs(prev.valueOverReplacement));
    if (gap > Math.max(2.5, scale * 0.12)) {
      tier += 1;
    }
    cur.tier = tier;
  }
}

export interface RosterNeed {
  position: Position;
  remainingStarterSlots: number;
  eligibleForFlex: boolean;
  remainingFlexSlots: number;
}

/**
 * How urgently a team still needs each starting position, based on what's
 * already on the roster vs. the league's actual starting lineup requirements.
 */
export function computeRosterNeeds(rosterPositions: Position[], league: LeagueSettings): RosterNeed[] {
  const starters = league.startersBySlot;
  const filled: Partial<Record<Position, number>> = {};
  for (const pos of rosterPositions) {
    filled[pos] = (filled[pos] || 0) + 1;
  }

  let flexUsed = 0;
  for (const pos of FLEX_ELIGIBLE) {
    const extra = Math.max(0, (filled[pos] || 0) - (starters[pos] || 0));
    flexUsed += extra;
  }
  const remainingFlexSlots = Math.max(0, (starters.FLEX || 0) - flexUsed);

  const positions: Position[] = ["QB", "RB", "WR", "TE", "K", "D/ST"];
  return positions.map((pos) => ({
    position: pos,
    remainingStarterSlots: Math.max(0, (starters[pos] || 0) - (filled[pos] || 0)),
    eligibleForFlex: FLEX_ELIGIBLE.includes(pos),
    remainingFlexSlots,
  }));
}

function needMultiplier(pos: Position, needs: RosterNeed[]): number {
  const need = needs.find((n) => n.position === pos);
  if (!need) return 1;
  if (need.remainingStarterSlots > 0) return 1.25;
  if (need.eligibleForFlex && need.remainingFlexSlots > 0) return 1.1;
  return 0.9;
}

export interface Recommendation {
  player: RankedPlayer;
  score: number;
  reason: string;
}

/**
 * Best-fit picks for *your* team right now: blends value-over-replacement
 * with how badly you still need that position, so it won't tell you to draft
 * a 3rd elite RB while you're still missing a starting QB.
 */
export function recommendPicks(
  available: RankedPlayer[],
  myRosterPositions: Position[],
  league: LeagueSettings,
  topN = 15
): Recommendation[] {
  const needs = computeRosterNeeds(myRosterPositions, league);

  const scored = available.map((player) => {
    const mult = needMultiplier(player.position, needs);
    const score = Math.round(player.valueOverReplacement * mult * 10) / 10;
    const need = needs.find((n) => n.position === player.position);
    let reason = "Best value available";
    if (need && need.remainingStarterSlots > 0) {
      reason = `Fills starting ${player.position} need`;
    } else if (need?.eligibleForFlex && need.remainingFlexSlots > 0) {
      reason = "Flex-eligible, adds starter-quality depth";
    } else if (player.tier <= 2) {
      reason = "Elite tier talent — hard to pass up even without immediate need";
    }
    return { player, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

export function bestAvailableByPosition(
  available: RankedPlayer[],
  positions: Position[] = ["QB", "RB", "WR", "TE", "K", "D/ST"]
): Record<string, RankedPlayer[]> {
  const out: Record<string, RankedPlayer[]> = {};
  for (const pos of positions) {
    out[pos] = available
      .filter((p) => p.position === pos)
      .sort((a, b) => b.valueOverReplacement - a.valueOverReplacement)
      .slice(0, 10);
  }
  return out;
}
