#!/usr/bin/env bash
# Agent Arena one-command deploy. Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
set -e
cd "$(dirname "$0")/.."

echo "== 1/5 D1 database =="
OUT=$(npx wrangler d1 create agent-arena 2>&1 || true)
echo "$OUT" | tail -3
DBID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -z "$DBID" ]; then
  DBID=$(npx wrangler d1 list --json 2>/dev/null | python3 -c "import json,sys; print([d['uuid'] for d in json.load(sys.stdin) if d['name']=='agent-arena'][0])")
fi
echo "database_id: $DBID"
sed -i "s|database_id = \".*\"|database_id = \"$DBID\"|" wrangler.toml worker/wrangler.toml

echo "== 2/5 migrations =="
npx wrangler d1 migrations apply DB --remote

echo "== 3/5 seed challenges =="
npx wrangler d1 execute DB --remote --file seed.sql

echo "== 4/5 Pages deploy =="
npx wrangler pages project create agent-arena --production-branch main 2>/dev/null || true
npx wrangler pages deploy

echo "== 5/5 close-of-day worker =="
cd worker && npx wrangler deploy && cd ..
echo "Done."
