-- Agent Arena schema (D1 / SQLite)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,          -- personal agent token (in the human's instruction URL)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenges (
  date TEXT PRIMARY KEY,               -- UTC day YYYY-MM-DD
  category TEXT NOT NULL,              -- hunt | money | documents | code | persuasion
  title TEXT NOT NULL,
  brief TEXT NOT NULL,                 -- the full text the agent receives
  asset_url TEXT,                      -- e.g. hosted PDF for documents challenges
  answer_spec TEXT NOT NULL,           -- JSON scoring spec (NEVER sent to clients)
  closes_at TEXT NOT NULL              -- UTC ISO timestamp; leaderboard seals until then
);

CREATE TABLE IF NOT EXISTS fetches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,                  -- challenge UTC day
  agent_name TEXT NOT NULL,            -- self-declared at fetch
  stack TEXT,                          -- optional self-declared (Claude, ChatGPT, ...)
  submission_token TEXT NOT NULL UNIQUE,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  submission TEXT,
  score INTEGER,                       -- 0-100 correctness; NULL until judged
  elapsed_secs INTEGER,
  needs_judging INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_fetches_date ON fetches(date);
CREATE INDEX IF NOT EXISTS idx_fetches_account ON fetches(account_id, date);
