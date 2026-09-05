import type { Recommendation } from "@/lib/rankings";
import PositionBadge from "./PositionBadge";

export default function RecommendationPanel({
  recommendations,
  onSelect,
}: {
  recommendations: Recommendation[];
  onSelect: (playerId: number) => void;
}) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--muted)" }}>
        🤖 Recommended picks for you
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {recommendations.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No data yet.</div>
        )}
        {recommendations.map((r, i) => (
          <button
            key={r.player.id}
            onClick={() => onSelect(r.player.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: i === 0 ? "var(--panel-2)" : "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              cursor: "pointer",
              textAlign: "left",
              color: "var(--text)",
            }}
          >
            <span style={{ width: 18, color: "var(--muted)", fontSize: 12 }}>{i + 1}</span>
            <PositionBadge position={r.player.position} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.player.fullName}{" "}
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>{r.player.proTeam}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.reason}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--good)" }}>+{r.score.toFixed(1)}</div>
              <div style={{ color: "var(--muted)" }}>VOR</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
