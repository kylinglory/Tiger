import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createHmac, timingSafeEqual } from 'crypto';

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = process.env.XIAOJI_API_BASE || 'https://xiaoji.baziapi.site/v1';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://kylinglory.com,https://www.kylinglory.com,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const appUsername = process.env.APP_USERNAME || '';
const appPassword = process.env.APP_PASSWORD || '';
const sessionSecret = process.env.APP_SESSION_SECRET || process.env.XIAOJI_API_KEY || 'local-dev-session-secret';
const authRequired = Boolean(appUsername && appPassword);
const sessionTtlMs = 12 * 60 * 60 * 1000;
const sessionCookie = 'kg_session';
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('不允许的来源'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: false }));

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.XIAOJI_API_KEY}`,
  'Content-Type': 'application/json',
});

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySession(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.username || payload.exp < Date.now()) return null;
  return payload;
}

function readCookie(req, name) {
  const cookies = req.get('cookie') || '';
  return cookies.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sessionCookieValue(token) {
  const parts = [
    `${sessionCookie}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.round(sessionTtlMs / 1000)}`,
  ];
  if (isProduction) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookieValue() {
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`;
}

function currentSession(req) {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cookieToken = readCookie(req, sessionCookie);
  try {
    const session = verifySession(bearer || cookieToken);
    if (session?.username === appUsername) return session;
  } catch { /* no valid session */ }
  return null;
}

function requireLogin(req, res, next) {
  if (!authRequired) return next();
  const session = currentSession(req);
  if (session) {
    req.user = session;
    return next();
  }
  return res.status(401).json({ error: { message: '请先登录后再使用生图功能' } });
}

function requirePageLogin(req, res, next) {
  if (!authRequired || currentSession(req)) return next();
  if (req.path === '/login') return next();
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/')}`);
}

function loginPage(message = '') {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kylin Glory Design - 登录</title>
  <style>
    :root { font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; color: #202533; background: #f5f6f9; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 50% 0, #fff 0, #f7f8fb 48%, #eef1f6 100%); }
    main { width: min(420px, 100%); padding: 30px; border-radius: 12px; background: white; box-shadow: 0 20px 60px #20283b24; }
    h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 0; }
    p { margin: 0 0 22px; color: #747b89; font-size: 13px; }
    label { display: block; margin-top: 12px; color: #4d5563; font-size: 12px; font-weight: 600; }
    input { width: 100%; height: 42px; margin-top: 7px; padding: 0 12px; border: 1px solid #d9dde6; border-radius: 6px; outline: 0; }
    input:focus { border-color: #7957f6; box-shadow: 0 0 0 3px #7957f61a; }
    button { width: 100%; height: 42px; margin-top: 18px; border: 0; border-radius: 6px; color: white; font-weight: 700; background: linear-gradient(135deg, #7957f6, #cc32f0); cursor: pointer; }
    .error { margin: 0 0 14px; padding: 10px 12px; border-radius: 6px; color: #9d1d35; background: #fff0f3; }
  </style>
</head>
<body>
  <main>
    <h1>Kylin Glory Design</h1>
    <p>请输入管理员账号和密码</p>
    ${message ? `<div class="error">${message}</div>` : ''}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="/" />
      <label>账号<input name="username" autocomplete="username" autofocus required /></label>
      <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
      <button>登录</button>
    </form>
  </main>
</body>
</html>`;
}

async function proxyJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `接口请求失败 (${response.status})`);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

app.get('/api/health', (_req, res) => {
  res.json({ configured: Boolean(process.env.XIAOJI_API_KEY), model: 'gpt-image-2', authRequired });
});

app.get('/api', (_req, res) => {
  res.json({ service: 'xiaojishuo-image-api', configured: Boolean(process.env.XIAOJI_API_KEY), authRequired });
});

app.post('/api/login', (req, res) => {
  if (!authRequired) return res.status(503).json({ error: { message: '暂未配置登录账号' } });
  const { username = '', password = '' } = req.body || {};
  if (!safeEqual(username, appUsername) || !safeEqual(password, appPassword)) {
    return res.status(401).json({ error: { message: '账号或密码不正确' } });
  }
  const token = signSession({ username: appUsername, exp: Date.now() + sessionTtlMs });
  res.setHeader('Set-Cookie', sessionCookieValue(token));
  res.json({
    username: appUsername,
    token,
    expiresIn: sessionTtlMs / 1000,
  });
});

app.get('/login', (req, res) => {
  if (!authRequired || currentSession(req)) return res.redirect('/');
  res.type('html').send(loginPage(req.query.error ? '账号或密码不正确' : ''));
});

app.post('/login', (req, res) => {
  if (!authRequired) return res.redirect('/');
  const { username = '', password = '', next = '/' } = req.body || {};
  if (!safeEqual(username, appUsername) || !safeEqual(password, appPassword)) {
    return res.redirect('/login?error=1');
  }
  const token = signSession({ username: appUsername, exp: Date.now() + sessionTtlMs });
  res.setHeader('Set-Cookie', sessionCookieValue(token));
  res.redirect(String(next).startsWith('/') ? next : '/');
});

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookieValue());
  res.json({ ok: true });
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ username: req.user?.username || appUsername || null, authRequired });
});

app.post('/api/generate', requireLogin, async (req, res) => {
  if (!process.env.XIAOJI_API_KEY) {
    return res.status(503).json({ error: { message: '接口已接好，请先在 .env 中配置 XIAOJI_API_KEY' } });
  }
  const { prompt, referenceImages = [], aspectRatio = '4:5', n = 1 } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: { message: '请填写商品卖点与生成要求' } });

  try {
    const data = await proxyJson(`${apiBase}/images/generations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: 'gpt-image-2', prompt, n: Math.min(Math.max(Number(n), 1), 4),
        aspect_ratio: aspectRatio, quality: 'hd', response_format: 'url',
        ...(referenceImages.length ? { reference_images: referenceImages.slice(0, 3) } : {}),
      }),
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

app.get('/api/tasks/:taskId', requireLogin, async (req, res) => {
  if (!process.env.XIAOJI_API_KEY) return res.status(503).json({ error: { message: '尚未配置 API Key' } });
  if (!/^task_[A-Za-z0-9_-]+$/.test(req.params.taskId)) return res.status(400).json({ error: { message: '无效的任务 ID' } });
  try {
    res.json(await proxyJson(`${apiBase}/images/generations/${req.params.taskId}`, { headers: authHeaders() }));
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(requirePageLogin);
  app.use(express.static('dist'));
  app.get(/.*/, (_req, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname));
}

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: { message: error.message || '服务暂不可用' } });
});

app.listen(port, () => console.log(`API server listening on http://127.0.0.1:${port}`));
