#!/usr/bin/env bash
# Sync this OSS web client from the private unison-mobile monorepo.
#
# Because the shared packages are *vendored* (copied) rather than referenced as a
# git subtree, "pulling upstream changes" = re-running the same deterministic
# extraction every time. This script mirrors clients/web + the vendored packages
# from unison-mobile's chosen ref, re-applies the standalone transforms, verifies,
# and leaves the changes staged for you to review and open a PR.
#
# It NEVER commits, pushes, or deploys. You review the diff, then open a PR.
#
# Usage:
#   scripts/sync-from-upstream.sh [path-to-unison-mobile] [ref]
# Defaults:
#   path-to-unison-mobile = ../unison-mobile
#   ref                   = origin/main
#
# Example:
#   scripts/sync-from-upstream.sh ~/IdeaProjects/unison-mobile origin/main

set -euo pipefail

MONO="${1:-../unison-mobile}"
REF="${2:-origin/main}"
OSS="$(cd "$(dirname "$0")/.." && pwd)"

[ -d "$MONO/.git" ] || { echo "error: '$MONO' is not a git repo (pass the unison-mobile path as arg 1)"; exit 1; }

echo "→ fetching $REF in $MONO"
git -C "$MONO" fetch --quiet origin

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$MONO" archive "$REF" clients/web packages/contracts packages/client-core packages/testkit | tar -x -C "$TMP"

echo "→ mirroring source trees (manifests/config are NOT touched — they stay standalone)"
rsync -a --delete "$TMP/clients/web/app/"    "$OSS/app/"
rsync -a --delete "$TMP/clients/web/src/"    "$OSS/src/"
rsync -a --delete "$TMP/clients/web/public/" "$OSS/public/"
cp "$TMP/clients/web/middleware.ts" "$TMP/clients/web/postcss.config.ts" "$TMP/clients/web/next-env.d.ts" "$OSS/"

rsync -a --delete "$TMP/packages/contracts/src/"   "$OSS/packages/contracts/src/"
rsync -a --delete "$TMP/packages/client-core/src/" "$OSS/packages/client-core/src/"

# Vendored testkit: only the http + fixtures subpaths the client tests use.
cp "$TMP/packages/testkit/src/http/index.ts" "$TMP/packages/testkit/src/http/sse.ts" "$OSS/packages/testkit/src/http/"
cp "$TMP/packages/testkit/src/fixtures/index.ts" "$TMP/packages/testkit/src/fixtures/contracts.ts" "$TMP/packages/testkit/src/fixtures/wire.ts" "$OSS/packages/testkit/src/fixtures/"
rsync -a --delete "$TMP/packages/testkit/fixtures/" "$OSS/packages/testkit/fixtures/"

echo "→ re-applying standalone transforms"
# client-core's tool-display test pulls @unison/tools (not vendored) — drop it.
rm -f "$OSS/packages/client-core/src/tool-display.test.ts"

# Sanitize the internal email domain to an env var. Hard-assert the upstream shape
# so an upstream rename fails loudly here instead of silently shipping the domain.
UIA="$OSS/src/features/observability/use-internal-account.ts"
if grep -q 'INTERNAL_EMAIL_DOMAIN = "@unisonlabs.ai"' "$UIA"; then
  perl -0pi -e 's/export const INTERNAL_EMAIL_DOMAIN = "\@unisonlabs\.ai";/export const INTERNAL_EMAIL_DOMAIN =\n\tprocess.env.NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN ?? "\@example.com";/' "$UIA"
elif grep -q 'NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN' "$UIA"; then
  : # already the env form upstream — nothing to do
else
  echo "error: use-internal-account.ts no longer matches the expected INTERNAL_EMAIL_DOMAIN shape — update this script"; exit 1
fi

echo "→ verifying (install · typecheck · lint · test)"
cd "$OSS"
bun install
bun run typecheck
bun run lint
bun run test

echo
echo "✓ sync complete. Review the diff, then open a PR:"
echo "    git checkout -b sync-from-monorepo-\$(date +%Y-%m-%d)"
echo "    git add -A && git commit -m 'Sync web client from unison-mobile $REF'"
echo "    git push -u origin HEAD && gh pr create --base main"
git status --short
