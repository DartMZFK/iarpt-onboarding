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
assert.ok(quiz.includes('function isTelegramBrowser()'), 'quiz must detect the Telegram WebView');
assert.ok(quiz.includes('Открыть форму GetCourse'), 'Telegram must have a top-level GetCourse form link');

// VPN/no-VPN: загрузчик не обрывает медленный основной источник и не перезагружает тест после старта.
assert.ok(t123.includes('parallelAfterMs'), 'T123 must race sources instead of cutting the primary off');
assert.ok(/d\.type === 'error' && !winner/.test(t123), 'errors after ready must not trigger failover');
assert.ok(!/timeoutMs":3000/.test(t123), 'no hard 3s cutoff');
assert.equal((t123.match(/id="iarpt-quiz-modal"/g) || []).length, 1, 'single modal');
assert.ok(quiz.includes("timeoutMs: 4000") && quiz.includes('attempt < 3') && quiz.includes('setTimeout(resolve, 2500)'), 'API wait must be bounded (~13s) when card.iarpt.ru is unreachable');
assert.ok(quiz.includes('achernigova.online/pl/lite/widget/widget?id=1665352'), 'GetCourse widget restored');
assert.ok(quiz.includes('id="leadGate"') && quiz.includes('function renderResult()'), 'server sync script markers present');
console.log('quiz-embed-smoke: ok');
assert.ok(quiz.includes('function retryVisibleLeadForm(') && quiz.includes('Отключите VPN'), 'GetCourse unreachable via VPN must show a clear retry notice');
assert.ok(!quiz.includes('visibility:hidden;') || !/LEAD_SHADOW = '[^']*visibility:hidden/.test(quiz), 'pending GetCourse frames must not be visibility:hidden');
assert.ok(quiz.includes('leadFrame.replaceWith(fresh)'), 'a silent GetCourse attempt is replaced, not piled up');
