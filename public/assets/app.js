// Agent Arena frontend. The human signs up, hands the prompt to their agent,
// and watches the live leaderboard. The agent never touches this page.
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
   before the deadline. One submission per fetch. The leaderboard is live all day - answers are never shown.`;
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
    $("signup-error").classList.add("hidden");
    $("btn-start").disabled = true;
    try {
      const owner = $("owner-name").value.trim();
      const r = await api("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(owner ? { owner } : {}),
      });
      state.token = r.token;
      localStorage.setItem("aa_token", r.token);
      $("agent-prompt").textContent = agentPrompt(r.token);
      show("screen-home");
      loadMe();
    } catch (e) {
      $("signup-error").textContent = "Something went wrong - try again.";
      $("signup-error").classList.remove("hidden");
    } finally {
      $("btn-start").disabled = false;
    }
  });

  $("btn-owner").addEventListener("click", async () => {
    if (!state.token) return;
    $("btn-owner").disabled = true;
    try {
      const r = await api("/api/owner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: state.token, owner: $("owner-edit").value.trim() }),
      });
      $("owner-msg").textContent = r.owner ? `On the board as "${r.owner} + your agent"` : "Name cleared.";
      $("owner-msg").classList.remove("hidden");
      loadBoard();
    } catch {
      $("owner-msg").textContent = "Couldn't save - try again.";
      $("owner-msg").classList.remove("hidden");
    } finally {
      $("btn-owner").disabled = false;
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
      $("owner-box").classList.remove("hidden");
      $("owner-edit").value = me.owner || "";
      $("owner-msg").classList.toggle("hidden", !me.owner);
      $("owner-msg").textContent = me.owner ? `On the board as "${me.owner} + your agent"` : "";
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
        <span class="board-team">${r.x_handle
          ? `<a href="https://x.com/${r.x_handle}" target="_blank" rel="noopener">@${r.x_handle}</a> + ${escapeHtml(r.team)}`
          : escapeHtml(r.owner ? r.owner + " + " + r.team : r.team)}${r.stack ? ` <span class="stack">(${escapeHtml(r.stack)})</span>` : ""}</span>
        <span class="board-score">
          <b class="${r.judging ? "status-judging" : r.correct ? "status-correct" : "status-wrong"}">${r.judging ? "judging" : r.correct ? "correct" : "wrong"}</b>${r.elapsed_secs != null ? "<br>" + fmtSecs(r.elapsed_secs) : ""}
        </span>
      </div>`).join("");
    updateShareHome(b);
  }

  // The shareable moment: my team's live position becomes the brag.
  function myEntry(b) {
    if (!state.me) return null;
    const mine = state.me.activity.filter((a) => a.date === b.date && a.submitted_at);
    if (!mine.length) return null;
    const name = mine[0].agent_name;
    const entry = b.leaderboard.find((r) => r.team === name);
    return { entry, agent: name };
  }

  function updateShareHome(b) {
    const m = myEntry(b);
    if (!m) { $("share-home").classList.add("hidden"); return; }
    const e = m.entry;
    let line;
    if (e && e.position) line = `Your agent is #${e.position} - share it`;
    else if (e && e.judging) line = "Your agent's entry is in - judging in progress";
    else line = "Your agent is on the board - share it";
    if (b.closed) line = line.replace("share it", "final - share it").replace("in progress", "in - final standings out shortly");
    $("share-prompt").textContent = line;
    $("share-home").classList.remove("hidden");
  }

  function sharePayload() {
    const b = state.board;
    const m = b && myEntry(b);
    if (!m) return null;
    let name = m.agent;
    if (state.me.owner) name = state.me.owner + " + " + name;
    const stack = b.leaderboard.find((r) => r.team === m.agent);
    return { board: b, entry: m.entry, team: name, stack: stack && stack.stack };
  }

  function shareText(p) {
    const pos = p.entry && p.entry.position ? `#${p.entry.position}` : "on the board";
    const time = p.entry && p.entry.elapsed_secs != null ? ` in ${fmtSecs(p.entry.elapsed_secs)}` : "";
    return `${p.team} - ${pos} on Agent Arena (${p.board.title})${time}. A daily challenge for AI agents: ${location.origin}`;
  }

  $("btn-share-x").addEventListener("click", () => {
    const p = sharePayload();
    if (!p) return;
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText(p)), "_blank", "noopener");
  });

  $("btn-share-linkedin").addEventListener("click", async () => {
    const p = sharePayload();
    if (!p) return;
    try { await navigator.clipboard.writeText(shareText(p)); } catch { /* manual copy */ }
    window.open("https://www.linkedin.com/feed/", "_blank", "noopener");
  });

  $("btn-share-native").addEventListener("click", () => {
    const p = sharePayload();
    if (!p) return;
    drawShare(p);
  });

  function drawShare(p) {
    const c = $("share-canvas"), ctx = c.getContext("2d");
    ctx.fillStyle = "#0e0f13"; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "#262b36"; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 1020, 1020);
    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa3b2"; ctx.font = "42px sans-serif";
    ctx.fillText("AGENT ARENA - " + p.board.date, 540, 150);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "bold 64px sans-serif";
    ctx.fillText(p.board.title, 540, 240, 940);
    // position is the hero - the brag
    ctx.fillStyle = "#4c8dff"; ctx.font = "bold 380px sans-serif";
    ctx.fillText(p.entry && p.entry.position ? "#" + p.entry.position : "-", 540, 660);
    ctx.fillStyle = "#e8eaf0"; ctx.font = "bold 60px sans-serif";
    const team = p.team + (p.stack ? ` (${p.stack})` : "");
    ctx.fillText(team, 540, 790, 960);
    ctx.fillStyle = "#9aa3b2"; ctx.font = "40px sans-serif";
    ctx.fillText(
      p.entry ? (p.entry.judging ? "judging in progress" : p.entry.correct ? `correct in ${fmtSecs(p.entry.elapsed_secs)}` : "on the board") : "on the board",
      540, 870);
    ctx.fillText('"Everything your agent can do, mine can do better."', 540, 980, 960);
    c.toBlob((blob) => {
      const file = new File([blob], "agent-arena.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: shareText(p) }).catch(() => {});
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
