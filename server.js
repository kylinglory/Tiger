import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = process.env.XIAOJI_API_BASE || 'https://xiaoji.baziapi.site/v1';
const videoApiBase = process.env.VIDEO_API_BASE || 'https://xjjuhe.site/v1';
const videoApiKey = process.env.VIDEO_API_KEY || process.env.XIAOJI_API_KEY;
const parseApiBase = process.env.PARSE_API_BASE || videoApiBase;
const parseApiKey = process.env.PARSE_API_KEY || videoApiKey;
const digitalHumanApiBase = process.env.DIGITAL_HUMAN_API_BASE || parseApiBase;
const digitalHumanApiKey = process.env.DIGITAL_HUMAN_API_KEY || parseApiKey;
const editorApiBase = process.env.EDITOR_API_BASE || digitalHumanApiBase;
const editorApiKey = process.env.EDITOR_API_KEY || digitalHumanApiKey;
const creativeApiBase = process.env.CREATIVE_API_BASE || editorApiBase;
const creativeApiKey = process.env.CREATIVE_API_KEY || editorApiKey;
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

const videoAuthHeaders = () => ({
  Authorization: `Bearer ${videoApiKey}`,
  'Content-Type': 'application/json',
});

const parseAuthHeaders = () => ({
  Authorization: `Bearer ${parseApiKey}`,
  'Content-Type': 'application/json',
});

