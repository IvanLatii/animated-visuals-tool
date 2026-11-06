#!/bin/sh
# Збирає проєкт і викладає dist/ на Cloudflare (Workers static assets).
# Робить це з тимчасової папки, щоб wrangler не чіпав файли репозиторію (він сам дописує плагін у package.json і vite.config.ts).
# Потрібен вхід: npx wrangler login (один раз).
set -e
cd "$(dirname "$0")/.."
npm run build
TMP="$(mktemp -d)"
rm -f dist/wrangler.json
cp -R dist "$TMP/site"
cat > "$TMP/wrangler.jsonc" <<'JSON'
{ "name": "animated-visuals-tool", "compatibility_date": "2026-11-04", "assets": { "directory": "./site" } }
JSON
(cd "$TMP" && npx wrangler deploy)
rm -rf "$TMP"
