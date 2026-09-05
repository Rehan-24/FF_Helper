# Fantasy Draft Helper

A standalone live draft assistant for your ESPN fantasy football league. It pulls
the full NFL player pool (projections, ownership %, ADP, injury status) and
fantasy news straight from ESPN, then ranks every player using **value-based
drafting** tuned to your league's actual size and roster settings — not a
generic "top 300" list. During your draft it polls ESPN's live draft feed and
auto-removes players as they're picked by anyone in the league.

Runs on port 3100 by default.

## What it does

- **Scrapes the full NFL player universe** from ESPN (not just your league's
  rostered players) — position, pro team, injury status, ownership %, ADP,
  and season projections, scored using your league's real scoring settings
  (PPR/half-PPR/standard, whatever `856864482` is actually set to).
- **Pulls fantasy news** — a general NFL/fantasy news feed, plus per-player
  news when you click into a player.
- **Ranks by Value Over Replacement (VOR)**, not raw projected points: for
  an 8-team league it works out how many points each player is worth *above
  the last player who'd actually start at that position*, including a
  flex-aware pool for RB/WR/TE so the shared FLEX slot doesn't undervalue
  those positions. It also clusters players into tiers (drop-off cliffs) and
  computes each position's real replacement level from the league's actual
  roster slot counts — it fetches those from ESPN rather than assuming a
  layout, so it stays correct if the league's roster settings differ from
  a standard 8-team default.
- **Recommends picks live**, blending VOR with your team's actual remaining
  roster needs (it won't tell you to draft a 3rd RB while you still need a
  starting QB, but it'll still surface an elite talent even without an
  immediate need).
- **Auto-syncs the draft board** — polls ESPN's live draft endpoint every 6s
  during your draft, shows who's on the clock (using the league's real snake
  draft order), and removes drafted players from availability automatically.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

`ESPN_LEAGUE_ID` is already defaulted to `856864482` and `ESPN_SEASON_YEAR`
to the current year — change them if needed.

### 3. Get your ESPN auth cookies (required — this is a private league)

Private leagues need two cookies to read anything (roster settings, players
scored to your league's format, live draft picks):

1. Log into [fantasy.espn.com](https://fantasy.espn.com) in your browser.
2. Open DevTools → **Application** (Chrome) or **Storage** (Firefox) →
   **Cookies** → `https://fantasy.espn.com`.
3. Copy the values of:
   - `espn_s2` — a long string
   - `SWID` — includes the curly braces, e.g. `{ABCD1234-...}`
4. Paste them into `.env.local`:
   ```
   ESPN_S2=your_long_espn_s2_value
   ESPN_SWID={YOUR-SWID-VALUE}
   ```

These are read server-side only in the API routes — they're never sent to
the browser, logged, or committed to git (`.env.local` is gitignored).
`SWID` is also used to automatically figure out which of the 8 teams is
*yours*, so the roster-needs-aware recommendations know your actual roster.

Cookies expire periodically (typically when you log out or ESPN rotates
your session) — if requests start failing, just grab fresh values.

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3100](http://localhost:3100).

## On draft day

Leave the page open before the draft starts — it polls ESPN every 6 seconds,
so as soon as picks start coming in (from any team, not just yours) the
draft board fills in, the "on the clock" banner updates, and the available
player pool / recommendations refresh automatically. No manual "mark as
drafted" clicking needed.

## Project structure

```
├── app/
│   ├── page.tsx              # Main draft dashboard (client component)
│   ├── layout.tsx
│   └── api/
│       ├── league/route.ts   # League settings (roster slots, scoring, teams)
│       ├── players/route.ts  # Full player pool + VOR rankings
│       ├── draft/route.ts    # Live draft picks (polled, uncached)
│       └── news/route.ts     # General or per-player fantasy news
├── lib/
│   ├── espn.ts                # ESPN API client (auth, pagination, mapping)
│   ├── rankings.ts             # VOR calculation, tiering, recommendations
│   ├── draft.ts                # Snake draft order / "on the clock" logic
│   ├── cache.ts                 # In-memory TTL cache (avoids hammering ESPN)
│   └── types.ts
└── components/                 # Draft board, recommendations, roster, news UI
```

## Notes

- ESPN's fantasy API is undocumented/reverse-engineered (there's no official
  public API) — the endpoints used here are the same ones the ESPN Fantasy
  web app itself calls, and are widely used by the open-source fantasy
  football tooling community. They could change without notice.
- This is built as a single-user local tool, not a hosted multi-tenant
  service — the in-memory cache and env-var-based auth reflect that. If you
  ever want to deploy it somewhere shared, cookies would need to move to
  per-user, request-scoped auth instead of process env vars.
- `npm audit` will flag a Next.js advisory whose full fix requires the
  Next.js 16 major version. This app doesn't use Server Actions (the
  vulnerable surface), and it's intended to run locally on `localhost`
  rather than be deployed publicly, so this wasn't treated as blocking —
  revisit before ever exposing this beyond your own machine.
