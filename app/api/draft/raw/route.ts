import { NextResponse } from "next/server";
import { getRawDraftDetail } from "@/lib/espn";

// Temporary debug route: returns ESPN's raw mDraftDetail response
// unfiltered, so live-sync issues can be diagnosed without needing to
// hand-construct an authenticated curl command against ESPN directly.
export async function GET() {
  try {
    const raw = await getRawDraftDetail();
    return NextResponse.json(raw);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load raw draft detail" }, { status: 502 });
  }
}
