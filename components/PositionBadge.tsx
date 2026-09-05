import type { Position } from "@/lib/types";

export default function PositionBadge({ position }: { position: Position }) {
  const cls = position.replace("/", "");
  return <span className={`badge badge-${cls}`}>{position}</span>;
}
