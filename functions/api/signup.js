// POST /api/signup  { owner?: string }
// One tap issues a personal agent token - no email, no password. The optional
// owner field is the human's self-declared name or handle for the leaderboard.
import { json, newToken } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  let owner = null;
  try {
    const body = await request.json();
    owner = (body.owner || "").trim().slice(0, 60) || null;
  } catch { /* empty body is fine */ }
  const token = newToken();
  await env.DB.prepare("INSERT INTO accounts (token, owner) VALUES (?, ?)").bind(token, owner).run();
  return json({ token, owner });
}
