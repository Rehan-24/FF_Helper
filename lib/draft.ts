import type { DraftPick, LeagueSettings } from "./types";

/**
 * Figures out which team is on the clock for the *next* pick, using the
 * league's actual draft order and snake logic (odd rounds forward, even
 * rounds reversed).
 */
export function onTheClockTeamId(league: LeagueSettings, picksMade: number): number | null {
  const teams = league.size || 8;
  if (!league.draftOrder || league.draftOrder.length !== teams) return null;

  const round = Math.floor(picksMade / teams); // 0-indexed
  const indexInRound = picksMade % teams;
  const isSnakeReverseRound = league.draftType === "SNAKE" && round % 2 === 1;
  const order = isSnakeReverseRound ? [...league.draftOrder].reverse() : league.draftOrder;
  return order[indexInRound] ?? null;
}

export function currentRound(league: LeagueSettings, picksMade: number): number {
  const teams = league.size || 8;
  return Math.floor(picksMade / teams) + 1;
}

export function sortPicks(picks: DraftPick[]): DraftPick[] {
  return [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
}
