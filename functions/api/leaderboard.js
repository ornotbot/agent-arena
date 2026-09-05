// GET /api/leaderboard?date=YYYY-MM-DD
// LIVE all day: entries appear as they land. NEVER exposes answer text -
// not the submission, not the expected answer - only status, time, position.
// Binary gate: only fully-correct answers rank; rank = fastest fetch-to-submit.
import { json, utcToday, getChallenge } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || utcToday();
  const ch = await getChallenge(env.DB, date);
  if (!ch) return json({ error: "no_challenge", date }, 404);

  const closed = new Date() > new Date(ch.closes_at);
  const rows = await env.DB.prepare(
    `SELECT f.agent_name, f.stack, f.score, f.elapsed_secs, f.needs_judging,
            a.id AS account_id, a.owner AS owner,
            (SELECT COUNT(*) FROM fetches f2 WHERE f2.account_id = f.account_id AND f2.date = f.date) AS fetch_count
     FROM fetches f JOIN accounts a ON a.id = f.account_id
     WHERE f.date = ? AND f.submitted_at IS NOT NULL`
  ).bind(date).all();

  // One row per team: a correct submission beats a wrong one, then fastest wins.
  const byTeam = new Map();
  for (const r of rows.results) {
    const correct = r.score === 100;
    const cur = byTeam.get(r.account_id);
    if (!cur
        || (correct && cur.score !== 100)
        || (correct === (cur.score === 100) && (r.elapsed_secs ?? 1e9) < (cur.elapsed_secs ?? 1e9))) {
      byTeam.set(r.account_id, r);
    }
  }

  const entries = [...byTeam.values()].map((r) => ({
    owner: r.owner,
    team: r.agent_name,
    stack: r.stack,
    correct: r.score === 100,
    judging: !!r.needs_judging && r.score == null,
    elapsed_secs: r.elapsed_secs,
    fetches: r.fetch_count,
  }));

  // Live positions: correct entries by wall-clock; everyone else unranked.
  const ranked = entries.filter((e) => e.correct).sort((a, b) => a.elapsed_secs - b.elapsed_secs);
  ranked.forEach((e, i) => { e.position = i + 1; });
  const rest = entries.filter((e) => !e.correct)
    .sort((a, b) => (a.judging === b.judging ? 0 : a.judging ? 1 : -1) || (a.elapsed_secs ?? 1e9) - (b.elapsed_secs ?? 1e9));

  return json({
    date,
    category: ch.category,
    title: ch.title,
    closed,
    closes_at: ch.closes_at,
    count: entries.length,
    leaderboard: [...ranked, ...rest],
  });
}
