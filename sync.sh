#!/usr/bin/env bash
# Copy the brand pages and POCs from the Isol repo into public/.
# Usage: ./sync.sh [path-to-Isol]   (default: ../Isol)
set -euo pipefail
SRC="${1:-$(dirname "$0")/../Isol}"
DEST="$(dirname "$0")/public"
mkdir -p "$DEST"

# Brand: the pages, the palettes and the print. The fonts/ folder is left out:
# the pages embed their fonts, and the raw TTFs are ~22 MB.
rsync -a --delete --exclude 'fonts/' "$SRC/brand/" "$DEST/brand/"

# POCs: everything the pages load. Build sources and scripts stay behind.
rsync -a --delete \
  --exclude 'build.mjs' --exclude 'build-global.mjs' --exclude 'shared/src/' \
  --exclude 'README.md' --exclude 'node_modules/' \
  "$SRC/poc/" "$DEST/poc/"

touch "$DEST/.nojekyll"
echo "synced $SRC → $DEST"
