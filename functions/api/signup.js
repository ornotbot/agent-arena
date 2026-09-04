// POST /api/signup  (no body needed)
// One tap issues a personal agent token - no email, no validation friction.
// The token IS the identity (kept in the human's localStorage). An optional
// email field may return later for recovery once transactional email exists.
import { json, newToken } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const token = newToken();
  await env.DB.prepare("INSERT INTO accounts (token) VALUES (?)").bind(token).run();
  return json({ token });
}
