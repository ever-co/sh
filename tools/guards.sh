#!/bin/sh
# Every repository check, each proven able to fail by its self-test first.
set -eu
cd "$(dirname "$0")/.."

for guard in check-no-internals check-public-copy check-canonical-origin check-image-modules \
  check-workflow-shape check-frontend-stack; do
  node "tools/$guard.mjs" --self-test
  node "tools/$guard.mjs"
done
node tools/check-npm-licences.mjs --self-test
node --test "tools/*.test.mjs"
