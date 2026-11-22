#!/bin/bash
set -euo pipefail

# Cuts a release once the checks pass, numbered by the workflow run.
# GitHub sets GITHUB_RUN_NUMBER on every run, so the tag and the run share one number.

if [ -z "${GITHUB_RUN_NUMBER:-}" ]; then
  echo "GITHUB_RUN_NUMBER is not set"
  exit 1
fi

PREV_TAG=$(git describe --tags --match 'release-*' --abbrev=0 2>/dev/null || true)
RANGE="${PREV_TAG:+$PREV_TAG..HEAD}"
NOTES=$(git log ${RANGE:-HEAD} --oneline)

# A previous tag already at HEAD on a back-to-back deploy leaves an empty range, so the body still carries the head commit.
NOTES=${NOTES:-$(git log -1 HEAD --oneline)}

gh release create "release-$GITHUB_RUN_NUMBER" --title "Release #$GITHUB_RUN_NUMBER" --notes "$NOTES"
