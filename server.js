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

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('不允许的来源'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '35mb' }));

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

function requireLogin(req, res, next) {
  if (!authRequired) return next();
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  try {
    const session = verifySession(token);
    if (session?.username === appUsername) {
      req.user = session;
      return next();
    }
  } catch { /* fall through */ }
  return res.status(401).json({ error: { message: '请先登录后再使用生图功能' } });
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

app.get('/', (_req, res) => {
  res.json({ service: 'xiaojishuo-image-api', configured: Boolean(process.env.XIAOJI_API_KEY), authRequired });
});

app.post('/api/login', (req, res) => {
  if (!authRequired) return res.status(503).json({ error: { message: '暂未配置登录账号' } });
  const { username = '', password = '' } = req.body || {};
  if (!safeEqual(username, appUsername) || !safeEqual(password, appPassword)) {
    return res.status(401).json({ error: { message: '账号或密码不正确' } });
  }
  res.json({
    username: appUsername,
    token: signSession({ username: appUsername, exp: Date.now() + sessionTtlMs }),
    expiresIn: sessionTtlMs / 1000,
  });
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
  app.use(express.static('dist'));
  app.get('*', (_req, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname));
}

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: { message: error.message || '服务暂不可用' } });
});

app.listen(port, () => console.log(`API server listening on http://127.0.0.1:${port}`));
