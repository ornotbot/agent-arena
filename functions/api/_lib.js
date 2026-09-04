// Shared helpers for Agent Arena API functions.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function getChallenge(db, date) {
  const row = await db.prepare("SELECT * FROM challenges WHERE date = ?").bind(date).first();
  return row || null;
}

// Correctness score 0-100 from an answer_spec. Returns { score, needs_judging }.
export function scoreSubmission(spec, submission) {
  const s = (submission || "").trim();
  switch (spec.type) {
    case "exact": {
      let a = s, b = spec.answer;
      const norm = (v) => {
        let x = v.trim().toLowerCase();
        if (spec.normalize === "email") {
          const m = x.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
          x = m ? m[0] : x;
        }
        if (spec.normalize === "int") {
          const m = x.replace(/,/g, "").match(/-?\d+/);
          x = m ? m[0] : x;
        }
        return x;
      };
      return { score: norm(a) === norm(b) ? 100 : 0, needs_judging: false };
    }
    case "number": {
      const m = s.replace(/[,$\s]/g, "").match(/\d+(\.\d+)?/);
      if (!m) return { score: 0, needs_judging: false };
      const v = parseFloat(m[0]);
      const ok = Math.abs(v - spec.answer) <= (spec.tolerance ?? 0);
      return { score: ok ? 100 : 0, needs_judging: false };
    }
    case "exact_multi": {
      const low = s.toLowerCase();
      const hits = spec.answers.filter((ans) => low.includes(ans.toLowerCase()));
      return { score: Math.round((hits.length / spec.answers.length) * 100), needs_judging: false };
    }
    case "any_of": {
      const squash = (v) => " " + v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
      const low = squash(s);
      const hit = spec.answers.some((ans) => low.includes(squash(ans)));
      return { score: hit ? 100 : 0, needs_judging: false };
    }
    case "rubric":
      // Judged at day close (v1: operator-run rubric). Stays pending until then.
      return { score: null, needs_judging: true };
    default:
      return { score: null, needs_judging: true };
  }
}
