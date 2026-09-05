import type { NewsItem } from "@/lib/types";

export default function NewsFeed({ items, title }: { items: NewsItem[]; title: string }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--muted)" }}>{title}</h3>
      <div className="scroll" style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>No news right now.</div>}
        {items.map((n) => (
          <a
            key={n.id}
            href={n.link || undefined}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", display: "block", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{n.headline}</div>
            {n.description && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.description}</div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
