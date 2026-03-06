#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building dashboard..."
(cd dashboard && npm run build)

echo "==> Embedding dashboard into Go binary..."
rm -rf internal/server/dashboard
cp -r dashboard/dist internal/server/dashboard

echo "==> Building c9s..."
go build -o c9s ./cmd/

echo "==> Done: ./c9s ($(du -h c9s | cut -f1) with embedded dashboard)"
