// ===== 本地开发服务器（Node 原生，无依赖）=====
// 静态服务 index.html + 6 个 /api/* 端点（in-memory KV）
// 用于：edgeone dev 起不来（KV 命名空间未在控制台建）时的本地测试
// 数据：进程内存，**重启清空**，仅供开发

const http = require('http');
const https = require('https');
const fs = require('fs');
const pathMod = require('path');
const crypto = require('crypto');

const PORT = 8788;
const ROOT = __dirname;
const path = (p) => pathMod.join(ROOT, p);

// ===== In-memory KV =====
const KV = new Map();
const my_kv = {
  get: async (k) => KV.get(k) || null,
  put: async (k, v) => { KV.set(k, String(v)); },
  delete: async (k) => { KV.delete(k); }
};

// ===== 工具 =====
function jsonResponse(data, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data)
  };
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); }
      catch (e) { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}
function send(res, r) {
  res.writeHead(r.status, r.headers);
  res.end(r.body);
}
function newToken() {
  return crypto.randomUUID();
}

// ===== Middleware 逻辑 =====
async function authMiddleware(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlPath = url.pathname;

  // 开放端点
  if (urlPath === '/api/login' || urlPath === '/api/seed' || urlPath === '/api/tts' || urlPath === '/api/verify-admin-pin' || urlPath === '/api/update-admin-pin') return null;

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResponse({ error: 'unauthorized', message: '缺少登录凭证' }, 401);

  const raw = await my_kv.get(`session:${token}`);
  if (!raw) return jsonResponse({ error: 'invalid_token', message: '登录已失效' }, 401);

  let s;
  try { s = JSON.parse(raw); } catch { return jsonResponse({ error: 'corrupted_session' }, 401); }
  if (!s.expiresAt || s.expiresAt < Date.now()) {
    await my_kv.delete(`session:${token}`);
    return jsonResponse({ error: 'expired', message: '登录已过期' }, 401);
  }
  // 注入 header 给"下游"
  return { userId: s.userId, role: s.role };
}

// ===== Handlers =====
async function handleSeed(body) {
  const { users, pins, adminConfirmPin } = body || {};
  if (!users || !pins || typeof users !== 'object' || typeof pins !== 'object') {
    return jsonResponse({ error: 'missing_fields', message: '需要 users 和 pins' }, 400);
  }
  const existingAdmin = await my_kv.get('user:admin');
  if (existingAdmin) {
    if (!adminConfirmPin) return jsonResponse({ error: 'already_seeded', message: '已 seed 过，需要传 adminConfirmPin' }, 403);
    const storedPin = await my_kv.get('pin:admin');
    if (String(adminConfirmPin) !== storedPin) return jsonResponse({ error: 'wrong_admin_pin' }, 403);
  }
  for (const [id, user] of Object.entries(users)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(id)) return jsonResponse({ error: 'invalid_user_id', id }, 400);
    if (!user || !user.name || !user.role) return jsonResponse({ error: 'invalid_user', id }, 400);
    if (!['user', 'admin'].includes(user.role)) return jsonResponse({ error: 'invalid_role', id }, 400);
    if (!pins[id] || !/^\d{4,8}$/.test(String(pins[id]))) {
      return jsonResponse({ error: 'invalid_pin', id, message: 'PIN 必须是 4-8 位数字' }, 400);
    }
    await my_kv.put(`user:${id}`, JSON.stringify(user));
    await my_kv.put(`pin:${id}`, String(pins[id]));
    const existingState = await my_kv.get(`state:${id}`);
    if (!existingState) {
      await my_kv.put(`state:${id}`, JSON.stringify({ currentDay: 1, states: {}, lastUpdated: Date.now() }));
    }
  }
  return jsonResponse({ ok: true, seeded: Object.keys(users), overwritten: !!existingAdmin });
}

