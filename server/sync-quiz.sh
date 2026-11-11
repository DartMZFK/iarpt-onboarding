#!/bin/sh
# Mirror the quiz for Russian networks and keep the server-side PDF engine in sync.
set -eu

root=/opt/iarpt-card
quiz_dir="$root/quiz"
html_new="$quiz_dir/.iarpt-quiz.html.new"
engine_new="$quiz_dir/.engine.js.new"
trap 'rm -f "$html_new" "$engine_new"' EXIT HUP INT TERM

curl -fsS -m 60 \
  -H 'Accept: application/vnd.github.raw+json' \
  'https://api.github.com/repos/DartMZFK/iarpt-onboarding/contents/iarpt-quiz.html?ref=main' \
  -o "$html_new"

grep -q '1665352' "$html_new"
grep -q 'id="leadGate"' "$html_new"
grep -q 'function renderResult()' "$html_new"
node "$root/build-engine.js" "$html_new" "$engine_new"

# Both files are complete and validated before either live path is replaced.
mv "$engine_new" "$quiz_dir/engine.js"
mv "$html_new" "$quiz_dir/iarpt-quiz.html"
