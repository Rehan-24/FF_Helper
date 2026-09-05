import type { DraftPick, LeagueSettings, RankedPlayer } from "@/lib/types";
import PositionBadge from "./PositionBadge";

export default function DraftBoard({
  picks,
  league,
  playersById,
}: {
  picks: DraftPick[];
  league: LeagueSettings;
  playersById: Map<number, RankedPlayer>;
}) {
  const teams = league.size || 8;
  const rounds = Math.max(1, Math.ceil(picks.length / teams) + 1);

  const grid: (DraftPick | null)[][] = Array.from({ length: rounds }, (_, r) => {
    const round = r + 1;
    const isReverse = league.draftType === "SNAKE" && r % 2 === 1;
    const order = isReverse ? [...league.draftOrder] : league.draftOrder;
    return (order.length ? order : Array.from({ length: teams }, (_, i) => i + 1)).map((teamId, i) => {
      const overall = r * teams + i + 1;
      return picks.find((p) => p.overallPickNumber === overall) || null;
    });
  });

  const teamName = (id: number) => league.teams.find((t) => t.id === id)?.abbrev || `T${id}`;

  return (
    <div className="card scroll" style={{ padding: 12, overflowX: "auto" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--muted)" }}>Draft board</h3>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              <td style={{ padding: 4, color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
                R{ri + 1}
              </td>
              {row.map((pick, ci) => {
                const player = pick ? playersById.get(pick.playerId) : null;
                return (
                  <td
                    key={ci}
                    style={{
                      border: "1px solid var(--border)",
                      padding: "6px 8px",
                      minWidth: 120,
                      verticalAlign: "top",
                      background: pick ? "var(--panel-2)" : "transparent",
                    }}
                  >
                    {pick ? (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>
                          {teamName(pick.teamId)} · #{pick.overallPickNumber}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {player && <PositionBadge position={player.position} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {player?.fullName || `#${pick.playerId}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--border)" }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
