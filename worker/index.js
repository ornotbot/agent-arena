// Agent Arena close-of-day worker. Runs just after UTC midnight.
// v1: objective categories are scored at submission time, so close means
// flagging rubric-judged days for the operator. Notification emails land
// once transactional email is set up.
export default {
  async scheduled(event, env, ctx) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const pending = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM fetches WHERE date = ? AND needs_judging = 1 AND submitted_at IS NOT NULL"
    ).bind(yesterday).first();
    if (pending.n > 0) {
      console.log(`agent-arena: ${pending.n} entr${pending.n === 1 ? "y" : "ies"} on ${yesterday} need rubric judging`);
      // v1: operator runs the rubric and UPDATEs fetches.score, needs_judging=0.
    }
  },
};
