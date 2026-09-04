-- Email is no longer collected at signup (kept nullable for future optional recovery).
CREATE TABLE accounts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO accounts_new SELECT id, email, token, created_at FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;
