import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = process.env.XIAOJI_API_BASE || 'https://xiaoji.baziapi.site/v1';

app.use(cors());
app.use(express.json({ limit: '35mb' }));

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.XIAOJI_API_KEY}`,
  'Content-Type': 'application/json',
});

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
  res.json({ configured: Boolean(process.env.XIAOJI_API_KEY), model: 'gpt-image-2' });
});

app.post('/api/generate', async (req, res) => {
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

app.get('/api/tasks/:taskId', async (req, res) => {
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

app.listen(port, () => console.log(`API server listening on http://127.0.0.1:${port}`));
