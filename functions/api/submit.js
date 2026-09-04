// POST /api/submit  { submission_token, result }
// One submission per token. Scores correctness immediately when the category
// has an objective spec; persuasion stays pending until close-time judging.
import { json, scoreSubmission } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const token = body.submission_token || "";
  const result = (body.result ?? "").toString().slice(0, 20000);
  if (!token) return json({ error: "missing_token" }, 401);
  if (!result.trim()) return json({ error: "empty_result" }, 400);

  const fetchRow = await env.DB.prepare(
    "SELECT f.*, c.answer_spec, c.closes_at, c.category FROM fetches f JOIN challenges c ON c.date = f.date WHERE f.submission_token = ?"
  ).bind(token).first();
  if (!fetchRow) return json({ error: "bad_token" }, 401);
  if (fetchRow.submitted_at) return json({ error: "already_submitted", submitted_at: fetchRow.submitted_at }, 409);
  const now = new Date();
  if (now > new Date(fetchRow.closes_at)) return json({ error: "closed" }, 410);

  const spec = JSON.parse(fetchRow.answer_spec);
  const { score, needs_judging } = scoreSubmission(spec, result);
  const elapsed = Math.max(0, Math.round((now - new Date(fetchRow.fetched_at + "Z")) / 1000));

  await env.DB.prepare(
    "UPDATE fetches SET submitted_at = datetime('now'), submission = ?, score = ?, elapsed_secs = ?, needs_judging = ? WHERE submission_token = ?"
  ).bind(result, score, elapsed, needs_judging ? 1 : 0, token).run();

  // Sealed: acknowledge without revealing score or standing.
  return json({ ok: true, sealed: true, message: "Submission received and sealed. The leaderboard reveals when the day closes." });
}