const digitalHumanHeaders = (withJson = true) => ({
  Authorization: `Bearer ${digitalHumanApiKey}`,
  'Idempotency-Key': randomUUID(),
  ...(withJson ? { 'Content-Type': 'application/json' } : {}),
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

async function proxyJsonWithRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await proxyJson(url, options);
    } catch (error) {
      lastError = error;
      if (![429, 502, 503].includes(error.status) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

function amazonLookup(value, selectedMarketplace) {
  const input = String(value || '').trim();
  const directAsin = input.match(/^[A-Z0-9]{10}$/i)?.[0];
  let asin = directAsin;
  let marketplace = selectedMarketplace;
  let canonicalUrl = input;
  try {
    const parsed = new URL(input);
    asin ||= parsed.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
    asin ||= parsed.searchParams.get('asin')?.match(/^[A-Z0-9]{10}$/i)?.[0];
    const host = parsed.hostname.toLowerCase();
    marketplace ||= host.endsWith('.co.uk') ? 'uk' : host.endsWith('.de') ? 'de' : host.endsWith('.co.jp') ? 'jp' : host.endsWith('.ca') ? 'ca' : host.endsWith('.com') ? 'us' : '';
    parsed.search = '';
    parsed.hash = '';
    canonicalUrl = parsed.toString();
  } catch { /* allow a direct ASIN */ }
  return { asin: asin?.toUpperCase(), marketplace, canonicalUrl };
}

app.get('/api/health', (_req, res) => {
  res.json({
    configured: Boolean(process.env.XIAOJI_API_KEY),
    videoConfigured: Boolean(videoApiKey),
    parseConfigured: Boolean(parseApiKey),
    digitalHumanConfigured: Boolean(digitalHumanApiKey),
    editorConfigured: Boolean(editorApiKey),
    faceConfigured: Boolean(creativeApiKey),
    pptConfigured: Boolean(creativeApiKey),
    model: 'gpt-image-2',
    videoModels: ['veo_3_1-fast-fl', 'omni_flash-10s', 'sora-2-12s'],
    authRequired,
  });
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

const videoModels = new Set(['veo_3_1-fast-fl', 'omni_flash-10s', 'sora-2-12s']);
const videoSizes = new Set(['1280x720', '1920x1080', '720x1280', '1080x1920']);

app.post('/api/videos', requireLogin, async (req, res) => {
  if (!videoApiKey) {
    return res.status(503).json({ error: { message: '视频接口已接好，请先配置 VIDEO_API_KEY' } });
  }

  const { model = 'omni_flash-10s', prompt, size = '1280x720', images = [], promptExtend = '' } = req.body || {};
  if (!videoModels.has(model)) return res.status(400).json({ error: { message: '不支持的视频模型' } });
  if (!prompt?.trim()) return res.status(400).json({ error: { message: '请填写视频内容描述' } });
  if (prompt.length > 4000) return res.status(400).json({ error: { message: '视频描述不能超过 4000 字' } });
  if (!videoSizes.has(size)) return res.status(400).json({ error: { message: '不支持的视频尺寸' } });

  const maxImages = model === 'omni_flash-10s' ? 7 : 2;
  const references = Array.isArray(images) ? images.filter((item) => typeof item === 'string' && item.length).slice(0, maxImages) : [];
  if (model === 'veo_3_1-fast-fl' && !references.length) {
    return res.status(400).json({ error: { message: 'Veo 模型需要上传 1–2 张参考图' } });
  }

  try {
    const data = await proxyJson(`${videoApiBase}/videos`, {
      method: 'POST',
      headers: videoAuthHeaders(),
      body: JSON.stringify({
        model,
        prompt: prompt.trim(),
        size,
        ...(references.length ? { images: references } : {}),
        ...(promptExtend.trim() ? { prompt_extend: promptExtend.trim() } : {}),
      }),
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

app.get('/api/videos/:id', requireLogin, async (req, res) => {
  if (!videoApiKey) return res.status(503).json({ error: { message: '尚未配置视频 API Key' } });
  if (!/^[A-Za-z0-9_-]{6,160}$/.test(req.params.id)) {
    return res.status(400).json({ error: { message: '无效的视频任务 ID' } });
  }
  try {
    res.json(await proxyJson(`${videoApiBase}/videos/${encodeURIComponent(req.params.id)}`, {
      headers: videoAuthHeaders(),
    }));
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

const parsePlatforms = new Set(['shopee', 'amazon', 'xhs', 'douyin', 'wechat-channels', 'instagram']);

app.post('/api/parse', requireLogin, async (req, res) => {
  if (!parseApiKey) return res.status(503).json({ error: { message: '商品解析接口尚未配置' } });
  const { platform, url = '', keyword = '', type = 'note', lang = '', marketplace = '', translate = '', limit = 20 } = req.body || {};
  if (!parsePlatforms.has(platform)) return res.status(400).json({ error: { message: '不支持的解析平台' } });
  if (platform === 'xhs' && type === 'search' ? !keyword.trim() : !url.trim()) {
    return res.status(400).json({ error: { message: platform === 'xhs' && type === 'search' ? '请输入搜索关键词' : '请输入商品或内容链接' } });
  }

  try {
    if (platform === 'amazon') {
      const lookup = amazonLookup(url, marketplace);
      const query = new URLSearchParams(lookup.asin ? { asin: lookup.asin } : { url: lookup.canonicalUrl });
      if (lookup.marketplace) query.set('marketplace', lookup.marketplace);
      if (translate) query.set('translate', translate);
      return res.json(await proxyJsonWithRetry(`${parseApiBase}/parse/amazon?${query}`, { headers: parseAuthHeaders() }));
    }

    const body = platform === 'shopee'
      ? { url: url.trim(), ...(lang ? { lang } : {}) }
      : platform === 'xhs'
        ? { type, limit: Math.min(Math.max(Number(limit) || 20, 1), 200), ...(type === 'search' ? { keyword: keyword.trim() } : { url: url.trim() }) }
        : { url: url.trim() };
    res.json(await proxyJsonWithRetry(`${parseApiBase}/parse/${platform}`, {
      method: 'POST', headers: parseAuthHeaders(), body: JSON.stringify(body),
    }));
  } catch (error) {
    const busy = [429, 502, 503].includes(error.status);
    res.status(error.status || 500).json({ error: { message: busy ? `${platform === 'amazon' ? '亚马逊' : '商品'}解析服务暂时繁忙，已自动重试 3 次，请稍后再试` : error.message, code: error.code } });
  }
});

function dataUrlFile(dataUrl, filename) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('素材文件格式无效');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 25 * 1024 * 1024) throw new Error('本地素材不能超过 25MB');
  return { blob: new Blob([buffer], { type: match[1] }), filename: String(filename || 'upload').slice(0, 160) };
}

app.post('/api/digital-human/files', requireLogin, async (req, res) => {
  if (!digitalHumanApiKey) return res.status(503).json({ error: { message: '数字人接口尚未配置' } });
  try {
    const { dataUrl, filename, purpose = 'avatar_image' } = req.body || {};
    if (!['avatar_image', 'video_driving_audio', 'voice_clone', 'asr'].includes(purpose)) {
      return res.status(400).json({ error: { message: '不支持的素材用途' } });
    }
    const file = dataUrlFile(dataUrl, filename);
    const form = new FormData();
    form.append('purpose', purpose);
    form.append('file', file.blob, file.filename);
    res.json(await proxyJson(`${digitalHumanApiBase}/digital-human/files`, {
      method: 'POST', headers: digitalHumanHeaders(false), body: form,
    }));
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

const digitalHumanCreatePaths = {
  'image-template': 'avatars/templates',
  'video-clone': 'video-avatars/clones',
  speech: 'audio/speech',
  'image-generation': 'videos/generations',
  'video-generation': 'video-avatars/generations',
};

const digitalHumanQueryPaths = {
  'image-template': 'avatars/template-tasks',
  'video-clone': 'video-avatars/clones',
  speech: 'audio/speech',
  'image-generation': 'videos/generations',
  'video-generation': 'video-avatars/generations',
};

app.post('/api/digital-human/tasks', requireLogin, async (req, res) => {
  if (!digitalHumanApiKey) return res.status(503).json({ error: { message: '数字人接口尚未配置' } });
  const { action, payload } = req.body || {};
  const path = digitalHumanCreatePaths[action];
  if (!path || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: { message: '无效的数字人任务' } });
  }
  try {
    res.json(await proxyJson(`${digitalHumanApiBase}/digital-human/${path}`, {
      method: 'POST', headers: digitalHumanHeaders(), body: JSON.stringify(payload),
    }));
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

app.get('/api/digital-human/tasks/:kind/:id', requireLogin, async (req, res) => {
  if (!digitalHumanApiKey) return res.status(503).json({ error: { message: '数字人接口尚未配置' } });
  const path = digitalHumanQueryPaths[req.params.kind];
  if (!path || !/^[A-Za-z0-9_-]{4,180}$/.test(req.params.id)) {
    return res.status(400).json({ error: { message: '无效的数字人任务 ID' } });
  }
  try {
    res.json(await proxyJson(`${digitalHumanApiBase}/digital-human/${path}/${encodeURIComponent(req.params.id)}`, {
      headers: { Authorization: `Bearer ${digitalHumanApiKey}` },
    }));
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

const editorModels = new Set(['gpt-5.5', 'gpt-5.6-sol']);

app.post('/api/editor/generate', requireLogin, async (req, res) => {
  if (!editorApiKey) return res.status(503).json({ error: { message: '发布编辑器模型尚未配置' } });
  const {
    model = 'gpt-5.5', platform = '小红书', language = '简体中文', tone = '专业可信',
    objective = '产品推广', source = '', operation = 'generate', current = {},
  } = req.body || {};
  if (!editorModels.has(model)) return res.status(400).json({ error: { message: '不支持的文案模型' } });
  if (!source.trim() && operation === 'generate') return res.status(400).json({ error: { message: '请填写产品或内容资料' } });
  if (source.length > 12000) return res.status(400).json({ error: { message: '内容资料不能超过 12000 字' } });

  const currentCopy = `标题：${current.title || ''}\n正文：${current.body || ''}\n标签：${current.hashtags || ''}`;
  const operationInstruction = {
    generate: '根据资料从零创作一篇可直接编辑发布的内容。',
    shorten: '保留关键信息，将现有文案缩短约 30%，提高可读性。',
    sell: '增强利益点、说服力和行动号召，但不要虚构事实或夸大承诺。',
    retone: `将现有文案调整为“${tone}”语气，保持事实信息不变。`,
  }[operation] || '优化现有文案。';

  try {
    const data = await proxyJson(`${editorApiBase}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${editorApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.7,
        max_tokens: 1800,
        messages: [
          { role: 'system', content: '你是资深品牌内容编辑。必须只返回合法 JSON，不要使用 Markdown 代码块。格式固定为 {"title":"","body":"","hashtags":[""]}。标题简洁，正文适合目标平台，hashtags 返回 3-8 个不带空格的标签。不得编造资料中不存在的参数、认证、折扣或功效。' },
          { role: 'user', content: `平台：${platform}\n语言：${language}\n语气：${tone}\n目标：${objective}\n任务：${operationInstruction}\n资料：${source || '无新增资料'}\n${operation === 'generate' ? '' : `现有文案：\n${currentCopy}`}` },
        ],
      }),
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('文案模型未返回内容');
    res.json({ content, model: data.model || model, usage: data.usage || null });
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

app.post('/api/face-reading', requireLogin, async (req, res) => {
  if (!creativeApiKey) return res.status(503).json({ error: { message: 'AI 看相模型尚未配置' } });
  const { image, focus = '综合解读' } = req.body || {};
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(String(image || ''))) {
    return res.status(400).json({ error: { message: '请上传 PNG、JPG 或 WEBP 人像照片' } });
  }
  if (String(image).length > 14 * 1024 * 1024) return res.status(400).json({ error: { message: '照片不能超过 10MB' } });

  try {
    const data = await proxyJson(`${creativeApiBase}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creativeApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash-vision-exp',
        stream: false,
        temperature: 0.7,
        max_tokens: 1600,
        messages: [
          { role: 'system', content: '你是一位传统面相文化讲解者，所有内容仅供文化娱乐。只能描述照片中直接可见的非敏感外观特点，并结合传统文化象征给出温和、非确定性的解读。不得推断或诊断健康、疾病、种族、宗教、性取向、政治倾向、犯罪倾向、智力或真实人格。必须只返回合法 JSON，不使用 Markdown。格式：{"summary":"","observations":[{"label":"","text":""}],"suggestions":[""],"closing":""}。observations 生成 4 项，suggestions 生成 3 项。' },
          { role: 'user', content: [
            { type: 'text', text: `解读侧重：${focus}。请使用简体中文，明确注明是传统文化娱乐解读，不作事实判断。` },
            { type: 'image_url', image_url: { url: image } },
          ] },
        ],
      }),
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('视觉模型未返回解读内容');
    res.json({ content, model: data.model || 'deepseek-v4-flash-vision-exp', usage: data.usage || null });
  } catch (error) {
    res.status(error.status || 500).json({ error: { message: error.message, code: error.code } });
  }
});

app.post('/api/ppt/generate', requireLogin, async (req, res) => {
  if (!creativeApiKey) return res.status(503).json({ error: { message: 'AI PPT 模型尚未配置' } });
  const {
    topic = '', audience = '普通受众', objective = '清晰介绍主题', style = '商务简洁',
    language = '简体中文', slideCount = 8, notes = '', model = 'gpt-5.5',
  } = req.body || {};
  if (!topic.trim()) return res.status(400).json({ error: { message: '请填写演示主题' } });
  if (!editorModels.has(model)) return res.status(400).json({ error: { message: '不支持的 PPT 文案模型' } });
  const count = Math.min(Math.max(Number(slideCount) || 8, 4), 20);

  try {
    const data = await proxyJson(`${creativeApiBase}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creativeApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, temperature: 0.65, max_tokens: 5000,
        messages: [
          { role: 'system', content: '你是资深演示文稿策划师。必须只返回合法 JSON，不使用 Markdown 代码块。格式：{"title":"","subtitle":"","slides":[{"title":"","points":[""],"speakerNotes":"","visual":""}]}。首页也包含在 slides 中；每页 2-5 个简洁要点，避免长段落；visual 是适合该页的图片或图表建议；speakerNotes 是演讲备注。不得虚构数据、客户案例或研究来源。' },
          { role: 'user', content: `请生成 ${count} 页演示文稿。\n主题：${topic.trim()}\n受众：${audience}\n目标：${objective}\n风格：${style}\n语言：${language}\n补充资料：${notes || '无'}\n请确保 slides 数量正好为 ${count}。` },
        ],
      }),
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('PPT 模型未返回内容');
    res.json({ content, model: data.model || model, usage: data.usage || null });
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
