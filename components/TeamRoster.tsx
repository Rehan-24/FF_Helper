import type { LeagueSettings, RankedPlayer } from "@/lib/types";
import PositionBadge from "./PositionBadge";

export default function TeamRoster({
  league,
  myPlayers,
}: {
  league: LeagueSettings;
  myPlayers: RankedPlayer[];
}) {
  const myTeam = league.teams.find((t) => t.id === league.myTeamId);
  return (
    <div className="card" style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--muted)" }}>
        Your team{myTeam ? ` — ${myTeam.name}` : ""}
      </h3>
      {!league.myTeamId && (
        <div style={{ fontSize: 12, color: "var(--warn)", marginBottom: 8 }}>
          Couldn&apos;t match your ESPN_SWID to a team in this league yet — recommendations are
          showing league-wide value only.
        </div>
      )}
      {myPlayers.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No picks yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {myPlayers.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <PositionBadge position={p.position} />
              <span style={{ flex: 1 }}>{p.fullName}</span>
              <span style={{ color: "var(--muted)" }}>{p.proTeam}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Starting lineup</div>
        <div style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(league.startersBySlot).map(([slot, count]) => (
            <span
              key={slot}
              className="badge"
              style={{ background: "var(--panel-2)", color: "var(--muted)" }}
            >
              {count}x {slot}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
