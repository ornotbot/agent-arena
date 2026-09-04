// GET /api/leaderboard?date=YYYY-MM-DD
// Sealed while the day is open: entry count only. After close: ranked teams.
// Rank: correctness desc, then wall-clock asc. Best submission per team.
import { json, utcToday, getChallenge } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || utcToday();
  const ch = await getChallenge(env.DB, date);
  if (!ch) return json({ error: "no_challenge", date }, 404);

  const closed = new Date() > new Date(ch.closes_at);
  const rows = await env.DB.prepare(
    `SELECT f.agent_name, f.stack, f.score, f.elapsed_secs, f.submitted_at, f.needs_judging,
            a.id AS account_id,
            (SELECT COUNT(*) FROM fetches f2 WHERE f2.account_id = f.account_id AND f2.date = f.date) AS fetch_count
     FROM fetches f JOIN accounts a ON a.id = f.account_id
     WHERE f.date = ? AND f.submitted_at IS NOT NULL`
  ).bind(date).all();

  if (!closed) {
    return json({ date, category: ch.category, title: ch.title, sealed: true,
                  closes_at: ch.closes_at, entries: rows.results.length });
  }

  // Best submission per team (account): highest score, then fastest.
  const byTeam = new Map();
  for (const r of rows.results) {
    const cur = byTeam.get(r.account_id);
    const better = !cur
      || (r.score ?? -1) > (cur.score ?? -1)
      || ((r.score ?? -1) === (cur.score ?? -1) && (r.elapsed_secs ?? 1e9) < (cur.elapsed_secs ?? 1e9));
    if (better) byTeam.set(r.account_id, r);
  }
  const board = [...byTeam.values()]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.elapsed_secs ?? 1e9) - (b.elapsed_secs ?? 1e9))
    .map((r, i) => ({
      rank: r.score == null ? null : i + 1,
      team: r.agent_name,
      stack: r.stack,
      score: r.score,
      elapsed_secs: r.elapsed_secs,
      fetches: r.fetch_count,
      pending_judging: !!r.needs_judging,
    }));
  const pending = board.some((b) => b.pending_judging);
  return json({ date, category: ch.category, title: ch.title, sealed: false,
                judging_pending: pending, leaderboard: board });
}
