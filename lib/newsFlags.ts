import type { NewsItem, Player } from "./types";

export type FlagCategory = "injury" | "legal";

export interface NewsFlag {
  category: FlagCategory;
  headline: string;
  link: string | null;
}

// Keyword lists are intentionally broad — this is a "go check before you
// draft" trip wire, not an authoritative status. False positives (flagged
// but actually fine) are cheap; false negatives (missed real news) are the
// expensive failure mode, so we err toward over-flagging.
const INJURY_KEYWORDS = [
  "injury",
  "injured",
  "injury scare",
  "surgery",
  "torn",
  "tear",
  "sprain",
  "strain",
  "fracture",
  "fractured",
  "concussion",
  "questionable",
  "doubtful",
  "out for the season",
  "season-ending",
  "placed on ir",
  "injured reserve",
  "mri",
  "carted off",
  "exit",
  "hamstring",
  "achilles",
  "acl",
  "mcl",
];

const LEGAL_KEYWORDS = [
  "arrest",
  "arrested",
  "charged",
  "charges",
  "investigation",
  "investigated",
  "lawsuit",
  "citation",
  "cited",
  "dui",
  "dwi",
  "domestic",
  "suspended",
  "suspension",
  "police",
  "warrant",
  "off-field",
  "off the field",
  "legal trouble",
  "misdemeanor",
  "felony",
  "gambling",
];

function categorize(text: string): FlagCategory | null {
  const lower = text.toLowerCase();
  if (INJURY_KEYWORDS.some((kw) => lower.includes(kw))) return "injury";
  if (LEGAL_KEYWORDS.some((kw) => lower.includes(kw))) return "legal";
  return null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scans a general news feed for injury/legal-trouble language and matches
 * it back to specific players by name, so a fast-moving situation shows up
 * as a badge in the player table even before ESPN's own projections or
 * injuryStatus field catch up (which can lag real news by hours or days).
 *
 * Matching is a heuristic, not a guarantee: full-name matches are trusted
 * directly; last-name-only matches are only used when exactly one
 * roster-relevant player (has ownership or a projection) shares that last
 * name, to keep common-surname collisions (Brown, Jones, Williams...) from
 * mis-flagging the wrong player.
 */
export function flagPlayersFromNews(
  news: NewsItem[],
  players: Pick<Player, "id" | "fullName" | "percentOwned" | "projectedPoints">[]
): Map<number, NewsFlag> {
  const flags = new Map<number, NewsFlag>();

  const relevant = players.filter((p) => p.percentOwned > 0 || p.projectedPoints > 0);
  const lastNameIndex = new Map<string, typeof relevant>();
  for (const p of relevant) {
    const parts = p.fullName.trim().split(/\s+/);
    const lastName = parts[parts.length - 1];
    if (!lastName || lastName.length < 5) continue; // too short to trust alone
    const key = lastName.toLowerCase();
    if (!lastNameIndex.has(key)) lastNameIndex.set(key, []);
    lastNameIndex.get(key)!.push(p);
  }

  for (const item of news) {
    const text = `${item.headline} ${item.description}`;
    const category = categorize(text);
    if (!category) continue;

    for (const p of players) {
      if (flags.has(p.id)) continue;
      if (text.toLowerCase().includes(p.fullName.toLowerCase())) {
        flags.set(p.id, { category, headline: item.headline, link: item.link });
      }
    }

    for (const [lastName, candidates] of lastNameIndex) {
      if (candidates.length !== 1) continue; // ambiguous surname — skip
      const p = candidates[0];
      if (flags.has(p.id)) continue;
      const re = new RegExp(`\\b${escapeRegex(lastName)}\\b`, "i");
      if (re.test(text)) {
        flags.set(p.id, { category, headline: item.headline, link: item.link });
      }
    }
  }

  return flags;
}
