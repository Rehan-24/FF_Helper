import type { LeagueSettings } from "@/lib/types";
import { currentRound, onTheClockTeamId } from "@/lib/draft";

export default function OnTheClock({ league, picksMade }: { league: LeagueSettings; picksMade: number }) {
  const teamId = onTheClockTeamId(league, picksMade);
  const team = league.teams.find((t) => t.id === teamId);
  const isMe = teamId !== null && teamId === league.myTeamId;
  const round = currentRound(league, picksMade);

  return (
    <div
      className="card"
      style={{
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderColor: isMe ? "var(--accent)" : "var(--border)",
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>Round {round} · Pick {picksMade + 1}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: isMe ? "var(--accent)" : "var(--text)" }}>
          {team ? `On the clock: ${team.name}` : "Waiting for draft order..."}
          {isMe && " — YOU'RE UP!"}
        </div>
      </div>
    </div>
  );
}
