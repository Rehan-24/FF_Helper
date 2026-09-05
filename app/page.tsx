"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DraftPick, LeagueSettings, NewsItem, Position, RankedPlayer } from "@/lib/types";
import { recommendPicks } from "@/lib/rankings";
import { sortPicks } from "@/lib/draft";
import RecommendationPanel from "@/components/RecommendationPanel";
import TeamRoster from "@/components/TeamRoster";
import PlayerTable from "@/components/PlayerTable";
import DraftBoard from "@/components/DraftBoard";
import NewsFeed from "@/components/NewsFeed";
import OnTheClock from "@/components/OnTheClock";

const DRAFT_POLL_MS = 6000;

export default function Home() {
  const [league, setLeague] = useState<LeagueSettings | null>(null);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [playerNews, setPlayerNews] = useState<{ player: RankedPlayer; items: NewsItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualDrafted, setManualDrafted] = useState<Set<number>>(new Set());
  const [draftPollError, setDraftPollError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("manualDraftedIds");
      if (stored) setManualDrafted(new Set(JSON.parse(stored)));
    } catch {
      // ignore — falls back to empty set
    }
  }, []);

  const toggleManualDrafted = useCallback((playerId: number) => {
    setManualDrafted((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      try {
        localStorage.setItem("manualDraftedIds", JSON.stringify(Array.from(next)));
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }, []);

  const loadCore = useCallback(async () => {
    try {
      const [leagueRes, playersRes, newsRes] = await Promise.all([
        fetch("/api/league").then((r) => r.json()),
        fetch("/api/players").then((r) => r.json()),
        fetch("/api/news").then((r) => r.json()),
      ]);
      if (leagueRes.error) {
        setError(leagueRes.error);
        setHint(leagueRes.hint || null);
      } else {
        setLeague(leagueRes.league);
        setError(null);
        setHint(null);
      }
      if (playersRes.players) setPlayers(playersRes.players);
      if (newsRes.news) setNews(newsRes.news);
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollDraft = useCallback(async () => {
    try {
      const res = await fetch("/api/draft").then((r) => r.json());
      if (res.draft) {
        setPicks(sortPicks(res.draft.picks));
        setDraftPollError(null);
        setLastSynced(new Date());
      } else if (res.error) {
        setDraftPollError(res.error);
      }
    } catch (e: any) {
      setDraftPollError(e?.message || "Draft poll failed");
    }
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    pollDraft();
    const id = setInterval(pollDraft, DRAFT_POLL_MS);
    return () => clearInterval(id);
  }, [pollDraft]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const draftedIds = useMemo(() => {
    const ids = new Set(picks.map((p) => p.playerId));
    for (const id of manualDrafted) ids.add(id);
    return ids;
  }, [picks, manualDrafted]);
  const available = useMemo(() => players.filter((p) => !draftedIds.has(p.id)), [players, draftedIds]);

  const myPlayers = useMemo(() => {
    if (!league?.myTeamId) return [];
    return picks
      .filter((p) => p.teamId === league.myTeamId)
      .map((p) => playersById.get(p.playerId))
      .filter((p): p is RankedPlayer => Boolean(p));
  }, [picks, league, playersById]);

  const myPositions = useMemo<Position[]>(() => myPlayers.map((p) => p.position), [myPlayers]);

  const recommendations = useMemo(() => {
    if (!league) return [];
    return recommendPicks(available, myPositions, league, 15);
  }, [available, myPositions, league]);

  const handleSelectPlayer = useCallback(async (playerId: number) => {
    const player = playersById.get(playerId);
    if (!player) return;
    try {
      const res = await fetch(`/api/news?playerId=${playerId}`).then((r) => r.json());
      setPlayerNews({ player, items: res.news || [] });
    } catch {
      setPlayerNews({ player, items: [] });
    }
  }, [playersById]);

  if (loading) {
    return (
      <div className="container">
        <p style={{ color: "var(--muted)" }}>Loading league, players, and draft state…</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>🏈 Fantasy Draft Helper</h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {league ? `${league.name} · ${league.size}-team · ${league.isPPR ? "PPR" : league.receptionPoints > 0 ? "Half-PPR" : "Standard"}` : "—"}
          </div>
        </div>
      </header>

      {error && (
        <div className="card" style={{ padding: 12, borderColor: "var(--bad)" }}>
          <div style={{ color: "var(--bad)", fontWeight: 600, fontSize: 13 }}>{error}</div>
          {hint && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{hint}</div>}
        </div>
      )}

      {league && <OnTheClock league={league} picksMade={picks.length} />}

      <div style={{ fontSize: 11, color: draftPollError ? "var(--bad)" : "var(--muted)" }}>
        {draftPollError
          ? `Draft sync failing: ${draftPollError}`
          : lastSynced
          ? `Draft synced ${lastSynced.toLocaleTimeString()} · ${picks.length} picks made`
          : "Syncing draft..."}
        {manualDrafted.size > 0 && ` · ${manualDrafted.size} marked manually`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {league && <TeamRoster league={league} myPlayers={myPlayers} />}
          {league && <RecommendationPanel recommendations={recommendations} onSelect={handleSelectPlayer} />}
        </div>

        <div style={{ height: 640 }}>
          <PlayerTable
            players={players}
            draftedIds={draftedIds}
            onSelect={handleSelectPlayer}
            manualDrafted={manualDrafted}
            onToggleManualDrafted={toggleManualDrafted}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {playerNews ? (
            <NewsFeed title={`News: ${playerNews.player.fullName}`} items={playerNews.items} />
          ) : (
            <NewsFeed title="Latest NFL / fantasy news" items={news} />
          )}
        </div>
      </div>

      {league && <DraftBoard picks={picks} league={league} playersById={playersById} />}
    </div>
  );
}
