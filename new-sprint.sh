#!/bin/bash
# ============================================
# SION OS — new-sprint.sh
# Creates a new git branch for a sprint
# Usage: bash new-sprint.sh "sprint-12-claude-api"
# ============================================

if [ -z "$1" ]; then
  echo "Usage: bash new-sprint.sh <branch-name>"
  echo "Example: bash new-sprint.sh sprint-12-claude-api"
  exit 1
fi

BRANCH=$1

echo ""
echo "  → Creating branch: $BRANCH"
git checkout main
git pull origin main
git checkout -b "$BRANCH"
echo "  ✓ Now on branch: $BRANCH"
echo ""
echo "  When done:"
echo "  git add ."
echo "  git commit -m 'your message'"
echo "  git checkout main"
echo "  git merge $BRANCH"
echo "  git push"
echo ""
