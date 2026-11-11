'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const jspdf = require('jspdf');

const PORT = Number(process.env.PORT) || 3077;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const BOT_URL = process.env.BOT_URL || '';
const ENGINE_FILE = process.env.ENGINE_FILE || path.join(__dirname, 'quiz', 'engine.js');
const GC = {
  host: process.env.GC_HOST || '',
  key: process.env.GC_KEY || '',
  field: process.env.GC_FIELD || '',
  group: process.env.GC_GROUP || '',
};

fs.mkdirSync(DATA, {recursive: true});

// The validated engine snapshot is generated from iarpt-quiz.html by build-engine.js.
// Reloading on mtime keeps POST /api/result synchronized with the mirrored quiz.
let engineMtime = -1;
let QS, compute, token, buildPdf;
function loadEngine(force = false) {
  const mtime = fs.statSync(ENGINE_FILE).mtimeMs;
  if (!force && mtime === engineMtime) return;
  const ctx = {jspdf, console};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(ENGINE_FILE, 'utf8') + ';this.__e={QS,compute,token,buildPdf};',
    ctx,
    {filename: ENGINE_FILE},
  );
  const next = ctx.__e;
  if (!Array.isArray(next.QS) || typeof next.compute !== 'function' ||
      typeof next.token !== 'function' || typeof next.buildPdf !== 'function') {
    throw new Error('invalid PDF engine snapshot');
  }
  ({QS, compute, token, buildPdf} = next);
  engineMtime = mtime;
  console.log('PDF engine loaded', new Date(mtime).toISOString());
}
loadEngine(true);

const hits = new Map();
function limited(ip, max) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}
setInterval(() => hits.clear(), 6 * 3600e3).unref();

function cleanAnswers(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const q of QS) {
    const v = raw[q.id];
    if (v == null) continue;
    if (q.text) { if (typeof v === 'string') out[q.id] = v.trim().slice(0, q.max || 300); continue; }
    const codes = new Set(q.opts.map(o => o.c));
    if (q.multi) { if (Array.isArray(v)) out[q.id] = v.filter(c => codes.has(c)).slice(0, q.opts.length); }
    else if (codes.has(v)) out[q.id] = v;
  }
  return out;
}
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', c => { size += c.length; if (size > 64 * 1024) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', ...headers});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
const pdfUrl = id => `${PUBLIC_URL}/card/${id}.pdf`;
const idOk = id => /^[A-Za-z0-9_-]{16,32}$/.test(id || '');

async function createResult(body) {
  loadEngine();
  const name = cleanName(body.name);
  if (!name) throw Object.assign(new Error('name required'), {status: 400});
  const answers = cleanAnswers(body.answers);
  const profile = compute(answers);
  const id = crypto.randomBytes(12).toString('base64url');
  const doc = buildPdf(profile, name, {botUrl: BOT_URL});
  fs.writeFileSync(path.join(DATA, id + '.pdf'), Buffer.from(doc.output('arraybuffer')));
  fs.writeFileSync(path.join(DATA, id + '.json'), JSON.stringify({name, answers, token: token(profile), createdAt: new Date().toISOString()}));
  return {id, pdf: pdfUrl(id)};
}

async function pushLead(body) {
  if (!idOk(body.id) || !fs.existsSync(path.join(DATA, body.id + '.json'))) throw Object.assign(new Error('unknown id'), {status: 404});
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) throw Object.assign(new Error('email'), {status: 400});
  const consents = {
    offer: body.consents?.offer === true,
    privacy: body.consents?.privacy === true,
    mailing: body.consents?.mailing === true,
  };
  if (!consents.offer || !consents.privacy || !consents.mailing) throw Object.assign(new Error('consent'), {status: 400});
  const saved = JSON.parse(fs.readFileSync(path.join(DATA, body.id + '.json'), 'utf8'));
  saved.lead = {email, phone, consents, at: new Date().toISOString()};
  fs.writeFileSync(path.join(DATA, body.id + '.json'), JSON.stringify(saved));
  if (!GC.host || !GC.key || !GC.field) return {gc: 'disabled'};
  const params = {
    user: {email, phone, first_name: cleanName(body.name) || saved.name, addfields: {[GC.field]: pdfUrl(body.id)}, ...(GC.group ? {group_name: [GC.group]} : {})},
    system: {refresh_if_exists: 1},
  };
  const form = new URLSearchParams({action: 'add', key: GC.key, params: Buffer.from(JSON.stringify(params)).toString('base64')});
  const r = await fetch(`https://${GC.host}/pl/api/users`, {method: 'POST', body: form, signal: AbortSignal.timeout(15000)});
  const j = await r.json().catch(() => null);
  const ok = !!(j && j.success && j.result && j.result.success);
  if (!ok) console.error('gc import failed', body.id, JSON.stringify(j).slice(0, 500));
  const telegram = ok && BOT_URL ? `${BOT_URL}${BOT_URL.includes('?') ? '&' : '?'}start=${encodeURIComponent(body.id)}` : '';
  return {gc: ok ? 'ok' : 'error', telegram};
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const cors = ORIGINS.includes(origin) ? {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} : {};
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'});
      return res.end();
    }
    const card = url.pathname.match(/^\/card\/([A-Za-z0-9_-]{16,32})\.pdf$/);
    if (req.method === 'GET' && card) {
      const file = path.join(DATA, card[1] + '.pdf');
      if (!fs.existsSync(file)) return send(res, 404, {error: 'not found'});
      const {name} = JSON.parse(fs.readFileSync(path.join(DATA, card[1] + '.json'), 'utf8'));
      const fname = encodeURIComponent('Карта_' + (name.split(/\s+/)[0] || 'участника') + '.pdf');
      res.writeHead(200, {'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename*=UTF-8''${fname}`, 'Cache-Control': 'private, max-age=86400', 'X-Robots-Tag': 'noindex'});
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, {ok: true, engine: new Date(engineMtime).toISOString()});
    if (req.method === 'POST' && url.pathname === '/api/result') {
      if (limited('r' + ip, 30)) return send(res, 429, {error: 'too many'}, cors);
      return send(res, 200, await createResult(await readBody(req)), cors);
    }
    if (req.method === 'POST' && url.pathname === '/api/lead') {
      if (limited('l' + ip, 10)) return send(res, 429, {error: 'too many'}, cors);
      return send(res, 200, await pushLead(await readBody(req)), cors);
    }
    send(res, 404, {error: 'not found'});
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 400, {error: e.status ? e.message : 'bad request'}, cors);
  }
}).listen(PORT, '127.0.0.1', () => console.log('iarpt-card on', PORT));
