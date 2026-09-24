#!/usr/bin/env bash
# Stop hook: block Claude from ending a turn while the working tree has uncommitted changes.
input=$(cat)

# Avoid an infinite loop if Claude already got one nudge this turn.
if echo "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changes=$(git status --porcelain)
if [ -n "$changes" ]; then
  {
    echo "Uncommitted changes remain. Follow the atomic-commits skill: group these into small, single-purpose commits until 'git status --porcelain' is empty."
    echo "$changes"
  } >&2
  exit 2
fi
exit 0
