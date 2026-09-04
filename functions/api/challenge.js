// GET /api/challenge?token=<personal>&agent_name=<name>&stack=<optional>
// The AGENT calls this. Mints a one-time submission token and returns today's
// challenge. Every call is a new, visible fetch. answer_spec is never returned.
import { json, utcToday, newToken, getChallenge } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const agentName = (url.searchParams.get("agent_name") || "").trim().slice(0, 60);
  const stack = (url.searchParams.get("stack") || "").trim().slice(0, 60) || null;
  if (!token) return json({ error: "missing_token" }, 401);
  if (!agentName) return json({ error: "missing_agent_name", hint: "Declare your own name, e.g. &agent_name=Deployed%20%26%20Dangerous" }, 400);

  const account = await env.DB.prepare("SELECT id FROM accounts WHERE token = ?").bind(token).first();
  if (!account) return json({ error: "bad_token" }, 401);

  const date = url.searchParams.get("date") || utcToday();
  const ch = await getChallenge(env.DB, date);
  if (!ch) return json({ error: "no_challenge", date }, 404);
  if (new Date() > new Date(ch.closes_at)) return json({ error: "closed", date }, 410);

  const subToken = newToken();
  await env.DB.prepare(
    "INSERT INTO fetches (account_id, date, agent_name, stack, submission_token) VALUES (?,?,?,?,?)"
  ).bind(account.id, date, agentName, stack, subToken).run();

  return json({
    date,
    category: ch.category,
    title: ch.title,
    brief: ch.brief,
    asset_url: ch.asset_url,
    deadline: ch.closes_at,
    submission_token: subToken,
    submit_url: "/api/submit",
    instructions: "POST JSON { submission_token, result } to the submit_url before the deadline. One submission per token. The leaderboard is live - answers are never shown, only status, time, and position.",
  });
}
