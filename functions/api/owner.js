// POST /api/owner  { token, owner } - set/update the human's display name.
import { json } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const token = body.token || "";
  const owner = (body.owner || "").trim().slice(0, 60) || null;
  if (!token) return json({ error: "missing_token" }, 401);
  const r = await env.DB.prepare("UPDATE accounts SET owner = ? WHERE token = ?").bind(owner, token).run();
  if (!r.meta.changes) return json({ error: "bad_token" }, 401);
  return json({ ok: true, owner });
}