// ===== TTS 代理（本地开发用） =====
// 本地开发时直接转发到 Google TTS
const ttsCache = new Map();
async function handleTTS(req) {
  const body = await readJson(req);
  const text = (body?.text || '').trim();
  const lang = body?.lang || 'en';
  if (!text) return jsonResponse({ error: 'missing_text' }, 400);
  if (text.length > 200) return jsonResponse({ error: 'text_too_long' }, 400);

  const cacheKey = `${lang}:${text.toLowerCase()}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': cached.length, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' },
      body: cached
    };
  }

  return new Promise((resolve) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/mpeg,audio/*,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://translate.google.com/',
      }
    }, (resp) => {
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (resp.statusCode !== 200) {
          resolve(jsonResponse({ error: 'tts_failed', status: resp.statusCode }, 502));
          return;
        }
        if (ttsCache.size >= 500) { const firstKey = ttsCache.keys().next().value; ttsCache.delete(firstKey); }
        ttsCache.set(cacheKey, buf);
        resolve({
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' },
          body: buf
        });
      });
      resp.on('error', (e) => { resolve(jsonResponse({ error: 'tts_error', message: e.message }, 502)); });
    }).on('error', (e) => { resolve(jsonResponse({ error: 'tts_error', message: e.message }, 502)); });
  });
}

async function handleLogin(body) {
  const { userId, pin } = body || {};
  if (!userId || !pin) return jsonResponse({ error: 'missing_credentials' }, 400);
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(userId)) return jsonResponse({ error: 'invalid_user_id' }, 400);

  const storedPin = await my_kv.get(`pin:${userId}`);
  if (!storedPin) return jsonResponse({ error: 'user_not_found', message: '账号不存在' }, 404);
  if (storedPin !== String(pin)) return jsonResponse({ error: 'wrong_pin', message: 'PIN 不正确' }, 401);

  const userRaw = await my_kv.get(`user:${userId}`);
  if (!userRaw) return jsonResponse({ error: 'user_not_found' }, 404);
  const user = JSON.parse(userRaw);

  const token = newToken();
  const session = { userId, role: user.role, expiresAt: Date.now() + 30 * 86400000 };
  await my_kv.put(`session:${token}`, JSON.stringify(session));

  return jsonResponse({
    token,
    user: { id: userId, name: user.name, role: user.role, grade: user.grade || null },
    expiresAt: session.expiresAt
  });
}

async function handleMe(user) {
  const userRaw = await my_kv.get(`user:${user.userId}`);
  if (!userRaw) return jsonResponse({ error: 'user_not_found' }, 404);
  const u = JSON.parse(userRaw);
  return jsonResponse({ user: { id: user.userId, name: u.name, role: u.role, grade: u.grade || null } });
}

async function handleState(req, user) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const queryUserId = url.searchParams.get('userId');

  // GET：user 只能看自己；admin 可以看自己 + 任意 user
  if (req.method === 'GET') {
    const targetId = (user.role === 'admin' && queryUserId) ? queryUserId : user.userId;
    const raw = await my_kv.get(`state:${targetId}`);
    const state = raw ? JSON.parse(raw) : { currentDay: 1, states: {}, lastUpdated: Date.now() };
    return jsonResponse({ userId: targetId, state });
  }

  // PUT：只写自己的
  if (req.method === 'PUT') {
    const body = await readJson(req);
    const { userId: bodyUserId, state } = body || {};
    if (bodyUserId && bodyUserId !== user.userId && user.role !== 'admin') {
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    const targetId = bodyUserId || user.userId;
    const toSave = { ...(state || {}), lastUpdated: Date.now() };
    if (typeof toSave.currentDay !== 'number') toSave.currentDay = 1;
    if (typeof toSave.states !== 'object' || toSave.states === null) toSave.states = {};
    await my_kv.put(`state:${targetId}`, JSON.stringify(toSave));
    return jsonResponse({ ok: true, userId: targetId });
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405);
}

async function handleSummary(user) {
  // 给 user 返回全员摘要（前端自己判断展示粒度）
  const result = {};
  for (const k of KV.keys()) {
    if (k.startsWith('user:')) {
      const id = k.slice(5);
      const u = JSON.parse(KV.get(k));
      const stateRaw = await my_kv.get(`state:${id}`);
      const state = stateRaw ? JSON.parse(stateRaw) : { currentDay: 1, states: {} };
      const mastered = state.states ? Object.values(state.states).filter(v => {
        // 兼容新旧两种格式
        if (typeof v === 'number') return v >= 4;
        return v === 'mastered';
      }).length : 0;
      const fuzzy = state.states ? Object.values(state.states).filter(v => {
        if (typeof v === 'number') return v >= 2 && v <= 3;
        return v === 'fuzzy';
      }).length : 0;
      result[id] = {
        name: u.name, role: u.role, grade: u.grade || null,
        mastered, fuzzy, currentDay: state.currentDay || 1
      };
    }
  }
  return jsonResponse(result);
}

async function handleReset(req, user, body) {
  // admin 重置任意用户；user 只能重置自己
  const targetId = user.role === 'admin' && body.userId ? body.userId : user.userId;
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(targetId)) {
    return jsonResponse({ error: 'invalid_user_id' }, 400);
  }
  if (user.role !== 'admin' && body.userId && body.userId !== user.userId) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }
  // PIN 二次验证
  if (user.role === 'admin' && body.userId && body.userId !== user.userId) {
    if (String(body.adminConfirmPin || '') !== await my_kv.get('pin:admin')) {
      return jsonResponse({ error: 'wrong_admin_pin' }, 403);
    }
  }
  await my_kv.put(`state:${targetId}`, JSON.stringify({ currentDay: 1, states: {}, lastUpdated: Date.now() }));
  return jsonResponse({ ok: true, userId: targetId });
}

// ===== 家长密码验证（本地开发）=====
async function handleVerifyPin(body) {
  const pin = body && body.pin;
  if (!pin || typeof pin !== 'string') return jsonResponse({ ok: false }, 400);
  const storedPin = await my_kv.get('pin:admin');
  if (!storedPin) {
    return jsonResponse({ ok: pin === '888888' });
  }
  return jsonResponse({ ok: pin === storedPin });
}

// ===== 主路由 =====
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlPath = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 静态
  if (req.method === 'GET' && (urlPath === '/' || urlPath === '/index.html')) {
    const buf = fs.readFileSync(path('index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
    res.end(buf);
    return;
  }

  // 静态资源（如果之后分拆 JS/CSS）
  if (req.method === 'GET' && !urlPath.startsWith('/api/')) {
    const fp = path(urlPath.slice(1));
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = pathMod.extname(fp).toLowerCase();
      const mime = { '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
      const buf = fs.readFileSync(fp);
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': buf.length });
      res.end(buf);
      return;
    }
  }

  // API
  if (urlPath.startsWith('/api/')) {
    try {
      // middleware
      const mw = await authMiddleware(req);
      if (mw && mw.status) return send(res, mw);

      // 公开端点无需 user
      if (urlPath === '/api/seed') {
        if (req.method !== 'POST') return send(res, jsonResponse({ error: 'method_not_allowed' }, 405));
        const body = await readJson(req);
        return send(res, await handleSeed(body));
      }
      if (urlPath === '/api/tts') {
        if (req.method !== 'POST') return send(res, jsonResponse({ error: 'method_not_allowed' }, 405));
        return send(res, await handleTTS(req));
      }
      if (urlPath === '/api/login') {
        if (req.method !== 'POST') return send(res, jsonResponse({ error: 'method_not_allowed' }, 405));
        const body = await readJson(req);
        return send(res, await handleLogin(body));
      }
      if (urlPath === '/api/verify-admin-pin') {
        if (req.method !== 'POST') return send(res, jsonResponse({ error: 'method_not_allowed' }, 405));
        const body = await readJson(req);
        return send(res, await handleVerifyPin(body));
      }
      // 受保护端点
      const user = mw; // { userId, role }
      if (urlPath === '/api/me') return send(res, await handleMe(user));
      if (urlPath === '/api/state') {
        // handleState 内部按 method 决定要不要 readJson(req)
        // 不要在外面 pre-read，否则 end 事件被消费后 handleState 内部第二次 readJson 永远等不到 end
        return send(res, await handleState(req, user));
      }
      if (urlPath === '/api/summary') return send(res, await handleSummary(user));
      if (urlPath === '/api/reset') {
        if (req.method !== 'POST') return send(res, jsonResponse({ error: 'method_not_allowed' }, 405));
        const body = await readJson(req);
        return send(res, await handleReset(req, user, body));
      }

      return send(res, jsonResponse({ error: 'not_found', path: urlPath }, 404));
    } catch (e) {
      console.error('[api error]', urlPath, e.message);
      return send(res, jsonResponse({ error: 'server_error', message: e.message }, 500));
    }
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  Vocab 本地服务器已启动');
  console.log('  入口: http://localhost:' + PORT);
  console.log('  KV: in-memory（重启清空）');
  console.log('========================================');
});
