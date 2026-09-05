export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "D/ST" | "FLEX" | "UNKNOWN";

export interface Player {
  id: number;
  fullName: string;
  position: Position;
  eligibleSlots: Position[];
  proTeam: string;
  injuryStatus: string | null;
  percentOwned: number;
  percentStarted: number;
  adp: number | null;
  projectedPoints: number;
  actualPointsSoFar: number;
  draftedByTeamId: number | null;
}

export interface RosterSlotCounts {
  // e.g. { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, "D/ST": 1, K: 1, BE: 7 }
  [slot: string]: number;
}

export interface LeagueSettings {
  leagueId: number;
  seasonYear: number;
  name: string;
  size: number;
  isPPR: boolean;
  receptionPoints: number;
  rosterSlotCounts: RosterSlotCounts;
  startersBySlot: Partial<Record<Position, number>>;
  teams: Team[];
  myTeamId: number | null;
  draftOrder: number[];
  draftType: string;
}

export interface Team {
  id: number;
  name: string;
  abbrev: string;
  owners: string[];
}

export interface DraftPick {
  id: number;
  playerId: number;
  teamId: number;
  roundId: number;
  roundPickNumber: number;
  overallPickNumber: number;
  keeper: boolean;
}

export interface DraftDetail {
  inProgress: boolean;
  drafted: boolean;
  picks: DraftPick[];
}

export interface RankedPlayer extends Player {
  rank: number;
  positionRank: number;
  replacementLevelPoints: number;
  valueOverReplacement: number;
  tier: number;
  newsFlag?: {
    category: "injury" | "legal";
    headline: string;
    link: string | null;
  };
}

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  link: string | null;
  published: string | null;
  imageUrl: string | null;
}
