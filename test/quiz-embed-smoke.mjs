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
assert.ok(t123.includes("'iq-channel': channel"), 'T123 must give the quiz a ready-message channel');
assert.ok(t123.includes("d.type === 'ready'"), 'T123 must wait for the quiz ready message');
assert.ok(!t123.includes("frame.addEventListener('load'"), 'T123 must not mistake an iframe error page for a loaded quiz');
assert.ok(quiz.includes("const LEAD_API = 'https://card.iarpt.ru'"), 'quiz must post leads to the trusted server');
assert.ok(quiz.includes("fetch(LEAD_API + '/api/lead'"), 'quiz must save the native form through the server');
assert.ok(quiz.includes('Соглашаюсь с <a href="https://achernigova.ru/offer"'), 'quiz must retain the offer consent');
assert.ok(quiz.includes('Соглашаюсь с <a href="http://achernigova.ru/document"'), 'quiz must retain the privacy-policy consent');
assert.ok(quiz.includes('Даю согласие на получение <a href="http://mailing.iarpt.online/"'), 'quiz must retain the mailing consent');
assert.ok(quiz.includes('consents: {'), 'quiz must submit the individual consents');
assert.ok(quiz.includes('<input name="offer" type="checkbox" required>'), 'offer consent must be required');
assert.ok(quiz.includes('<input name="privacy" type="checkbox" required>'), 'privacy consent must be required');
assert.ok(quiz.includes('<input name="mailing" type="checkbox" required>'), 'mailing consent must be required');
assert.ok(quiz.includes('window.location.assign(data.telegram)'), 'quiz must open the bot after a saved lead');
assert.ok(quiz.includes('PDF-карта будет доступна в Telegram-боте'), 'quiz must promise delivery in Telegram');
assert.ok(!quiz.includes('GC_FORM_URL'), 'quiz must not embed the GetCourse widget');
