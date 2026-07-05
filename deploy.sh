#!/bin/sh
# Build, commit, push; deployment runs via GitHub Actions (see .github/workflows/pages.yml).
set -e
./build.sh
git add -A
git commit -m "${1:-Update game}" || true
git push
echo "pushed — watching Actions deploy"
sleep 5
gh run watch $(gh run list --repo lawquarter/detectorist --workflow "Deploy to Pages" --limit 1 --json databaseId --jq '.[0].databaseId') --repo lawquarter/detectorist --exit-status && echo "deployed ✔ https://lawquarter.github.io/detectorist/"
