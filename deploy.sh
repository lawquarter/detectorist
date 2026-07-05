#!/bin/sh
# Build, commit, push, and babysit the flaky legacy Pages build (auto-retry on error).
set -e
./build.sh
git add -A
git commit -m "${1:-Update game}" || true
git push
echo "pushed — watching Pages build"
i=0
while [ $i -lt 40 ]; do
  s=$(gh api repos/lawquarter/detectorist/pages/builds --jq '.[0].status')
  echo "  build: $s"
  if [ "$s" = "built" ]; then echo "deployed ✔"; exit 0; fi
  if [ "$s" = "errored" ]; then echo "  retrying errored build"; gh api -X POST repos/lawquarter/detectorist/pages/builds >/dev/null; fi
  sleep 15; i=$((i+1))
done
echo "timed out watching build — check: gh api repos/lawquarter/detectorist/pages/builds"
exit 1
