#!/usr/bin/env bash
set -e

REPO="https://${GITHUB_PAT}@github.com/dathasaiswaroopgudimella-png/resume-verifier.git"

# Wait for any git lock to clear
for i in $(seq 1 10); do
  if [ ! -f .git/config.lock ]; then
    break
  fi
  echo "Waiting for git lock to clear... ($i)"
  sleep 2
done

if [ -f .git/config.lock ]; then
  echo "ERROR: git config.lock still present after waiting"
  exit 1
fi

git config user.email "agent@replit.com"
git config user.name "Replit Agent"

# Add or update origin
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

echo "Pushing to GitHub..."
git push -u origin main --force
echo "Done."
