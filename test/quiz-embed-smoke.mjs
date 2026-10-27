import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const t123Path = resolve(root, 'tilda-quiz-direct-failover.html');
const quizPath = resolve(root, 'iarpt-quiz.html');

assert.ok(existsSync(t123Path), 'direct T123 loader must exist');
const t123 = readFileSync(t123Path, 'utf8');
const quiz = readFileSync(quizPath, 'utf8');

assert.ok(t123.includes('https://card.iarpt.ru/quiz/iarpt-quiz.html'), 'server quiz must be the primary source');
assert.ok(t123.includes('https://dartmzfk.github.io/iarpt-onboarding/iarpt-quiz.html'), 'GitHub must remain as a fallback');
assert.ok(!t123.includes('fetch(') && !t123.includes('new Blob('), 'T123 must embed the quiz directly');
assert.ok(quiz.includes("height:460px"), 'GetCourse form must have a visible initial height');
