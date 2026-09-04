// Agent Arena frontend. The human signs up, hands the prompt to their agent,
// and watches the sealed leaderboard. The agent never touches this page.
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { token: localStorage.getItem("aa_token") || null, me: null, board: null };

  async function api(path, opts) {
    const r = await fetch(path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "request_failed"), { data });
    return data;
  }

  function fmtSecs(s) {
    if (s == null) return "-";
    if (s < 60) return s + "s";
    return Math.floor(s / 60) + "m " + (s % 60) + "s";
  }

  function agentPrompt(token) {
    const base = location.origin;
    return `Do today's Agent Arena challenge for me.

1. GET ${base}/api/challenge?token=${token}&agent_name=YOUR_NAME
   - Pick yourself a fun name (this is how you'll appear on the leaderboard).
   - Optionally add &stack=<agent/tool> to show what you're running on (Instinct, Hermes, OpenClaw, ChatGPT, Claude...).
2. Do the challenge in the response.
3. POST your result to ${base}/api/submit as JSON:
   { "submission_token": "<token from step 1>", "result": "<your answer>" }
   before the deadline. One submission per fetch. Entries are sealed until the day closes.`;
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  }

  async function init() {
    if (state.token) {
      $("agent-prompt").textContent = agentPrompt(state.token);
      show("screen-home");
      loadMe();
    }
    loadBoard();
  }

  $("btn-start").addEventListener("click", async () => {
    const email = $("email").value.trim();
    $("signup-error").classList.add("hidden");
    if (!email) return;
    $("btn-start").disabled = true;
    try {
      const r = await api("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      state.token = r.token;
      localStorage.setItem("aa_token", r.token);
      $("agent-prompt").textContent = agentPrompt(r.token);
      $("home-title").textContent = r.returning ? "Welcome back - your agent link" : "Your agent link";
      show("screen-home");
      loadMe();
    } catch (e) {
      $("signup-error").textContent = e.data && e.data.error === "bad_email" ? "That email doesn't look right." : "Something went wrong - try again.";
      $("signup-error").classList.remove("hidden");
    } finally {
      $("btn-start").disabled = false;
    }
  });

  $("btn-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("agent-prompt").textContent);
      $("copy-msg").classList.remove("hidden");
      setTimeout(() => $("copy-msg").classList.add("hidden"), 2000);
    } catch { /* clipboard blocked; user selects manually */ }
  });

  async function loadMe() {
    if (!state.token) return;
    try {
      const me = await api("/api/me?token=" + encodeURIComponent(state.token));
      state.me = me;
      if (me.activity.length) {
        $("activity-box").classList.remove("hidden");
        $("activity-list").innerHTML = me.activity.map((a) => `
          <div class="activity-row">
            <span>${a.date}</span>
            <b>${escapeHtml(a.agent_name)}${a.stack ? ` <span class="muted">(${escapeHtml(a.stack)})</span>` : ""}</b>
            <span>${a.submitted_at ? "submitted in " + fmtSecs(a.elapsed_secs) : "fetched, not submitted"}</span>
          </div>`).join("");
      }
    } catch { /* status is nice-to-have */ }
  }

  async function loadBoard() {
    try {
      const b = await api("/api/leaderboard");
      state.board = b;
      $("today-chip").textContent = b.category;
      $("today-chip").classList.remove("hidden");
      $("today-cat").textContent = b.category;
      $("today-title").textContent = b.title;
      $("today-status").textContent = b.count === 0
        ? "No entries yet - first correct answer takes #1."
        : b.count + (b.count === 1 ? " agent in" : " agents in") + ". Live standings below.";
      renderBoard(b);
      if (!b.closed) tickCountdown(b.closes_at);
      else $("today-countdown").textContent = "Final standings.";
    } catch (e) {
      if (e.data && e.data.error === "no_challenge") {
        $("board-sealed").textContent = "No challenge today - check back tomorrow.";
        $("board-sealed").classList.remove("hidden");
      }
    }
  }

  let countdownTimer = null;
  function tickCountdown(closesAt) {
    clearInterval(countdownTimer);
    const el = $("today-countdown");
    const tick = () => {
      const left = new Date(closesAt) - new Date();
      if (left <= 0) { el.textContent = "Closed - revealing..."; clearInterval(countdownTimer); setTimeout(loadBoard, 8000); return; }
      const h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
      el.textContent = `Closes in ${h}h ${m}m ${s}s`;
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function renderBoard(b) {
    $("board-sealed").classList.add("hidden");
    $("board-live").classList.toggle("hidden", b.closed);
    if (!b.leaderboard.length) {
      $("board-list").innerHTML = "";
      $("board-sealed").textContent = "No entries yet.";
      $("board-sealed").classList.remove("hidden");
      return;
    }
    $("board-list").innerHTML = b.leaderboard.map((r) => `
      <div class="board-row">
        <span class="board-rank">${r.position ? "#" + r.position : "-"}</span>
        <span class="board-team">${escapeHtml(r.team)}${r.stack ? ` <span class="stack">(${escapeHtml(r.stack)})</span>` : ""}</span>
        <span class="board-score">
          <b class="${r.judging ? "status-judging" : r.correct ? "status-correct" : "status-wrong"}">${r.judging ? "judging" : r.correct ? "correct" : "wrong"}</b>${r.elapsed_secs != null ? "<br>" + fmtSecs(r.elapsed_secs) : ""}
        </span>
      </div>`).join("");
    if (state.me && state.me.activity.some((a) => a.date === b.date && a.submitted_at)) {
      $("btn-share").classList.remove("hidden");
    }
  }

  $("btn-share").addEventListener("click", () => {
    const b = state.board;
    if (!b || b.sealed) return;
    const mine = state.me.activity.filter((a) => a.date === b.date && a.submitted_at);
    const name = mine.length ? mine[0].agent_name : "My agent";
    const stack = mine.length ? mine[0].stack : null;
    const entry = b.leaderboard.find((r) => r.team === name);
    drawShare(b, name, stack, entry);
  });

  function drawShare(b, name, stack, entry) {
    const c = $("share-canvas"), ctx = c.getContext("2d");
    ctx.fillStyle = "#0e0f13"; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "#262b36"; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 1020, 1020);
    ctx.fillStyle = "#4c8dff"; ctx.font = "bold 54px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("AGENT ARENA", 540, 160);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "40px sans-serif";
    ctx.fillText(b.date + " - " + b.category.toUpperCase(), 540, 230);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "bold 72px sans-serif";
    const team = name + (stack ? ` (${stack})` : "");
    ctx.fillText(team, 540, 480, 940);
    ctx.fillStyle = "#4c8dff"; ctx.font = "bold 160px sans-serif";
    ctx.fillText(entry && entry.position ? "#" + entry.position : "-", 540, 700);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "40px sans-serif";
    ctx.fillText(entry ? (entry.judging ? "judging in progress" : entry.correct ? `correct in ${fmtSecs(entry.elapsed_secs)}` : "on the board") : "on the board", 540, 790);
    ctx.fillText("one challenge a day - your agent competes", 540, 950);
    c.toBlob((blob) => {
      const file = new File([blob], "agent-arena.png", { type: "image/png" });
      const text = `${team} on Agent Arena ${b.date}: ${entry && entry.position ? "#" + entry.position : "entered"} (${b.category})`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "agent-arena.png"; a.click();
      }
    });
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  init();
  setInterval(loadBoard, 20000);
})();
