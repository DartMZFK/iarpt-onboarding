import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import vm from 'node:vm';
import jspdf from '../server/node_modules/jspdf/dist/jspdf.node.min.js';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'iarpt-engine-'));
const output = join(temp, 'engine.js');
try {
  execFileSync(process.execPath, [join(root, 'server', 'build-engine.js'), join(root, 'iarpt-quiz.html'), output], {stdio: 'pipe'});
  const source = readFileSync(output, 'utf8');
  assert.ok(source.includes('const ctaHeight=36'), 'server engine must use the 36 mm CTA');
  assert.ok(source.includes("url:'https://t.me/iarpt_quiz_bot'"), 'server engine must use the fixed iARPT bot link');
  assert.ok(!source.includes('anna_chernigova_bot'), 'legacy bot link must be absent');

  const context = {jspdf, console};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source + ';this.__e={QS,compute,buildPdf};', context);
  const answers = {};
  for (const q of context.__e.QS) {
    if (q.text) answers[q.id] = 'Тестовая цель';
    else if (q.multi) answers[q.id] = q.opts.slice(0, Math.min(2, q.opts.length)).map(option => option.c);
    else answers[q.id] = q.opts[0].c;
  }
  const doc = context.__e.buildPdf(context.__e.compute(answers), 'Проверка', {botUrl: 'https://t.me/anna_chernigova_bot'});
  const pdf = Buffer.from(doc.output('arraybuffer'));
  assert.ok(pdf.length > 100_000, 'generated PDF must contain the full designed card');
  assert.equal(doc.getNumberOfPages(), 9, 'generated PDF must have nine pages');
  console.log('server-pdf-engine: ok');
} finally {
  rmSync(temp, {recursive: true, force: true});
}
