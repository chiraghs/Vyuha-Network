#!/usr/bin/env bash
# Build the Vite frontend and stage it into the Catalyst client/ directory,
# preserving client-package.json. Run from the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
CLIENT="$ROOT/client"

echo "▸ Building frontend (VITE_API_BASE_URL=${VITE_API_BASE_URL:-<unset>})"
( cd "$FRONTEND" && npm install && npm run build )

echo "▸ Staging dist/ into client/ (keeping client-package.json)"
find "$CLIENT" -mindepth 1 -maxdepth 1 ! -name 'client-package.json' ! -name '.gitignore' -exec rm -rf {} +
cp -R "$FRONTEND/dist/." "$CLIENT/"

# Catalyst forbids the 404 page from equalling the homepage, but SPA routing
# needs unknown paths to serve the app shell — so ship a 404.html that is a
# copy of index.html (same bundle → the client router takes over).
cp "$CLIENT/index.html" "$CLIENT/404.html"

echo "✓ Client staged at $CLIENT"
