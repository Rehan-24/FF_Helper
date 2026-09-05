"use client";

import { useMemo, useState } from "react";
import type { Position, RankedPlayer } from "@/lib/types";
import PositionBadge from "./PositionBadge";

const POSITIONS: (Position | "ALL")[] = ["ALL", "QB", "RB", "WR", "TE", "K", "D/ST"];

export default function PlayerTable({
  players,
  draftedIds,
  onSelect,
  manualDrafted,
  onToggleManualDrafted,
}: {
  players: RankedPlayer[];
  draftedIds: Set<number>;
  onSelect: (playerId: number) => void;
  manualDrafted: Set<number>;
  onToggleManualDrafted: (playerId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [hideDrafted, setHideDrafted] = useState(true);

  const filtered = useMemo(() => {
    let list = players;
    if (hideDrafted) list = list.filter((p) => !draftedIds.has(p.id));
    if (position !== "ALL") list = list.filter((p) => p.position === position);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.fullName.toLowerCase().includes(q));
    }
    const capped = query.trim() ? list : list.slice(0, 150);
    return capped;
  }, [players, draftedIds, position, query, hideDrafted]);

  return (
    <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players..."
          style={{
            flex: 1,
            minWidth: 160,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as Position | "ALL")}
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
          <input type="checkbox" checked={hideDrafted} onChange={(e) => setHideDrafted(e.target.checked)} />
          Hide drafted
        </label>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--panel)", zIndex: 1 }}>
              <th style={th}>#</th>
              <th style={th}>Pos</th>
              <th style={th}>Player</th>
              <th style={th}>Team</th>
              <th style={thRight}>Proj</th>
              <th style={thRight}>VOR</th>
              <th style={thRight}>Tier</th>
              <th style={thRight}>ADP</th>
              <th style={thRight}>% Own</th>
              <th style={thRight}>Drafted?</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const drafted = draftedIds.has(p.id);
              const isManual = manualDrafted.has(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  style={{
                    cursor: "pointer",
                    opacity: drafted ? 0.4 : 1,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td style={td}>{p.rank}</td>
                  <td style={td}>
                    <PositionBadge position={p.position} />
                  </td>
                  <td style={td}>
                    {p.fullName}
                    {p.injuryStatus ? (
                      <span style={{ color: "var(--bad)", fontSize: 11, marginLeft: 6 }}>
                        {p.injuryStatus}
                      </span>
                    ) : null}
                    {p.newsFlag && (
                      <span
                        title={p.newsFlag.headline}
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          color: p.newsFlag.category === "legal" ? "var(--bad)" : "var(--warn)",
                          cursor: "help",
                        }}
                      >
                        ⚠ {p.newsFlag.category === "legal" ? "OFF-FIELD" : "NEWS"}
                      </span>
                    )}
                    {drafted && (
                      <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>
                        {isManual ? "DRAFTED (manual)" : "DRAFTED"}
                      </span>
                    )}
                  </td>
                  <td style={td}>{p.proTeam}</td>
                  <td style={tdRight}>{p.projectedPoints.toFixed(1)}</td>
                  <td style={tdRight}>{p.valueOverReplacement.toFixed(1)}</td>
                  <td style={tdRight}>{p.tier}</td>
                  <td style={tdRight}>{p.adp ? p.adp.toFixed(1) : "—"}</td>
                  <td style={tdRight}>{p.percentOwned.toFixed(0)}%</td>
                  <td style={tdRight}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleManualDrafted(p.id);
                      }}
                      disabled={drafted && !isManual}
                      title={
                        drafted && !isManual
                          ? "Synced from ESPN — can't be manually undone"
                          : isManual
                          ? "Click to undo"
                          : "Mark as drafted (by anyone)"
                      }
                      style={{
                        background: isManual ? "var(--panel-2)" : "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: drafted && !isManual ? "var(--border)" : "var(--text)",
                        cursor: drafted && !isManual ? "not-allowed" : "pointer",
                      }}
                    >
                      {isManual ? "Undo" : "Mark"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...td, color: "var(--muted)", textAlign: "center", padding: 20 }}>
                  No players match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  color: "var(--muted)",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "1px solid var(--border)",
};
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "6px 8px" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right" };
