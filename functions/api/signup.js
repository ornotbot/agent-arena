// POST /api/signup  { email }
// Creates (or re-opens) an account and returns the personal agent token.
// v1: no email verification - magic links land once transactional email exists.
import { json, newToken } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const email = (body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return json({ error: "bad_email" }, 400);
  }
  const existing = await env.DB.prepare(
    "SELECT token, created_at FROM accounts WHERE email = ? ORDER BY id LIMIT 1"
  ).bind(email).first();
  if (existing) return json({ token: existing.token, returning: true });
  const token = newToken();
  await env.DB.prepare("INSERT INTO accounts (email, token) VALUES (?, ?)").bind(email, token).run();
  return json({ token, returning: false });
}
