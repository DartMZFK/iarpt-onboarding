'use strict';

const fs = require('fs');
const vm = require('vm');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage: node build-engine.js <iarpt-quiz.html> <engine.js>');
  process.exit(2);
}

const html = fs.readFileSync(input, 'utf8');
const start = html.indexOf('window.FONTS=');
const endMatch = /\r?\n\/\* UI adapter for the user-supplied iarpt-quiz_handoff\./.exec(html.slice(Math.max(0, start)));
const end = endMatch ? start + endMatch.index : -1;
if (start < 0 || end <= start) throw new Error('PDF engine markers not found in ' + input);

const engine = html.slice(start, end).trim() + '\n';
for (const marker of [
  'window.FONTS=',
  'window.IMGS=',
  'const QS=',
  'function compute(',
  'function token(',
  'function buildPdf(',
  'const ctaHeight=36',
  "doc.link(M,bt,CW,ctaHeight,{url:'https://t.me/iarpt_quiz_bot'})",
]) {
  if (!engine.includes(marker)) throw new Error('Required PDF engine marker is missing: ' + marker);
}

// Compile before publishing the generated snapshot. Runtime globals are supplied by server.js.
new vm.Script(engine + ';this.__e={QS,compute,token,buildPdf};', {filename: output});
fs.writeFileSync(output, engine, {mode: 0o644});
console.log(`PDF engine: ${output} (${engine.length} chars)`);
