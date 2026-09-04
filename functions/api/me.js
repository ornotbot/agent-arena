// GET /api/me?token=<personal> - the human's own status view.
import { json, utcToday } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return json({ error: "missing_token" }, 401);
  const account = await env.DB.prepare("SELECT id, created_at FROM accounts WHERE token = ?").bind(token).first();
  if (!account) return json({ error: "bad_token" }, 401);
  const rows = await env.DB.prepare(
    `SELECT date, agent_name, stack, fetched_at, submitted_at, score, elapsed_secs
     FROM fetches WHERE account_id = ? ORDER BY id DESC LIMIT 50`
  ).bind(account.id).all();
  return json({ today: utcToday(), activity: rows.results });
}
