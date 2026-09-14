#!/usr/bin/env bash
#
# Publish the contents of dist/ into the gh-pages branch.
#
#   $1 — destination path within the branch. Empty = site root (production).
#        Anything else = a subfolder, e.g. "preview/my-branch".
#
# Production replaces everything at the root but deliberately preserves the
# preview/ tree, so deploying to firebase never wipes open preview builds.
set -euo pipefail

DEST="${1:-}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
WORK="$(mktemp -d)"

if ! git clone --depth 1 --branch gh-pages "$REPO_URL" "$WORK" 2>/dev/null; then
  echo "gh-pages branch does not exist yet — creating it."
  git init -q "$WORK"
  git -C "$WORK" remote add origin "$REPO_URL"
  git -C "$WORK" checkout -q --orphan gh-pages
fi

if [ -z "$DEST" ]; then
  find "$WORK" -mindepth 1 -maxdepth 1 \
    ! -name '.git' ! -name 'preview' -exec rm -rf {} +
  cp -r dist/. "$WORK/"
else
  rm -rf "${WORK:?}/${DEST}"
  mkdir -p "$WORK/$DEST"
  cp -r dist/. "$WORK/$DEST/"
fi

# Without this, Pages runs Jekyll and drops any file or folder starting with _.
touch "$WORK/.nojekyll"

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed — skipping push."
  exit 0
fi
git -c user.name='github-actions[bot]' \
    -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    commit -q -m "${COMMIT_MESSAGE:-Publish ${DEST:-site}}"
git push -q origin gh-pages
echo "Published to gh-pages${DEST:+/$DEST}"
