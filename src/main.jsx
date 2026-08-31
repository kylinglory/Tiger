import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, BarChart3, Bluetooth, Box, Check, ChevronDown, Cloud, Copy, CreditCard,
  Download, ExternalLink, FileImage, FileText, FolderOpen, Globe2, Image, ImagePlus, Images, Link2,
  LoaderCircle, LogIn, Megaphone, Menu, Mic, MonitorPlay, MoreHorizontal, Package,
  Plus, Presentation, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, Upload, UserRound, WandSparkles,
  X, Zap,
} from 'lucide-react';
import './styles.css';
import './redesign.css';

const navGroups = [
  { label: '创作工作台', items: [
    [Image, '商品底图'], [FileText, '商品详情页'], [Globe2, '海外电商'],
    [Megaphone, '设计海报', 'NEW'], [Search, '商品解析', 'NEW'],
    [MonitorPlay, '爆款视频', 'BETA'], [UserRound, '数字人', 'BETA'],
    [Archive, '发布编辑器', 'NEW'],
  ]},
  { label: '趣味工具', items: [[UserRound, 'AI 看相', 'BETA'], [Presentation, 'AI PPT']] },
  { label: '账号', items: [[UserRound, '个人中心'], [Zap, '购买点数']] },
];

const modules = [
  ['首屏主视觉', '传递核心价值'], ['核心卖点图', '突出卖点亮点'],
  ['使用场景图', '呈现真实场景'], ['多角度图', '多角度立体展示'],
  ['场景氛围图', '展示氛围感'], ['商品细节图', '放大材质与工艺'],
];

const platformOptions = {
  platform: ['亚马逊', '淘宝/天猫', '京东', '小红书', 'Shopify', 'TikTok', '自定义'],
  country: ['美国', '中国', '日本', '韩国', '欧洲', '东南亚'],
  language: ['英文', '中文', '日文', '韩文'],
  pageType: ['普通A+', '高级A+', '品牌故事'],
};

const routeMap = { 商品底图: 'base', 商品详情页: 'detail', 海外电商: 'overseas', 设计海报: 'poster', 商品解析: 'parse', 爆款视频: 'video', 数字人: 'digital-human', 发布编辑器: 'editor', 'AI 看相': 'face', 'AI PPT': 'ppt', 个人中心: 'account', 购买点数: 'credits', 草稿箱: 'drafts' };
const routeNames = Object.fromEntries(Object.entries(routeMap).map(([name, route]) => [route, name]));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const onlineHosts = new Set(['kylinglory.com', 'www.kylinglory.com']);
const apiOrigin = import.meta.env.VITE_API_ORIGIN || (
  onlineHosts.has(location.hostname) || location.hostname.endsWith('.github.io')
    ? 'https://api.kylinglory.com'
    : ''
);
const apiUrl = (path) => `${apiOrigin}${path}`;
const apiUnavailableMessage = '线上页面尚未部署生图后端，暂时无法生成图片。';
const authStorageKey = 'kylin-glory-auth-token';
const authHeader = (token) => token?.includes('.') ? { Authorization: `Bearer ${token}` } : {};

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.status === 404 || response.status === 405) throw new Error(apiUnavailableMessage);
    throw new Error('生图服务暂不可用，请稍后重试');
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `请求失败 (${response.status})`);
  return body;
}

const draftDefinitions = [
  ['xiaojishuo-draft', '商品详情页', 'detail'], ['xiaojishuo-base-draft', '商品底图', 'base'],
  ['xiaojishuo-overseas-draft', '海外电商', 'overseas'], ['xiaojishuo-poster-draft', '设计海报', 'poster'],
  ['xiaojishuo-video-draft', '爆款视频', 'video'], ['xiaojishuo-parse-draft', '商品解析', 'parse'],
  ['xiaojishuo-digital-human-draft', '数字人', 'digital-human'], ['xiaojishuo-editor-draft', '发布编辑器', 'editor'],
  ['xiaojishuo-ppt-draft', 'AI PPT', 'ppt'],
];
const draftCount = () => typeof localStorage === 'undefined' ? 0 : draftDefinitions.filter(([key]) => localStorage.getItem(key)).length;

function App() {
  const [activeTool, setActiveTool] = useState(() => routeNames[location.hash.slice(2)] || '商品详情页');
  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState({ platform: '亚马逊', country: '美国', language: '英文', pageType: '普通A+' });
  const [brief, setBrief] = useState('');
  const [selectedModules, setSelectedModules] = useState(modules.map(([name]) => name));
  const [status, setStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const [generated, setGenerated] = useState([]);
  const [progress, setProgress] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [configured, setConfigured] = useState(false);
  const [videoConfigured, setVideoConfigured] = useState(false);
  const [parseConfigured, setParseConfigured] = useState(false);
  const [digitalHumanConfigured, setDigitalHumanConfigured] = useState(false);
  const [editorConfigured, setEditorConfigured] = useState(false);
  const [faceConfigured, setFaceConfigured] = useState(false);
  const [pptConfigured, setPptConfigured] = useState(false);
  const [authRequired] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(authStorageKey) || '');
  const [authUser, setAuthUser] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginStatus, setLoginStatus] = useState('idle');
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const health = await fetch(apiUrl('/api/health')).then(readApiResponse);
        setConfigured(health.configured);
        setVideoConfigured(Boolean(health.videoConfigured));
        setParseConfigured(Boolean(health.parseConfigured));
        setDigitalHumanConfigured(Boolean(health.digitalHumanConfigured));
        setEditorConfigured(Boolean(health.editorConfigured));
        setFaceConfigured(Boolean(health.faceConfigured));
        setPptConfigured(Boolean(health.pptConfigured));
        if (!health.authRequired) throw new Error('登录保护尚未在后端启用');
        if (authToken) {
          const me = await fetch(apiUrl('/api/me'), { headers: authHeader(authToken) }).then(readApiResponse);
          if (!me.authRequired || !me.username) throw new Error('登录状态无效');
          setAuthUser(me.username);
        }
      } catch {
        localStorage.removeItem(authStorageKey);
        setAuthToken('');
        setAuthUser('');
      } finally { setAuthChecked(true); }
    })();
    const saved = localStorage.getItem('xiaojishuo-draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setBrief(draft.brief || ''); setSettings((s) => ({ ...s, ...draft.settings }));
        setSelectedModules(draft.selectedModules || modules.map(([name]) => name));
      } catch { /* ignore stale local drafts */ }
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTool(routeNames[location.hash.slice(2)] || '商品详情页');
    addEventListener('hashchange', onHashChange);
    return () => removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('xiaojishuo-draft', JSON.stringify({ brief, settings, selectedModules, savedAt: Date.now() }));
  }, [brief, settings, selectedModules]);

  const prompt = useMemo(() => {
    return `为${settings.country}${settings.platform}平台制作${settings.language}${settings.pageType}商品详情页。\n商品信息：${brief}\n需要模块：${selectedModules.join('、')}。\n要求：保持参考图商品主体、结构、品牌标识和颜色准确，专业电商摄影，版式干净，高端商业质感，文字清晰可读。`;
  }, [settings, brief, selectedModules]);

  function addFiles(fileList) {
    const valid = [...fileList].filter((file) => /image\/(png|jpeg|webp)/.test(file.type)).slice(0, 3 - images.length);
    if (!valid.length) return setNotice('仅支持 PNG、JPG、WEBP，最多 3 张');
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { name: file.name, src: reader.result }].slice(0, 3));
      reader.readAsDataURL(file);
    });
  }

  async function generate() {
    if (!configured) return setNotice(apiUnavailableMessage);
    if (authRequired && !authToken) { setLoginOpen(true); return setNotice('请先登录后再使用生图功能'); }
    if (!images.length) return setNotice('请先上传至少一张商品原图');
    if (!brief.trim()) return setNotice('请填写商品卖点与生成要求');
    if (!selectedModules.length) return setNotice('请至少选择一个页面模块');
    setStatus('submitting'); setNotice('正在提交生成任务…'); setProgress(8);
    try {
      const response = await fetch(apiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
        body: JSON.stringify({ prompt, referenceImages: images.map((image) => image.src), aspectRatio: '4:5', n: Math.min(4, selectedModules.length) }),
      });
      const body = await readApiResponse(response);
      const tasks = (body.data || [body]).map((item) => item.task_id || item.id).filter(Boolean);
      if (!tasks.length && body.data?.some((item) => item.url)) {
        setGenerated(body.data.map((item) => item.url)); setProgress(100); setStatus('done'); return;
      }
      setStatus('polling'); setNotice(`已创建 ${tasks.length} 个任务，正在生成…`);
      const urls = [];
      for (let attempt = 0; attempt < 80 && urls.length < tasks.length; attempt += 1) {
        await sleep(3000);
        const results = await Promise.all(tasks.map((id) => fetch(apiUrl(`/api/tasks/${encodeURIComponent(id)}`), {
          headers: authHeader(authToken),
        }).then(readApiResponse)));
        urls.splice(0, urls.length, ...results.flatMap((r) => r.url || r.image_url || r.data?.[0]?.url ? [r.url || r.image_url || r.data?.[0]?.url] : []));
        const avg = results.reduce((sum, r) => sum + (r.progress || (r.status === 'completed' ? 100 : 10)), 0) / Math.max(results.length, 1);
        setProgress(Math.max(10, Math.round(avg)));
        const failed = results.find((r) => r.status === 'failed' || r.error);
        if (failed) throw new Error(failed.error?.message || failed.message || '图片生成失败');
      }
      if (!urls.length) throw new Error('生成时间较长，请稍后重试');
      setGenerated(urls); setProgress(100); setStatus('done'); setNotice(`已生成 ${urls.length} 张图片`);
    } catch (error) {
      setStatus('error'); setProgress(0); setNotice(error.message);
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginStatus('running');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const body = await readApiResponse(response);
      if (!body.token?.includes('.')) throw new Error('登录凭证无效，请检查后端登录配置');
      const me = await fetch(apiUrl('/api/me'), { headers: authHeader(body.token) }).then(readApiResponse);
      if (!me.authRequired || !me.username) throw new Error('登录验证失败');
      localStorage.setItem(authStorageKey, body.token);
      setAuthToken(body.token);
      setAuthUser(me.username);
      setLoginForm({ username: '', password: '' });
      setLoginOpen(false);
      setLoginStatus('done');
      setNotice('登录成功');
    } catch (error) {
      setLoginStatus('error');
      setNotice(error.message);
    }
  }

  function logout() {
    fetch(apiUrl('/api/logout'), { method: 'POST', headers: authHeader(authToken) }).catch(() => {});
    localStorage.removeItem(authStorageKey);
    setAuthToken('');
    setAuthUser('');
    setNotice('已退出登录');
  }

  function smartWrite() {
    setBrief('产品名称：无线主动降噪耳机\n核心卖点：Hi-Fi 立体声、40 小时续航、蓝牙 5.3、10 分钟快充可用 6 小时\n适用人群：通勤、运动与商务人士\n设计要求：突出高级质感与佩戴舒适度');
    setNotice('已生成一版商品卖点，可继续修改');
  }

  function openTool(name) {
    if (routeMap[name]) {
      setActiveTool(name); location.hash = `/${routeMap[name]}`; setMobileNav(false); setNotice('');
    } else setNotice(`${name} 功能入口已保留`);
  }

  if (!authChecked) return <LoginLoading />;
  if (authRequired && !authToken) return <LoginGate form={loginForm} setForm={setLoginForm} status={loginStatus} notice={notice} onSubmit={login} />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={20} /></button>
      <div className="brand-lockup"><img className="logo" src={asset('/assets/logo.png')} alt="Kylin Glory Design" /><span>AI DESIGN STUDIO</span></div>
      <button className="new-task"><Plus size={17} /> 新建任务</button>
      <span className="task-name"><small>WORKSPACE</small><b>{activeTool}</b><i>#01</i></span>
      <span className={`api-state ${configured ? 'ready' : ''}`}>{configured ? '接口已连接' : '待配置密钥'}</span>
      <button className="login" onClick={() => authToken ? logout() : setLoginOpen(true)} title={authToken ? `当前账号：${authUser || '已登录'}，点击退出` : '登录'}>
        <LogIn size={15} /> {authToken ? '已登录' : '登录'}
      </button>
    </header>

    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X /></button>
      <div className="sidebar-heading"><span>创作中心</span><small>12 TOOLS</small></div>
      {navGroups.map((group) => <div className="nav-group" key={group.label}>
        <div className="nav-label">{group.label}</div>
        {group.items.map(([Icon, name, badge]) => <button key={name} className={`nav-item ${name === activeTool ? 'active' : ''}`} onClick={() => openTool(name)}>
          <Icon size={19} /><span>{name}</span>{badge && <small className={badge === 'BETA' ? 'beta' : ''}>{badge}</small>}
        </button>)}
      </div>)}
      <button className={`nav-item drafts ${activeTool === '草稿箱' ? 'active' : ''}`} onClick={() => openTool('草稿箱')}><FolderOpen size={19} /><span>草稿箱</span><b>{draftCount()}</b></button>
    </aside>

    {activeTool === '商品详情页' ? <main className="workspace">
      <section className="control-panel">
        <div className="panel-section upload-section">
          <h2>商品原图</h2>
          <div className="tabs">
            <button className="selected" onClick={() => inputRef.current?.click()}><Upload size={14} />上传图片</button>
            <button onClick={() => setLinkOpen(true)}><Link2 size={14} />链接导入</button>
          </div>
          <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => addFiles(e.target.files)} />
          <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
            {images.length ? <div className="thumbs">{images.map((item, index) => <div className="thumb" key={item.name + index}>
              <img src={item.src} alt={item.name} /><button onClick={(e) => { e.stopPropagation(); setImages((prev) => prev.filter((_, i) => i !== index)); }} aria-label="移除图片"><X size={13} /></button>
            </div>)}{images.length < 3 && <div className="add-thumb"><Plus size={20} /></div>}</div> : <><button className="upload-button"><Upload size={17} /> 上传图片</button><span>同一产品，最多3张</span></>}
          </div>
        </div>

        <div className="panel-section settings-section">
          <h2>生成设置</h2>
          <div className="select-grid">
            {Object.entries(platformOptions).map(([key, values]) => <label key={key}>
              <select value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}>{values.map((v) => <option key={v}>{v}</option>)}</select><ChevronDown size={14} />
            </label>)}
          </div>
        </div>

        <div className="panel-section brief-section">
          <div className="section-title-row"><h2>商品卖点&要求</h2><div className="text-tools">
            <button disabled={!brief} title="预览"><Search size={13} />预览</button>
            <button disabled={!brief} title="复制" onClick={() => navigator.clipboard.writeText(brief)}><Copy size={13} />复制</button>
            <button disabled={!brief} title="清空" onClick={() => setBrief('')}><RotateCcw size={13} />清空</button>
            <button onClick={smartWrite}><WandSparkles size={14} />AI写写</button>
          </div></div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={'建议包含以下信息及生成精度：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.规格信息\n5.具体参数'} />
        </div>

        <div className="panel-section modules-section">
          <h2>包含模块（多选）</h2>
          <div className="module-grid">{modules.map(([name, desc]) => {
            const selected = selectedModules.includes(name);
            return <button key={name} className={selected ? 'selected' : ''} onClick={() => setSelectedModules((prev) => selected ? prev.filter((x) => x !== name) : [...prev, name])}>
              {selected && <Check size={13} />}<strong>{name}</strong><span>{desc}</span>
            </button>;
          })}</div>
        </div>

        <div className="generate-wrap">
          <button className="generate" disabled={status === 'submitting' || status === 'polling'} onClick={generate}>
            {status === 'submitting' || status === 'polling' ? <LoaderCircle className="spin" /> : <Sparkles />} {status === 'polling' ? `生成中 ${progress}%` : images.length ? '一键生成详情页' : '请上传产品图'}
          </button>
          <p>多模块 · 一键生成 · 商业可用</p>
        </div>
      </section>

      <section className="preview-panel">
        <div className="preview-heading"><div className="eyebrow"><Sparkles size={15} />多模块 · 一键生成 · 商业可用</div><h1>商品详情页</h1><p>上传商品图，AI 即刻生成 <b>符合多电商平台规范</b> 的专业详情页。</p></div>
        {generated.length ? <div className="generated-grid">{generated.map((url, i) => <article key={url}><img src={url} alt={`AI 生成详情图 ${i + 1}`} /><a href={url} target="_blank" rel="noreferrer">查看原图</a></article>)}</div> : <ProductPreview />}
      </section>
    </main> : activeTool === '爆款视频' ? <VideoWorkspace configured={videoConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === '商品解析' ? <ParseWorkspace configured={parseConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === '数字人' ? <DigitalHumanWorkspace configured={digitalHumanConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === '发布编辑器' ? <PublishEditor configured={editorConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === 'AI 看相' ? <FaceReading configured={faceConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === 'AI PPT' ? <AiPpt configured={pptConfigured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} /> : activeTool === '个人中心' ? <AccountCenter authUser={authUser} authRequired={authRequired} configured={{ image: configured, video: videoConfigured, parse: parseConfigured, human: digitalHumanConfigured, editor: editorConfigured, face: faceConfigured, ppt: pptConfigured }} /> : activeTool === '购买点数' ? <CreditsPage /> : activeTool === '草稿箱' ? <DraftsPage setNotice={setNotice} /> : <ToolWorkspace tool={activeTool} configured={configured} authRequired={authRequired} authToken={authToken} onLoginRequired={() => setLoginOpen(true)} setNotice={setNotice} />}

    {notice && <div className={`toast ${status === 'error' ? 'error' : ''}`}><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示"><X size={15} /></button></div>}
    {linkOpen && <div className="modal-backdrop" onClick={() => setLinkOpen(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-title"><h3>链接导入</h3><button className="icon-button" onClick={() => setLinkOpen(false)}><X /></button></div>
      <p>粘贴公开可访问的商品图片地址</p><input autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://example.com/product.jpg" />
      <button className="primary" onClick={() => { if (linkValue) setImages((prev) => [...prev, { name: '链接图片', src: linkValue }].slice(0, 3)); setLinkOpen(false); setLinkValue(''); }}>导入图片</button>
    </div></div>}
    {loginOpen && <div className="modal-backdrop" onClick={() => setLoginOpen(false)}><form className="modal login-modal" onSubmit={login} onClick={(e) => e.stopPropagation()}>
      <div className="modal-title"><h3>登录</h3><button type="button" className="icon-button" onClick={() => setLoginOpen(false)}><X /></button></div>
      <p>请输入管理员账号和密码</p>
      <input autoFocus value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="账号" autoComplete="username" />
      <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="密码" autoComplete="current-password" />
      <button className="primary" disabled={loginStatus === 'running' || !loginForm.username || !loginForm.password}>
        {loginStatus === 'running' ? '登录中…' : '登录'}
      </button>
    </form></div>}
  </div>;
}

function LoginLoading() {
  return <div className="login-loading"><img src={asset('/assets/logo.png')} alt="Kylin Glory Design" /><LoaderCircle className="spin" /></div>;
}

function LoginGate({ form, setForm, status, notice, onSubmit }) {
  return <main className="login-gate">
    <div className="login-app-preview" aria-hidden="true">
      <header><img src={asset('/assets/logo.png')} alt="" /><i /><i /><i /><span /></header>
      <aside>{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</aside>
      <section><i /><i /><i /></section>
    </div>
    <div className="login-backdrop" />
    <section className="login-dialog">
      <div className="login-showcase">
        <img className="login-showcase-bg" src={asset('/assets/detail-hero.webp')} alt="AI 电商设计作品" />
        <div className="login-showcase-shade" />
        <img className="login-brand" src={asset('/assets/logo.png')} alt="Kylin Glory Design" />
        <div className="login-message"><h1>一键生成全套</h1><strong>详情页 · 底图 · 海外电商</strong><p>AI 驱动的电商设计工作台。上传一张产品图，快速产出完整的营销素材。</p></div>
        <p className="login-invite">Kylin Glory Design · the Best for You</p>
      </div>
      <div className="login-form-side"><form className="login-page-form" onSubmit={onSubmit}>
        <div className="login-form-heading"><h2>登录</h2><p>仅限授权账号访问</p></div>
        {notice && <div className="login-page-error">{notice}</div>}
        <label><span>账号</span><div><UserRound size={18} /><input autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="请输入用户名" autoComplete="username" /></div></label>
        <label><span>密码</span><div><ShieldCheck size={18} /><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="请输入密码" autoComplete="current-password" /></div></label>
        <button className="login-submit" disabled={status === 'running' || !form.username || !form.password}>{status === 'running' ? <LoaderCircle className="spin" /> : <LogIn size={17} />}{status === 'running' ? '登录中…' : '登录'}</button>
        <div className="login-security"><ShieldCheck size={14} /><span>登录后可使用全部创作功能</span></div>
      </form></div>
    </section>
  </main>;
}

const baseScenes = [
  ['居家生活', '北欧温馨'], ['户外街拍', '自然环境'], ['办公桌面', '工作场景'], ['极简纯色', '高级棚拍'],
  ['节日营销', '促销氛围'], ['科技赛博', '深色霓虹'], ['自然质感', '木纹/绿植'], ['专业棚拍', '电商主图'],
  ['咖啡馆桌', '下午茶氛围'], ['健身房', '运动对镜'], ['旅行度假', '海边/酒店'], ['城市夜景', '霓虹夜色'],
  ['厨房料理', '美食场景'], ['卧室床品', '柔光床头'], ['浴室个护', '清新水珠'], ['复古杂志', '胶片质感'],
];
const overseasModules = [
  ['主图（白底）', '平台主图标准'], ['信息图', '卖点+图标+短句'], ['生活场景', '使用场景图'],
  ['对比图', '前后/竞品对比'], ['包装图', '产品+包装盒'], ['尺寸图', '规格示意'],
];
const posterTemplates = [
  ['训练营爆款', '课程招生 · 深蓝金字 · 6 区块', '生成一张高端商务科技风海报，深蓝黑背景，金色点缀，大标题突出训练营核心收益，六区块清晰排版。'],
  ['极简留白', '苹果邀请函风 · 大量留白', '生成一张极简高级海报，大量白色留白，精致无衬线字体，聚焦一个核心标题和一个产品主体。'],
  ['商务深色', '麦肯锡报告风 · 金字数据', '生成一张商务深色数据海报，黑灰背景，金色关键数字，专业咨询报告风格。'],
  ['手写温暖', '读书会 · 治愈系 · 纸张质感', '生成一张温暖治愈的读书会海报，手写字体，纸张纹理，柔和自然色彩。'],
  ['抖音爆款', '撞色粗体 · 情绪化标题', '生成一张抖音爆款宣传海报，高对比撞色，超粗体情绪化标题，强烈视觉冲击。'],
  ['小红书笔记', '粉调拼贴 · 贴纸手账风', '生成一张小红书风格海报，粉色调拼贴，贴纸手账元素，清新有生活感。'],
  ['炫彩渐变', '潮流 3D · 紫粉蓝 · Y2K', '生成一张潮流 Y2K 海报，紫粉蓝炫彩渐变，立体 3D 字体，年轻未来感。'],
  ['节日促销', '红金灯笼 · 促销大字', '生成一张节日促销海报，红金配色，灯笼元素，超大优惠数字，喜庆但高级。'],
  ['复古杂志', '80s-90s 胶片颗粒 · 暖橘', '生成一张复古杂志海报，80 年代胶片颗粒，暖橘色调，经典编辑排版。'],
  ['国潮水墨', '水墨 · 朱红印章 · 宣纸', '生成一张国潮水墨海报，宣纸肌理，黑色水墨与朱红印章，现代东方排版。'],
  ['赛博霓虹', '黑紫霓虹 · 故障 Glitch', '生成一张赛博朋克海报，黑紫背景，霓虹灯光，故障艺术字体，未来都市氛围。'],
  ['电影海报', '戏剧光影 · 大片感 · 悬念', '生成一张电影级宣传海报，戏剧性光影，大片质感，视觉中心明确，保留悬念。'],
];

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, src: reader.result }); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

async function submitAndPoll({ prompt, images, aspectRatio, count, authToken, onProgress }) {
  const response = await fetch(apiUrl('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
    body: JSON.stringify({ prompt, referenceImages: images.map((image) => image.src), aspectRatio, n: count }),
  });
  const body = await readApiResponse(response);
  if (body.data?.some((item) => item.url)) return body.data.map((item) => item.url).filter(Boolean);
  const tasks = (body.data || [body]).map((item) => item.task_id || item.id).filter(Boolean);
  if (!tasks.length) throw new Error('接口未返回任务 ID');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(3000);
    const results = await Promise.all(tasks.map(async (id) => {
      const result = await fetch(apiUrl(`/api/tasks/${encodeURIComponent(id)}`), {
        headers: authHeader(authToken),
      }); return readApiResponse(result);
    }));
    onProgress(Math.round(results.reduce((sum, item) => sum + (item.progress || (item.status === 'completed' ? 100 : 10)), 0) / results.length));
    const failed = results.find((item) => item.status === 'failed' || item.error);
    if (failed) throw new Error(failed.error?.message || failed.message || '图片生成失败');
    const urls = results.map((item) => item.url || item.image_url || item.data?.[0]?.url).filter(Boolean);
    if (urls.length === tasks.length) return urls;
  }
  throw new Error('生成时间较长，请稍后重试');
}

const videoModelOptions = [
  { value: 'omni_flash-10s', name: 'Omni Flash', tip: '10 秒 · 文生视频 / 多参考图', maxImages: 7 },
  { value: 'sora-2-12s', name: 'Sora 2', tip: '12 秒 · 文生视频 / 图生视频', maxImages: 1 },
  { value: 'veo_3_1-fast-fl', name: 'Veo 3.1 Fast', tip: '首帧 / 首尾帧生成', maxImages: 2, imageRequired: true },
];

function VideoWorkspace({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const inputRef = useRef(null);
  const [model, setModel] = useState('omni_flash-10s');
  const [size, setSize] = useState('1280x720');
  const [prompt, setPrompt] = useState('');
  const [promptExtend, setPromptExtend] = useState('');
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const selectedModel = videoModelOptions.find((item) => item.value === model) || videoModelOptions[0];

  useEffect(() => {
    const saved = localStorage.getItem('xiaojishuo-video-draft');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setModel(data.model || 'omni_flash-10s'); setSize(data.size || '1280x720');
      setPrompt(data.prompt || ''); setPromptExtend(data.promptExtend || '');
    } catch { /* ignore stale local draft */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('xiaojishuo-video-draft', JSON.stringify({ model, size, prompt, promptExtend }));
  }, [model, size, prompt, promptExtend]);

  useEffect(() => {
    setImages((current) => current.slice(0, selectedModel.maxImages));
  }, [model]);

  async function addVideoImages(fileList) {
    const valid = [...fileList]
      .filter((file) => /image\/(png|jpeg|webp)/.test(file.type))
      .slice(0, selectedModel.maxImages - images.length);
    if (!valid.length) return setNotice(`仅支持 PNG、JPG、WEBP，最多 ${selectedModel.maxImages} 张`);
    const loaded = await Promise.all(valid.map(toDataUrl));
    setImages((current) => [...current, ...loaded].slice(0, selectedModel.maxImages));
  }

  async function generateVideo() {
    if (!configured) return setNotice('视频接口尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再生成视频'); }
    if (!prompt.trim()) return setNotice('请填写视频内容描述');
    if (selectedModel.imageRequired && !images.length) return setNotice('Veo 需要上传首帧或首尾帧图片');

    setStatus('submitting'); setProgress(2); setVideoUrl(''); setNotice('正在提交视频任务…');
    try {
      const response = await fetch(apiUrl('/api/videos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
        body: JSON.stringify({ model, prompt, size, promptExtend, images: images.map((item) => item.src) }),
      });
      const task = await readApiResponse(response);
      const taskId = task.id || task.task_id;
      if (!taskId) throw new Error('视频接口未返回任务 ID');

      setStatus('polling'); setNotice('视频正在生成，通常需要 2–5 分钟…');
      for (let attempt = 0; attempt < 72; attempt += 1) {
        await sleep(5000);
        const taskResponse = await fetch(apiUrl(`/api/videos/${encodeURIComponent(taskId)}`), { headers: authHeader(authToken) });
        const result = await readApiResponse(taskResponse);
        setProgress(Math.max(5, Number(result.progress) || (result.status === 'processing' ? 20 : 5)));
        if (result.status === 'failed') throw new Error(result.fail_reason || '视频生成失败');
        if (result.status === 'completed' && result.video_url) {
          setVideoUrl(result.video_url); setProgress(100); setStatus('done'); setNotice('视频已生成'); return;
        }
      }
      throw new Error('生成时间超过 6 分钟，请稍后再试');
    } catch (error) {
      setStatus('error'); setProgress(0); setNotice(error.message);
    }
  }

  const isRunning = status === 'submitting' || status === 'polling';
  return <main className="workspace tool-workspace video-workspace">
    <section className="control-panel">
      <div className="panel-section"><h2>视频模型</h2><div className="video-models">{videoModelOptions.map((item) => <button key={item.value} className={model === item.value ? 'selected' : ''} onClick={() => setModel(item.value)}><strong>{item.name}</strong><span>{item.tip}</span></button>)}</div></div>

      <div className="panel-section"><h2>画面尺寸</h2><div className="video-sizes">{[['1280x720','横版 720P'],['1920x1080','横版 1080P'],['720x1280','竖版 720P'],['1080x1920','竖版 1080P']].map(([value, label]) => <button key={value} className={size === value ? 'selected' : ''} onClick={() => setSize(value)}><strong>{label}</strong><span>{value}</span></button>)}</div></div>

      <div className="panel-section upload-section"><div className="section-title-row"><h2>参考图{selectedModel.imageRequired ? '（必填）' : '（可选）'}</h2><span className="field-tip">最多 {selectedModel.maxImages} 张</span></div>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple={selectedModel.maxImages > 1} onChange={(event) => addVideoImages(event.target.files)} />
        <UploadArea images={images} max={selectedModel.maxImages} onOpen={() => inputRef.current?.click()} onDrop={addVideoImages} onRemove={(index) => setImages((current) => current.filter((_, i) => i !== index))} hint={selectedModel.imageRequired ? '上传首帧，或首帧 + 尾帧' : '不上传则使用文生视频'} />
      </div>

      <div className="panel-section brief-section"><h2>视频内容描述</h2><textarea className="video-prompt" value={prompt} maxLength={4000} onChange={(event) => setPrompt(event.target.value)} placeholder="描述主体、动作、场景、镜头运动、光线和风格…" /></div>
      <div className="panel-section brief-section"><h2>补充要求（可选）</h2><textarea className="video-extend" value={promptExtend} onChange={(event) => setPromptExtend(event.target.value)} placeholder="例如：镜头缓慢推进，产品标识保持清晰，不改变外观。" /></div>

      <div className="generate-wrap"><button className="generate" disabled={isRunning || !prompt.trim() || (selectedModel.imageRequired && !images.length)} onClick={generateVideo}>{isRunning ? <LoaderCircle className="spin" /> : <MonitorPlay />} {isRunning ? `生成中 ${progress}%` : '生成视频'}</button><p>异步生成 · 预计 2–5 分钟 · 完成后可下载</p></div>
    </section>

    <section className="preview-panel video-preview"><div className="preview-heading"><div className="eyebrow"><MonitorPlay size={15} />AI 视频生成</div><h1>爆款视频</h1><p>用商品图和创意描述生成适合投放的产品短片。</p></div>
      {videoUrl ? <div className="video-result"><video src={videoUrl} controls playsInline /><div><span>{selectedModel.name} · {size}</span><a href={videoUrl} target="_blank" rel="noreferrer"><Download size={16} />打开并下载视频</a></div></div> : <ModuleShowcase image="/assets/scene-sport.webp" icon={MonitorPlay} kicker="Cinematic motion" title={isRunning ? '正在制作视频' : '让产品进入镜头'} detail={isRunning ? `当前进度 ${progress}%` : '从静态产品图延展出有节奏、有质感的商业短片。'}>{isRunning && <div className="video-progress"><i style={{ width: `${progress}%` }} /></div>}</ModuleShowcase>}
    </section>
  </main>;
}

const parsePlatformOptions = [
  { value: 'shopee', name: '虾皮', tip: 'Shopee 商品' },
  { value: 'amazon', name: '亚马逊', tip: '全球站点商品' },
  { value: 'xhs', name: '小红书', tip: '笔记 / 搜索' },
  { value: 'douyin', name: '抖音', tip: '商品与短链' },
  { value: 'wechat-channels', name: '视频号', tip: '视频与图集' },
  { value: 'instagram', name: 'Instagram', tip: '帖子 / Reel' },
];

function ParseWorkspace({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const [platform, setPlatform] = useState('amazon');
  const [source, setSource] = useState('');
  const [xhsType, setXhsType] = useState('note');
  const [language, setLanguage] = useState('zh-CN');
  const [marketplace, setMarketplace] = useState('');
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const isSearch = platform === 'xhs' && xhsType === 'search';

  useEffect(() => {
    const saved = localStorage.getItem('xiaojishuo-parse-draft');
    if (!saved) return;
    try { const data = JSON.parse(saved); setPlatform(data.platform || 'amazon'); setSource(data.source || ''); setXhsType(data.xhsType || 'note'); setLanguage(data.language || 'zh-CN'); setMarketplace(data.marketplace || ''); setLimit(data.limit || 20); } catch { /* ignore stale draft */ }
  }, []);
  useEffect(() => {
    localStorage.setItem('xiaojishuo-parse-draft', JSON.stringify({ platform, source, xhsType, language, marketplace, limit }));
  }, [platform, source, xhsType, language, marketplace, limit]);

  async function parseProduct() {
    if (!configured) return setNotice('商品解析接口尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再解析商品'); }
    if (!source.trim()) return setNotice(isSearch ? '请输入小红书搜索关键词' : '请粘贴商品或内容链接');
    setStatus('running'); setResult(null); setNotice('正在抓取并解析，通常需要 3–15 秒…');
    try {
      const response = await fetch(apiUrl('/api/parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
        body: JSON.stringify({ platform, url: isSearch ? '' : source, keyword: isSearch ? source : '', type: xhsType, lang: platform === 'shopee' ? language : '', translate: platform === 'amazon' ? language : '', marketplace, limit }),
      });
      const body = await readApiResponse(response);
      if (body.success === false) throw new Error(body.error || '解析失败');
      setResult(body); setStatus('done'); setNotice('商品解析完成');
    } catch (error) { setStatus('error'); setNotice(error.message); }
  }

  const selectedPlatform = parsePlatformOptions.find((item) => item.value === platform);
  return <main className="workspace tool-workspace parse-workspace">
    <section className="control-panel">
      <div className="panel-section"><h2>选择平台</h2><div className="parse-platforms">{parsePlatformOptions.map((item) => <button key={item.value} className={platform === item.value ? 'selected' : ''} onClick={() => { setPlatform(item.value); setResult(null); }}><strong>{item.name}</strong><span>{item.tip}</span></button>)}</div></div>

      {platform === 'xhs' && <div className="panel-section"><h2>解析模式</h2><div className="parse-modes">{[['note','笔记'],['search','关键词搜索'],['shop','店铺'],['category','分类']].map(([value, label]) => <button key={value} className={xhsType === value ? 'selected' : ''} onClick={() => setXhsType(value)}>{label}</button>)}</div></div>}

      <div className="panel-section brief-section"><h2>{isSearch ? '搜索关键词' : '商品 / 内容链接'}</h2><textarea className="parse-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder={isSearch ? '例如：连衣裙 夏季' : '粘贴商品链接、帖子链接或包含链接的分享文案…'} /></div>

      {(platform === 'shopee' || platform === 'amazon') && <div className="panel-section"><h2>翻译语言</h2><select className="parse-select" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">不翻译</option><option value="zh-CN">简体中文</option><option value="en">英文</option><option value="ja">日文</option><option value="ko">韩文</option><option value="th">泰文</option><option value="vi">越南文</option></select></div>}
      {platform === 'amazon' && <div className="panel-section"><h2>亚马逊站点</h2><select className="parse-select" value={marketplace} onChange={(event) => setMarketplace(event.target.value)}><option value="">自动识别</option><option value="us">美国</option><option value="uk">英国</option><option value="de">德国</option><option value="jp">日本</option><option value="ca">加拿大</option></select></div>}
      {platform === 'xhs' && <div className="panel-section"><h2>返回数量</h2><input className="parse-number" type="number" min="1" max="200" value={limit} onChange={(event) => setLimit(event.target.value)} /></div>}

      <div className="generate-wrap"><button className="generate" disabled={status === 'running' || !source.trim()} onClick={parseProduct}>{status === 'running' ? <LoaderCircle className="spin" /> : <Search />} {status === 'running' ? '解析中…' : '开始解析'}</button><p>结构化提取 · 图片素材 · 商品信息</p></div>
    </section>

    <section className="preview-panel parse-preview"><div className="preview-heading"><div className="eyebrow"><Search size={15} />跨平台商品数据</div><h1>商品解析</h1><p>提取 {selectedPlatform?.name} 的标题、图片、价格和商品描述。</p></div>
      {result ? <ParseResult result={result} onCopy={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); setNotice('原始数据已复制'); }} /> : <ModuleShowcase image="/assets/detail-hero.webp" icon={Search} kicker="Product intelligence" title="看见商品的全部信息" detail="一次提取标题、价格、卖点与图片，为下一步创作准备完整素材。" />}
    </section>
  </main>;
}

function ParseResult({ result, onCopy }) {
  const data = result.data || {};
  const items = Array.isArray(data.products) ? data.products : [data];
  return <div className="parse-results"><div className="parse-summary"><span>{result.platform || '平台'} · {items.length} 条结果{result.elapsed_ms ? ` · ${(result.elapsed_ms / 1000).toFixed(1)} 秒` : ''}</span><button onClick={onCopy}><Copy size={14} />复制原始数据</button></div>
    <div className="parse-result-list">{items.map((item, index) => <ParseResultItem key={item.product_id || item.url || index} item={item} />)}</div>
    <details className="raw-result"><summary>查看原始 JSON</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </div>;
}

function ParseResultItem({ item }) {
  const media = [...new Set([...(item.main_images || []), ...(item.images || []), ...(item.media_urls || []), item.coverUrl, item.thumbnail, item.videoUrl].filter(Boolean))];
  const title = item.title || item.name || item.caption || item.typeLabel || '解析结果';
  const details = [
    ['价格', item.price], ['品牌', item.brand], ['店铺', item.seller_name || item.shop_name], ['作者', item.author],
    ['评分', item.rating], ['评论数', item.reviews_count], ['分类', item.breadcrumb],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const description = item.description || item.desc_short || (item.caption !== title ? item.caption : '');
  return <article className="parse-result-item">
    {media.length > 0 && <div className="parse-media">{media.slice(0, 8).map((url) => /\.mp4(?:\?|$)/i.test(url) || url === item.videoUrl ? <video key={url} src={url} controls playsInline /> : <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={title} /></a>)}</div>}
    <div className="parse-copy"><h2>{title}</h2>{details.length > 0 && <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>}{description && <p>{description}</p>}
      {Array.isArray(item.features) && item.features.length > 0 && <ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
      {Array.isArray(item.attributes) && item.attributes.length > 0 && <div className="parse-attributes">{item.attributes.map((attribute, index) => <span key={`${attribute.name}-${index}`}><b>{attribute.name}</b>{attribute.value}</span>)}</div>}
      {item.stats && <div className="parse-stats"><span>点赞 {item.stats.likeCount || 0}</span><span>收藏 {item.stats.favCount || 0}</span><span>转发 {item.stats.forwardCount || 0}</span></div>}
    </div>
  </article>;
}

const humanValue = (body, key) => body?.[key] || body?.data?.[key] || body?.result?.[key];

async function createHumanTask(action, payload, authToken) {
  const response = await fetch(apiUrl('/api/digital-human/tasks'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
    body: JSON.stringify({ action, payload }),
  });
  return readApiResponse(response);
}

async function waitHumanTask(kind, initial, authToken, onProgress) {
  let current = initial;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = String(current.status || '').toLowerCase();
    if (state === 'succeeded' || state === 'completed') return current;
    if (state === 'failed' || state === 'error') throw new Error(current.fail_reason || current.error?.message || '数字人任务失败');
    const taskId = current.task_id || current.id;
    if (!taskId) throw new Error('数字人接口未返回任务 ID');
    await sleep(5000);
    const response = await fetch(apiUrl(`/api/digital-human/tasks/${kind}/${encodeURIComponent(taskId)}`), { headers: authHeader(authToken) });
    current = await readApiResponse(response);
    onProgress(Number(current.progress) || Math.min(90, 10 + attempt * 2));
  }
  throw new Error('任务处理时间较长，请稍后重试');
}

async function uploadHumanFile(file, purpose, authToken) {
  if (file.size > 25 * 1024 * 1024) throw new Error('本地素材不能超过 25MB，请改用公网直链');
  const encoded = await toDataUrl(file);
  const response = await fetch(apiUrl('/api/digital-human/files'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
    body: JSON.stringify({ dataUrl: encoded.src, filename: file.name, purpose }),
  });
  return readApiResponse(response);
}

function DigitalHumanWorkspace({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const avatarInputRef = useRef(null); const audioInputRef = useRef(null);
  const [avatarMode, setAvatarMode] = useState('image');
  const [templateType, setTemplateType] = useState('image');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [audioMode, setAudioMode] = useState('upload');
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [script, setScript] = useState('');
  const [speed, setSpeed] = useState('1');
  const [prompt, setPrompt] = useState('自然口播，表情和嘴型自然，画面稳定');
  const [status, setStatus] = useState('idle');
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('xiaojishuo-digital-human-draft');
    if (!saved) return;
    try { const data = JSON.parse(saved); setAvatarMode(data.avatarMode || 'image'); setTemplateType(data.templateType || 'image'); setAvatarUrl(data.avatarUrl || ''); setTemplateId(data.templateId || ''); setAudioMode(data.audioMode || 'upload'); setAudioUrl(data.audioUrl || ''); setVoiceId(data.voiceId || ''); setScript(data.script || ''); setSpeed(data.speed || '1'); setPrompt(data.prompt || '自然口播，表情和嘴型自然，画面稳定'); } catch { /* ignore stale draft */ }
  }, []);
  useEffect(() => {
    localStorage.setItem('xiaojishuo-digital-human-draft', JSON.stringify({ avatarMode, templateType, avatarUrl, templateId, audioMode, audioUrl, voiceId, script, speed, prompt }));
  }, [avatarMode, templateType, avatarUrl, templateId, audioMode, audioUrl, voiceId, script, speed, prompt]);

  async function generateHuman() {
    if (!configured) return setNotice('数字人模型尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再生成数字人'); }
    if (avatarMode === 'image' && !avatarFile) return setNotice('请上传数字人人像图片');
    if (avatarMode === 'video' && !avatarUrl.trim()) return setNotice('请输入真人视频公网直链');
    if (avatarMode === 'template' && !templateId.trim()) return setNotice('请输入数字人模板 ID');
    if (audioMode === 'upload' && !audioFile) return setNotice('请上传口播音频');
    if (audioMode === 'url' && !audioUrl.trim()) return setNotice('请输入口播音频公网直链');
    if (audioMode === 'speech' && (!voiceId.trim() || !script.trim())) return setNotice('请填写声音 ID 和口播文案');

    setStatus('running'); setProgress(3); setVideoUrl('');
    try {
      let avatarTemplateId = templateId.trim();
      const generationType = avatarMode === 'template' ? templateType : avatarMode;
      if (avatarMode === 'image') {
        setStage('上传人像素材'); setNotice('正在上传人像素材…');
        const upload = await uploadHumanFile(avatarFile, 'avatar_image', authToken);
        const fileId = humanValue(upload, 'file_id');
        if (!fileId) throw new Error('人像上传后未返回 file_id');
        setStage('创建图片数字人模板'); setProgress(12);
        const created = await createHumanTask('image-template', { file_id: fileId, prompt }, authToken);
        const template = humanValue(created, 'avatar_template_id') ? created : await waitHumanTask('image-template', created, authToken, (value) => setProgress(12 + value * .28));
        avatarTemplateId = humanValue(template, 'avatar_template_id') || humanValue(template, 'template_id');
      } else if (avatarMode === 'video') {
        setStage('克隆视频数字人'); setNotice('正在创建视频数字人模板…'); setProgress(12);
        const created = await createHumanTask('video-clone', { video_url: avatarUrl.trim(), prompt }, authToken);
        const template = humanValue(created, 'avatar_template_id') ? created : await waitHumanTask('video-clone', created, authToken, (value) => setProgress(12 + value * .28));
        avatarTemplateId = humanValue(template, 'avatar_template_id') || humanValue(template, 'template_id');
      }
      if (!avatarTemplateId) throw new Error('模板任务未返回 avatar_template_id');

      let drivingAudio = {};
      if (audioMode === 'upload') {
        setStage('上传口播音频'); setNotice('正在准备驱动音频…'); setProgress(45);
        const upload = await uploadHumanFile(audioFile, 'video_driving_audio', authToken);
        const fileId = humanValue(upload, 'file_id');
        if (!fileId) throw new Error('音频上传后未返回 file_id');
        drivingAudio = { file_id: fileId };
      } else if (audioMode === 'url') {
        drivingAudio = { audio_url: audioUrl.trim() };
      } else {
        setStage('合成口播语音'); setNotice('正在根据文案合成语音…'); setProgress(45);
        const created = await createHumanTask('speech', { voice_id: voiceId.trim(), text: script.trim(), speed: Number(speed) || 1 }, authToken);
        const speech = humanValue(created, 'audio_url') ? created : await waitHumanTask('speech', created, authToken, (value) => setProgress(45 + value * .2));
        const generatedAudioUrl = humanValue(speech, 'audio_url');
        if (!generatedAudioUrl) throw new Error('语音合成未返回 audio_url');
        drivingAudio = { audio_url: generatedAudioUrl };
      }

      setStage('生成数字人口播视频'); setNotice('正在生成数字人口播视频…'); setProgress(68);
      const action = generationType === 'video' ? 'video-generation' : 'image-generation';
      const created = await createHumanTask(action, { avatar_template_id: avatarTemplateId, ...drivingAudio, prompt, ...(generationType === 'image' ? { sample_steps: 2 } : {}) }, authToken);
      const generated = humanValue(created, 'video_url') ? created : await waitHumanTask(action, created, authToken, (value) => setProgress(68 + value * .31));
      const output = humanValue(generated, 'video_url');
      if (!output) throw new Error('生成完成但未返回 video_url');
      setVideoUrl(output); setProgress(100); setStatus('done'); setStage('生成完成'); setNotice('数字人口播视频已生成');
    } catch (error) { setStatus('error'); setProgress(0); setStage(''); setNotice(error.message); }
  }

  const running = status === 'running';
  return <main className="workspace tool-workspace human-workspace">
    <section className="control-panel">
      <div className="panel-section"><h2>数字人来源</h2><div className="human-modes">{[['image','人像图片'],['video','真人视频'],['template','已有模板']].map(([value, label]) => <button key={value} className={avatarMode === value ? 'selected' : ''} onClick={() => setAvatarMode(value)}>{label}</button>)}</div></div>
      {avatarMode === 'image' && <div className="panel-section"><input ref={avatarInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} /><button className="human-upload" onClick={() => avatarInputRef.current?.click()}><Upload size={17} /><span>{avatarFile ? avatarFile.name : '上传正面人像图片'}</span></button></div>}
      {avatarMode === 'video' && <div className="panel-section"><h2>真人视频公网直链</h2><input className="human-input" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://cdn.example.com/avatar.mp4" /></div>}
      {avatarMode === 'template' && <div className="panel-section"><h2>模板类型与 ID</h2><div className="human-template-row"><select value={templateType} onChange={(event) => setTemplateType(event.target.value)}><option value="image">图片数字人</option><option value="video">视频数字人</option></select><input value={templateId} onChange={(event) => setTemplateId(event.target.value)} placeholder="avatar_xxx" /></div></div>}

      <div className="panel-section"><h2>驱动语音</h2><div className="human-modes">{[['upload','上传音频'],['url','音频直链'],['speech','文案合成']].map(([value, label]) => <button key={value} className={audioMode === value ? 'selected' : ''} onClick={() => setAudioMode(value)}>{label}</button>)}</div></div>
      {audioMode === 'upload' && <div className="panel-section"><input ref={audioInputRef} hidden type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} /><button className="human-upload" onClick={() => audioInputRef.current?.click()}><Mic size={17} /><span>{audioFile ? audioFile.name : '上传口播音频'}</span></button></div>}
      {audioMode === 'url' && <div className="panel-section"><input className="human-input" value={audioUrl} onChange={(event) => setAudioUrl(event.target.value)} placeholder="https://cdn.example.com/speech.mp3" /></div>}
      {audioMode === 'speech' && <><div className="panel-section human-speech-row"><input className="human-input" value={voiceId} onChange={(event) => setVoiceId(event.target.value)} placeholder="声音 ID：voice_xxx" /><select value={speed} onChange={(event) => setSpeed(event.target.value)}><option value="0.8">0.8x</option><option value="1">1.0x</option><option value="1.2">1.2x</option></select></div><div className="panel-section brief-section"><textarea className="human-script" value={script} onChange={(event) => setScript(event.target.value)} placeholder="输入数字人需要播报的文案…" /></div></>}

      <div className="panel-section brief-section"><h2>表演要求</h2><textarea className="human-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div>
      <div className="generate-wrap"><button className="generate" disabled={running} onClick={generateHuman}>{running ? <LoaderCircle className="spin" /> : <UserRound />} {running ? `${stage} ${Math.round(progress)}%` : '生成数字人口播'}</button><p>模板创建 · 语音驱动 · 自动生成</p></div>
    </section>

    <section className="preview-panel human-preview"><div className="preview-heading"><div className="eyebrow"><UserRound size={15} />Digital Human</div><h1>数字人口播</h1><p>使用专属形象与声音，生成自然同步的口播视频。</p></div>
      {videoUrl ? <div className="video-result"><video src={videoUrl} controls playsInline /><div><span>数字人口播 · 已完成</span><a href={videoUrl} target="_blank" rel="noreferrer"><Download size={16} />打开并下载视频</a></div></div> : <ModuleShowcase image="/assets/scene-business.webp" icon={UserRound} kicker="Digital presenter" title={running ? stage : '品牌表达，自然出镜'} detail={running ? `正在处理 ${Math.round(progress)}%` : '用统一形象与声音，持续产出清晰自然的口播内容。'}>{running && <div className="video-progress"><i style={{ width: `${progress}%` }} /></div>}</ModuleShowcase>}
    </section>
  </main>;
}

const editorPlatforms = [
  ['小红书', '生活方式笔记'], ['抖音', '短视频配文'], ['Instagram', '视觉社媒'],
  ['Facebook', '品牌动态'], ['LinkedIn', '专业内容'], ['亚马逊', '商品推广'], ['Shopify', '独立站内容'],
];

function parseEditorContent(content) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      title: String(parsed.title || ''), body: String(parsed.body || ''),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map((item) => String(item).replace(/^#/, '')).join(' ') : String(parsed.hashtags || '').replace(/#/g, ''),
    };
  } catch { return { title: '', body: cleaned, hashtags: '' }; }
}

function PublishEditor({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const mediaInputRef = useRef(null);
  const [model, setModel] = useState('gpt-5.5');
  const [platform, setPlatform] = useState('小红书');
  const [language, setLanguage] = useState('简体中文');
  const [tone, setTone] = useState('专业可信');
  const [objective, setObjective] = useState('产品推广');
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [media, setMedia] = useState([]);
  const [status, setStatus] = useState('idle');
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('xiaojishuo-editor-draft');
    if (!saved) return;
    try { const data = JSON.parse(saved); setModel(data.model || 'gpt-5.5'); setPlatform(data.platform || '小红书'); setLanguage(data.language || '简体中文'); setTone(data.tone || '专业可信'); setObjective(data.objective || '产品推广'); setSource(data.source || ''); setTitle(data.title || ''); setBody(data.body || ''); setHashtags(data.hashtags || ''); } catch { /* ignore stale draft */ }
  }, []);
  useEffect(() => {
    localStorage.setItem('xiaojishuo-editor-draft', JSON.stringify({ model, platform, language, tone, objective, source, title, body, hashtags }));
  }, [model, platform, language, tone, objective, source, title, body, hashtags]);

  async function addEditorMedia(fileList) {
    const valid = [...fileList].filter((file) => /^(image|video)\//.test(file.type)).slice(0, 4 - media.length);
    if (!valid.length) return setNotice('支持图片或视频，最多 4 个素材');
    const loaded = await Promise.all(valid.map(toDataUrl));
    setMedia((current) => [...current, ...loaded.map((item, index) => ({ ...item, type: valid[index].type }))].slice(0, 4));
  }

  async function runEditor(operation = 'generate') {
    if (!configured) return setNotice('发布文案模型尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再使用发布编辑器'); }
    if (operation === 'generate' && !source.trim()) return setNotice('请填写产品资料或创作要点');
    if (operation !== 'generate' && !body.trim()) return setNotice('请先生成或填写正文');
    setStatus('running'); setNotice(operation === 'generate' ? 'AI 正在创作文案…' : 'AI 正在优化文案…');
    try {
      const response = await fetch(apiUrl('/api/editor/generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
        body: JSON.stringify({ model, platform, language, tone, objective, source, operation, current: { title, body, hashtags } }),
      });
      const result = await readApiResponse(response);
      const copy = parseEditorContent(result.content);
      setTitle(copy.title); setBody(copy.body); setHashtags(copy.hashtags); setUsage(result.usage); setStatus('done'); setNotice('发布文案已更新');
    } catch (error) { setStatus('error'); setNotice(error.message); }
  }

  const tagList = hashtags.split(/[\s,，]+/).map((item) => item.replace(/^#/, '')).filter(Boolean);
  const fullCopy = `${title ? `${title}\n\n` : ''}${body}${tagList.length ? `\n\n${tagList.map((tag) => `#${tag}`).join(' ')}` : ''}`;
  const running = status === 'running';
  return <main className="workspace editor-workspace">
    <section className="editor-controls">
      <div className="editor-toolbar"><div><Archive size={18} /><strong>发布编辑器</strong></div><span>{status === 'done' ? '已自动保存' : '草稿自动保存'}</span></div>
      <div className="editor-settings">
        <label><span>平台</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{editorPlatforms.map(([name]) => <option key={name}>{name}</option>)}</select></label>
        <label><span>模型</span><select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-5.5">GPT-5.5</option><option value="gpt-5.6-sol">GPT-5.6 Sol</option></select></label>
        <label><span>语言</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{['简体中文','英文','日文','韩文','德文','法文','西班牙文'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>语气</span><select value={tone} onChange={(event) => setTone(event.target.value)}>{['专业可信','轻松自然','高端克制','热情促销','故事感','简洁直接'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="wide"><span>目标</span><select value={objective} onChange={(event) => setObjective(event.target.value)}>{['产品推广','新品发布','品牌故事','活动预热','知识分享','用户互动'].map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      <div className="editor-source"><div className="editor-label"><strong>产品资料与创作要点</strong><span>{source.length}/12000</span></div><textarea maxLength={12000} value={source} onChange={(event) => setSource(event.target.value)} placeholder="粘贴商品卖点、受众、价格、活动信息和必须保留的事实…" /><button className="editor-generate" disabled={running || !source.trim()} onClick={() => runEditor('generate')}>{running ? <LoaderCircle className="spin" /> : <Sparkles />}AI 生成发布文案</button></div>

      <div className="editor-copy"><div className="editor-label"><strong>标题</strong><span>{title.length} 字</span></div><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题会显示在这里" />
        <div className="editor-label body-label"><strong>正文</strong><span>{body.length} 字</span></div><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="AI 生成后可继续编辑正文" />
        <div className="editor-label"><strong>标签</strong><span>空格分隔</span></div><input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="新品 产品设计 品牌" />
        <div className="editor-actions"><button disabled={running || !body} onClick={() => runEditor('shorten')}>缩短</button><button disabled={running || !body} onClick={() => runEditor('sell')}>增强销售力</button><button disabled={running || !body} onClick={() => runEditor('retone')}>调整语气</button><button className="copy-action" disabled={!fullCopy} onClick={() => { navigator.clipboard.writeText(fullCopy); setNotice('发布内容已复制'); }}><Copy size={14} />复制</button></div>
        {usage?.total_tokens && <small className="editor-usage">本次使用 {usage.total_tokens} tokens</small>}
      </div>
    </section>

    <section className="editor-preview"><div className="editor-preview-bar"><div><span>发布预览</span><strong>{platform}</strong></div><button onClick={() => mediaInputRef.current?.click()}><ImagePlus size={15} />添加素材</button><input ref={mediaInputRef} hidden type="file" accept="image/*,video/*" multiple onChange={(event) => addEditorMedia(event.target.files)} /></div>
      <article className="social-preview"><header><div className="brand-avatar">KG</div><div><strong>Kylin Glory Design</strong><span>刚刚 · {platform}</span></div><MoreHorizontal size={18} /></header>
        {media.length === 0 && <div className="editor-showcase"><img src={asset('/assets/scene-commute.webp')} alt="产品内容发布示例" /><div><span>PRODUCT STORY</span><strong>从产品出发，完成一次有质感的发布。</strong></div></div>}
        {title && <h1>{title}</h1>}<p>{body || '生成或输入正文后，可在这里检查最终发布效果。'}</p>{tagList.length > 0 && <div className="social-tags">{tagList.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        {media.length > 0 && <div className={`editor-media media-${Math.min(media.length, 4)}`}>{media.map((item, index) => <div key={item.name + index}>{item.type.startsWith('video/') ? <video src={item.src} controls /> : <img src={item.src} alt={item.name} />}<button onClick={() => setMedia((current) => current.filter((_, i) => i !== index))} aria-label="移除素材"><X size={13} /></button></div>)}</div>}
        <footer><span>预览模式</span><span>{fullCopy.length} 字符</span></footer>
      </article>
    </section>
  </main>;
}

function parseJsonModelContent(content) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { throw new Error('模型返回格式异常，请重新生成'); }
}

function FaceReading({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const inputRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [focus, setFocus] = useState('综合解读');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');

  async function choosePhoto(file) {
    if (!file || !/image\/(png|jpeg|webp)/.test(file.type)) return setNotice('请上传 PNG、JPG 或 WEBP 照片');
    if (file.size > 10 * 1024 * 1024) return setNotice('照片不能超过 10MB');
    setPhoto(await toDataUrl(file)); setResult(null);
  }

  async function analyzeFace() {
    if (!configured) return setNotice('AI 看相视觉模型尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再使用 AI 看相'); }
    if (!photo) return setNotice('请先上传清晰的人像照片');
    setStatus('running'); setNotice('视觉模型正在进行传统文化娱乐解读…');
    try {
      const response = await fetch(apiUrl('/api/face-reading'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(authToken) },
        body: JSON.stringify({ image: photo.src, focus }),
      });
      const body = await readApiResponse(response);
      setResult(parseJsonModelContent(body.content)); setStatus('done'); setNotice('解读完成');
    } catch (error) { setStatus('error'); setNotice(error.message); }
  }

  return <main className="workspace tool-workspace face-workspace">
    <section className="control-panel">
      <div className="panel-section"><h2>人像照片</h2><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} />
        <div className="face-upload" onClick={() => inputRef.current?.click()}>{photo ? <><img src={photo.src} alt="待解读人像" /><button onClick={(event) => { event.stopPropagation(); setPhoto(null); setResult(null); }} aria-label="移除照片"><X size={14} /></button></> : <><UserRound size={36} /><strong>上传正面人像</strong><span>PNG / JPG / WEBP · 10MB 以内</span></>}</div>
      </div>
      <div className="panel-section"><h2>解读侧重</h2><div className="face-focus">{['综合解读','精神气质','五官意象','近期状态'].map((item) => <button key={item} className={focus === item ? 'selected' : ''} onClick={() => setFocus(item)}>{item}</button>)}</div></div>
      <div className="face-disclaimer">传统文化娱乐体验，不构成性格、健康、命运或专业判断。</div>
      <div className="generate-wrap"><button className="generate" disabled={status === 'running' || !photo} onClick={analyzeFace}>{status === 'running' ? <LoaderCircle className="spin" /> : <Sparkles />}{status === 'running' ? '解读中…' : '开始娱乐解读'}</button><p>视觉模型 · 仅描述可见特征 · 不作事实判断</p></div>
    </section>
    <section className="preview-panel face-preview"><div className="preview-heading"><div className="eyebrow"><Sparkles size={15} />传统文化娱乐解读</div><h1>AI 看相</h1><p>从面部可见特征出发，体验传统文化中的象征性表达。</p></div>
      {result ? <div className="face-result"><div className="face-result-summary"><img src={photo.src} alt="人像缩略图" /><div><span>{focus}</span><h2>{result.summary}</h2></div></div><div className="face-observations">{(result.observations || []).map((item, index) => <article key={`${item.label}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.label}</h3><p>{item.text}</p></article>)}</div>{result.suggestions?.length > 0 && <div className="face-suggestions"><strong>生活建议</strong>{result.suggestions.map((item) => <span key={item}>{item}</span>)}</div>}<p className="face-closing">{result.closing}</p></div> : <ModuleShowcase image="/assets/scene-commute.webp" icon={UserRound} kicker="Portrait insight" title="从一张清晰人像开始" detail="以克制、友好的方式呈现可见特征与传统文化意象。" align="right" />}
    </section>
  </main>;
}

const pptThemes = {
  '商务简洁': { bg: 'F4F6F8', panel: 'FFFFFF', accent: '2764D8', text: '1F2937', muted: '667085' },
  '科技深色': { bg: '111827', panel: '192231', accent: '43B7E8', text: 'F8FAFC', muted: 'A9B4C5' },
  '极简黑白': { bg: 'FFFFFF', panel: 'F3F3F3', accent: '111111', text: '191919', muted: '6B6B6B' },
  '品牌红色': { bg: 'F7F7F5', panel: 'FFFFFF', accent: 'D9363E', text: '282A2F', muted: '737781' },
};

async function downloadPptx(deck, style) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const theme = pptThemes[style] || pptThemes['商务简洁'];
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Kylin Glory Design'; pptx.subject = deck.title; pptx.title = deck.title; pptx.company = 'Kylin Glory Design';
  (deck.slides || []).forEach((item, index) => {
    const slide = pptx.addSlide(); slide.background = { color: theme.bg };
    if (index === 0) {
      slide.addText(deck.title || item.title, { x: 0.9, y: 1.7, w: 11.4, h: 1.0, fontFace: 'Aptos Display', fontSize: 32, bold: true, color: theme.text, margin: 0, breakLine: false });
      slide.addText(deck.subtitle || (item.points || []).join(' · '), { x: 0.92, y: 2.9, w: 9.8, h: 0.7, fontFace: 'Aptos', fontSize: 17, color: theme.muted, margin: 0 });
      slide.addText('Kylin Glory Design', { x: 0.92, y: 6.65, w: 3.0, h: 0.3, fontFace: 'Aptos', fontSize: 9, color: theme.accent, margin: 0 });
    } else {
      slide.addText(item.title || `第 ${index + 1} 页`, { x: 0.75, y: 0.58, w: 11.8, h: 0.65, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: theme.text, margin: 0 });
      slide.addText((item.points || []).map((point) => `• ${point}`).join('\n'), { x: 0.85, y: 1.62, w: 7.1, h: 4.8, fontFace: 'Aptos', fontSize: 18, color: theme.text, breakLine: false, valign: 'mid', margin: 0.08, paraSpaceAfterPt: 13, breakLineOnOverflow: false, fit: 'shrink' });
      slide.addText(item.visual || '视觉素材建议', { x: 8.45, y: 1.62, w: 4.0, h: 4.3, fontFace: 'Aptos', fontSize: 15, color: theme.muted, align: 'center', valign: 'mid', margin: 0.25, fill: { color: theme.panel }, line: { color: theme.accent, transparency: 55 }, radius: 0.08 });
      slide.addText(String(index + 1).padStart(2, '0'), { x: 11.8, y: 6.75, w: 0.55, h: 0.25, fontFace: 'Aptos', fontSize: 9, color: theme.muted, align: 'right', margin: 0 });
    }
    if (item.speakerNotes) slide.addNotes(item.speakerNotes);
  });
  const filename = `${String(deck.title || 'AI-Presentation').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.pptx`;
  await pptx.writeFile({ fileName: filename, compression: true });
}

function AiPpt({ configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const [topic, setTopic] = useState(''); const [audience, setAudience] = useState('公司客户');
  const [objective, setObjective] = useState('清晰介绍主题'); const [style, setStyle] = useState('商务简洁');
  const [language, setLanguage] = useState('简体中文'); const [slideCount, setSlideCount] = useState(8);
  const [notes, setNotes] = useState(''); const [model, setModel] = useState('gpt-5.5');
  const [deck, setDeck] = useState(null); const [selectedSlide, setSelectedSlide] = useState(0);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const saved = localStorage.getItem('xiaojishuo-ppt-draft'); if (!saved) return;
    try { const data = JSON.parse(saved); setTopic(data.topic || ''); setAudience(data.audience || '公司客户'); setObjective(data.objective || '清晰介绍主题'); setStyle(data.style || '商务简洁'); setLanguage(data.language || '简体中文'); setSlideCount(data.slideCount || 8); setNotes(data.notes || ''); setModel(data.model || 'gpt-5.5'); if (data.deck) setDeck(data.deck); } catch { /* ignore */ }
  }, []);
  useEffect(() => { localStorage.setItem('xiaojishuo-ppt-draft', JSON.stringify({ topic, audience, objective, style, language, slideCount, notes, model, deck })); }, [topic, audience, objective, style, language, slideCount, notes, model, deck]);

  async function generateDeck() {
    if (!configured) return setNotice('AI PPT 模型尚未配置');
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再使用 AI PPT'); }
    if (!topic.trim()) return setNotice('请填写演示主题');
    setStatus('running'); setNotice('AI 正在策划演示结构与逐页内容…');
    try {
      const response = await fetch(apiUrl('/api/ppt/generate'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(authToken) }, body: JSON.stringify({ topic, audience, objective, style, language, slideCount, notes, model }) });
      const body = await readApiResponse(response); const parsed = parseJsonModelContent(body.content);
      if (!Array.isArray(parsed.slides) || !parsed.slides.length) throw new Error('模型没有返回有效幻灯片');
      setDeck(parsed); setSelectedSlide(0); setStatus('done'); setNotice(`已生成 ${parsed.slides.length} 页 PPT`);
    } catch (error) { setStatus('error'); setNotice(error.message); }
  }

  function updateSlide(patch) { setDeck((current) => ({ ...current, slides: current.slides.map((slide, index) => index === selectedSlide ? { ...slide, ...patch } : slide) })); }
  const slide = deck?.slides?.[selectedSlide]; const theme = pptThemes[style] || pptThemes['商务简洁'];
  return <main className="workspace tool-workspace ppt-workspace">
    <section className="control-panel">
      <div className="panel-section brief-section"><h2>演示主题</h2><textarea className="ppt-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：Kylin Glory 2027 品牌升级提案" /></div>
      <div className="panel-section"><h2>生成设置</h2><div className="ppt-settings"><select value={audience} onChange={(event) => setAudience(event.target.value)}>{['公司客户','管理层','销售团队','投资人','普通公众','培训学员'].map((item) => <option key={item}>{item}</option>)}</select><select value={objective} onChange={(event) => setObjective(event.target.value)}>{['清晰介绍主题','销售提案','项目汇报','培训教学','融资路演','年度总结'].map((item) => <option key={item}>{item}</option>)}</select><select value={style} onChange={(event) => setStyle(event.target.value)}>{Object.keys(pptThemes).map((item) => <option key={item}>{item}</option>)}</select><select value={language} onChange={(event) => setLanguage(event.target.value)}>{['简体中文','英文','日文','韩文'].map((item) => <option key={item}>{item}</option>)}</select><select value={model} onChange={(event) => setModel(event.target.value)}><option value="gpt-5.5">GPT-5.5</option><option value="gpt-5.6-sol">GPT-5.6 Sol</option></select><label className="ppt-count"><span>页数</span><input type="number" min="4" max="20" value={slideCount} onChange={(event) => setSlideCount(event.target.value)} /></label></div></div>
      <div className="panel-section brief-section"><h2>补充资料（可选）</h2><textarea className="ppt-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="粘贴数据、产品信息、已有大纲或必须包含的观点…" /></div>
      <div className="generate-wrap"><button className="generate" disabled={status === 'running' || !topic.trim()} onClick={generateDeck}>{status === 'running' ? <LoaderCircle className="spin" /> : <Presentation />}{status === 'running' ? '正在生成…' : '生成演示文稿'}</button>{deck && <button className="ppt-download" onClick={async () => { try { setNotice('正在导出 PowerPoint…'); await downloadPptx(deck, style); setNotice('PPTX 已下载'); } catch (error) { setNotice(`导出失败：${error.message}`); } }}><Download size={16} />下载 .pptx</button>}</div>
    </section>
    <section className="ppt-preview" style={{ '--ppt-bg': `#${theme.bg}`, '--ppt-panel': `#${theme.panel}`, '--ppt-accent': `#${theme.accent}`, '--ppt-text': `#${theme.text}`, '--ppt-muted': `#${theme.muted}` }}>
      {deck ? <><div className="ppt-thumbnails">{deck.slides.map((item, index) => <button key={`${item.title}-${index}`} className={selectedSlide === index ? 'selected' : ''} onClick={() => setSelectedSlide(index)}><span>{index + 1}</span><div><strong>{index === 0 ? deck.title : item.title}</strong>{index > 0 && <small>{(item.points || []).slice(0, 2).join(' / ')}</small>}</div></button>)}</div><div className="ppt-canvas-wrap"><div className="ppt-canvas">{selectedSlide === 0 ? <div className="ppt-cover"><input value={deck.title || ''} onChange={(event) => setDeck({ ...deck, title: event.target.value })} /><textarea value={deck.subtitle || ''} onChange={(event) => setDeck({ ...deck, subtitle: event.target.value })} /><span>Kylin Glory Design</span></div> : <div className="ppt-content-slide"><input value={slide?.title || ''} onChange={(event) => updateSlide({ title: event.target.value })} /><div className="ppt-slide-body"><textarea value={(slide?.points || []).join('\n')} onChange={(event) => updateSlide({ points: event.target.value.split('\n').filter(Boolean) })} /><textarea className="ppt-visual" value={slide?.visual || ''} onChange={(event) => updateSlide({ visual: event.target.value })} /></div><span>{String(selectedSlide + 1).padStart(2, '0')}</span></div>}</div>{slide && <div className="ppt-speaker-notes"><strong>演讲备注</strong><textarea value={slide.speakerNotes || ''} onChange={(event) => updateSlide({ speakerNotes: event.target.value })} /></div>}</div></> : <ModuleShowcase image="/assets/scene-business.webp" icon={Presentation} kicker="Presentation studio" title="把复杂内容讲清楚" detail="从主题到完整结构，一次生成可编辑、可交付的演示文稿。" />}
    </section>
  </main>;
}

function AccountCenter({ authUser, authRequired, configured }) {
  const services = [
    ['图片生成', configured.image], ['视频生成', configured.video], ['商品解析', configured.parse],
    ['数字人', configured.human], ['发布编辑器', configured.editor], ['AI 看相', configured.face], ['AI PPT', configured.ppt],
  ];
  return <main className="simple-page"><div className="simple-page-inner"><div className="account-header"><div className="account-avatar"><UserRound size={34} /></div><div><span>个人中心</span><h1>{authUser || (authRequired ? '管理员账号' : '本地开发账号')}</h1><p>{authRequired ? '账号已受登录保护' : '本地开发模式，正式部署后启用登录保护'}</p></div></div>
    <section className="account-band"><div><ShieldCheck size={20} /><span>账号安全</span><strong>{authRequired ? '登录验证已开启' : '开发模式'}</strong></div><div><Cloud size={20} /><span>后端状态</span><strong>{services.every(([, ready]) => ready) ? '全部已连接' : '部分未连接'}</strong></div><div><FolderOpen size={20} /><span>本地草稿</span><strong>{draftCount()} 个</strong></div></section>
    <section className="service-section"><div className="simple-title"><h2>功能连接</h2><span>{services.filter(([, ready]) => ready).length}/{services.length} 可用</span></div><div className="service-list">{services.map(([name, ready]) => <div key={name}><span className={ready ? 'service-dot ready' : 'service-dot'} /><strong>{name}</strong><small>{ready ? '接口已连接' : '等待配置'}</small></div>)}</div></section>
    <section className="account-info"><h2>数据说明</h2><p>草稿和编辑内容保存在当前浏览器；API 密钥保存在后端环境变量，不会发送到网页前端。</p></section>
  </div></main>;
}

function CreditsPage() {
  const categories = [
    ['图片生成', 'GPT Image 2 / Nano Banana 2', '按张计费'], ['视频生成', 'Veo / Omni / Sora', '按次计费'],
    ['智能内容', 'GPT-5.5 / GPT-5.6 Sol', '按 Token 计费'], ['专业工具', '商品解析 / 数字人', '按次计费'],
  ];
  return <main className="simple-page credits-page"><div className="simple-page-inner"><div className="credits-heading"><span>模型用量</span><h1>购买点数</h1><p>点数余额、充值记录和发票信息由模型接口平台统一管理。</p><a href="https://xjjuhe.site/console/topup" target="_blank" rel="noreferrer"><CreditCard size={17} />前往模型平台充值<ExternalLink size={14} /></a></div>
    <section className="credit-categories"><div className="simple-title"><h2>计费类型</h2><span>实际价格以模型平台为准</span></div><div>{categories.map(([name, models, billing]) => <article key={name}><div><strong>{name}</strong><span>{models}</span></div><small>{billing}</small></article>)}</div></section>
    <section className="credit-note"><ShieldCheck size={20} /><div><strong>支付在模型平台完成</strong><p>本网站不会收集银行卡或支付密码，也不会在未确认时创建充值订单。</p></div></section>
  </div></main>;
}

function DraftsPage({ setNotice }) {
  const loadDrafts = () => draftDefinitions.flatMap(([key, name, route]) => {
    const raw = localStorage.getItem(key); if (!raw) return [];
    try {
      const data = JSON.parse(raw); const preview = data.topic || data.title || data.brief || data.text || data.prompt || data.source || data.avatarUrl || '已保存设置与内容';
      return [{ key, name, route, preview: String(preview).replace(/\s+/g, ' ').slice(0, 90) }];
    } catch { return [{ key, name, route, preview: '已保存草稿' }]; }
  });
  const [drafts, setDrafts] = useState(loadDrafts);
  function removeDraft(key) { localStorage.removeItem(key); setDrafts(loadDrafts()); setNotice('草稿已删除'); }
  return <main className="simple-page drafts-page"><div className="simple-page-inner"><div className="drafts-heading"><span>自动保存</span><h1>草稿箱</h1><p>继续编辑各创作模块在当前浏览器保存的内容。</p></div>
    {drafts.length ? <div className="draft-list">{drafts.map((draft) => <article key={draft.key}><div className="draft-icon"><FileText size={21} /></div><div><strong>{draft.name}</strong><p>{draft.preview}</p></div><button className="draft-open" onClick={() => { location.hash = `/${draft.route}`; }}>继续编辑</button><button className="draft-delete" onClick={() => removeDraft(draft.key)} title="删除草稿" aria-label={`删除${draft.name}草稿`}><Trash2 size={16} /></button></article>)}</div> : <div className="draft-empty"><FolderOpen size={45} /><strong>暂无草稿</strong><span>开始使用任一创作模块后，内容会自动保存在这里</span></div>}
  </div></main>;
}

function ToolWorkspace({ tool, configured, authRequired, authToken, onLoginRequired, setNotice }) {
  const isBase = tool === '商品底图'; const isOverseas = tool === '海外电商'; const isPoster = tool === '设计海报';
  const maxImages = isBase ? 1 : 3;
  const inputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [ratio, setRatio] = useState(isPoster ? '9:16' : '1:1');
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(isBase ? ['专业棚拍'] : isOverseas ? overseasModules.map(([name]) => name) : []);
  const [platform, setPlatform] = useState('亚马逊'); const [market, setMarket] = useState('美国');
  const [status, setStatus] = useState('idle'); const [progress, setProgress] = useState(0); const [outputs, setOutputs] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(`xiaojishuo-${routeMap[tool]}-draft`);
    if (saved) try { const data = JSON.parse(saved); setText(data.text || ''); setRatio(data.ratio || (isPoster ? '9:16' : '1:1')); setSelected(data.selected || selected); setPlatform(data.platform || '亚马逊'); setMarket(data.market || '美国'); } catch { /* ignore */ }
  }, [tool]);
  useEffect(() => { localStorage.setItem(`xiaojishuo-${routeMap[tool]}-draft`, JSON.stringify({ text, ratio, selected, platform, market })); }, [tool, text, ratio, selected, platform, market]);

  async function addFiles(fileList) {
    const valid = [...fileList].filter((file) => /image\/(png|jpeg|webp)/.test(file.type)).slice(0, maxImages - images.length);
    if (!valid.length) return setNotice(`仅支持 PNG、JPG、WEBP，最多 ${maxImages} 张`);
    const loaded = await Promise.all(valid.map(toDataUrl)); setImages((current) => [...current, ...loaded].slice(0, maxImages));
  }

  async function run() {
    if (!configured) return setNotice(apiUnavailableMessage);
    if (authRequired && !authToken) { onLoginRequired(); return setNotice('请先登录后再使用生图功能'); }
    if (!isPoster && !images.length) return setNotice('请先上传产品图');
    if (isPoster && !text.trim()) return setNotice('请先输入海报 Prompt 或选择模板');
    if (!isPoster && !selected.length) return setNotice('请至少选择一个生成场景或模块');
    const prompt = isBase
      ? `保持参考图商品主体、颜色、比例、品牌标识完全准确，为商品生成专业电商场景底图。场景：${selected.join('、')}。额外要求：${text || '干净高级、真实光影、商业摄影、不要改变产品'}。画面比例 ${ratio}。`
      : isOverseas
        ? `为${market}${platform}平台生成合规的跨境电商 Listing 产品图片。产品信息：${text || '请根据参考图识别商品'}。需要：${selected.join('、')}。保持商品准确，英文文字简洁清晰，专业商业摄影，符合平台规范。`
        : `${text}\n输出一张完整可用的${ratio}海报，中文文字清晰准确，专业平面设计，层级鲜明，边距安全。`;
    setStatus('running'); setProgress(5); setOutputs([]); setNotice('任务已提交，正在生成…');
    try {
      const count = isPoster ? 1 : Math.min(4, selected.length);
      const urls = await submitAndPoll({ prompt, images, aspectRatio: ratio, count, authToken, onProgress: setProgress });
      setOutputs(urls); setProgress(100); setStatus('done'); setNotice(`已生成 ${urls.length} 张图片`);
    } catch (error) { setStatus('error'); setProgress(0); setNotice(error.message); }
  }

  const optionList = isBase ? baseScenes : overseasModules;
  return <main className={`workspace tool-workspace ${isPoster ? 'poster-workspace' : ''}`}>
    <section className="control-panel">
      {!isPoster && <div className="panel-section upload-section"><h2>{isBase ? '产品图（白底最佳）' : '商品原图'}</h2>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple={!isBase} onChange={(event) => addFiles(event.target.files)} />
        <UploadArea images={images} max={maxImages} onOpen={() => inputRef.current?.click()} onDrop={addFiles} onRemove={(index) => setImages((current) => current.filter((_, i) => i !== index))} hint={isBase ? '建议白底 / 透明底图，仅 1 张' : '最多 3 张，建议白底'} />
      </div>}

      {isOverseas && <div className="panel-section"><h2>平台 & 市场</h2><div className="tool-selects">
        <select value={platform} onChange={(event) => setPlatform(event.target.value)}>{['亚马逊','Shopify','eBay','TikTok Shop','Temu','SHEIN'].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={market} onChange={(event) => setMarket(event.target.value)}>{['美国','欧洲','日本','东南亚','中东','拉美'].map((item) => <option key={item}>{item}</option>)}</select>
      </div></div>}

      {(isBase || isPoster) && <div className="panel-section"><h2>输出尺寸</h2><div className="ratio-options">{[['1:1','正方形'],['9:16','竖版'],['16:9','横版']].map(([value, label]) => <button key={value} className={ratio === value ? 'selected' : ''} onClick={() => setRatio(value)}><strong>{label}</strong><span>{value}</span></button>)}</div></div>}

      <div className="panel-section brief-section"><div className="section-title-row"><h2>{isPoster ? '海报 Prompt' : isOverseas ? '产品信息（英文优先）' : '额外要求（可选）'}</h2>{isPoster && <span className="field-tip">AI 会自行排版</span>}</div>
        <textarea className={isPoster ? 'poster-prompt' : ''} value={text} onChange={(event) => setText(event.target.value)} placeholder={isPoster ? '描述海报主题、标题、文案、风格、配色和版式…' : isOverseas ? 'Product: Wireless Bluetooth Speaker\nMaterial: Aluminum + silicone\nBattery: 12h playtime\nFor: outdoor / camping' : '例如：\n· 暖色调\n· 桌面有一杯咖啡\n· 不要有人物\n· 强调高级感'} />
      </div>

      {!isPoster && <div className="panel-section modules-section"><h2>{isBase ? '场景预设（多选）' : '包含模块（多选）'}</h2><div className="module-grid compact-modules">{optionList.map(([name, desc]) => {
        const checked = selected.includes(name); return <button key={name} className={checked ? 'selected' : ''} onClick={() => setSelected((current) => checked ? current.filter((item) => item !== name) : [...current, name])}>{checked && <Check size={13} />}<strong>{name}</strong><span>{desc}</span></button>;
      })}</div></div>}

      <div className="generate-wrap"><button className="generate" disabled={status === 'running' || (!isPoster && !images.length) || (isPoster && !text.trim())} onClick={run}>{status === 'running' ? <LoaderCircle className="spin" /> : <Sparkles />} {status === 'running' ? `生成中 ${progress}%` : isPoster ? '生成海报' : images.length ? `生成${isBase ? '场景底图' : '海外图集'}` : '请上传产品图'}</button><p>{isBase ? '1 张产品图 · N 种场景 · 秒出可商用' : isOverseas ? `${platform} · ${market} · 一键合规` : '一句 Prompt · 自动排版 · 高清出图'}</p></div>
    </section>

    <section className="preview-panel tool-preview">
      {outputs.length ? <><ToolHeading tool={tool} platform={platform} market={market} /><GeneratedGrid outputs={outputs} /></> : isBase ? <BasePreview /> : isOverseas ? <OverseasPreview platform={platform} market={market} /> : <PosterTemplates onUse={(template) => { setText(template); setNotice('模板已填入 Prompt，可继续修改'); }} />}
    </section>
  </main>;
}

function UploadArea({ images, max, onOpen, onDrop, onRemove, hint }) {
  return <div className="dropzone tool-dropzone" onClick={onOpen} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(event.dataTransfer.files); }}>{images.length ? <div className="thumbs">{images.map((item, index) => <div className="thumb" key={item.name + index}><img src={item.src} alt={item.name} /><button onClick={(event) => { event.stopPropagation(); onRemove(index); }} aria-label="移除图片"><X size={13} /></button></div>)}{images.length < max && <div className="add-thumb"><Plus /></div>}</div> : <><button className="upload-button"><Upload size={17} />上传图片</button><span>{hint}</span></>}</div>;
}

function ToolHeading({ tool, platform, market }) {
  return <div className="preview-heading"><div className="eyebrow"><Sparkles size={15} />AI 生成 · 高清商用</div><h1>{tool}</h1><p>{tool === '海外电商' ? `为 ${platform} · ${market} 市场生成符合 Listing 规范的产品图集。` : '生成结果已完成，可打开原图下载。'}</p></div>;
}

function ModuleShowcase({ image, icon: Icon, kicker, title, detail, align = 'left', children }) {
  return <div className={`module-showcase align-${align}`}>
    <img src={asset(image)} alt={`${title} 产品视觉示例`} />
    <div className="module-showcase-shade" />
    <div className="module-showcase-copy"><span><Icon size={14} />{kicker}</span><strong>{title}</strong><p>{detail}</p>{children}</div>
  </div>;
}

function GeneratedGrid({ outputs }) { return <div className="generated-grid">{outputs.map((url, index) => <article key={url}><img src={url} alt={`AI 生成图片 ${index + 1}`} /><a href={url} target="_blank" rel="noreferrer">查看原图</a></article>)}</div>; }

function BasePreview() {
  return <div className="base-showcase">
    <div className="base-showcase-heading"><span>1 张产品图 · N 种场景 · 秒出可商用</span><h1>商品底图</h1><p>一张产品图 — 多种场景化底图，一键定调、一键导出。</p></div>
    <div className="base-preview-grid base-preview-grid-double">{[['/assets/base-zen.webp','原木禅意'],['/assets/base-cafe.webp','咖啡时光'],['/assets/base-gift.webp','礼盒派对'],['/assets/base-night.webp','都市夜色']].map(([src,name]) => <div key={name}><img src={asset(src)} alt={`AI 生成的 ${name} 场景示例`} /><span>{name}</span></div>)}</div>
    <p className="demo-note">↑ 示意场景 · 本页支持 100+ 快捷场景，也可自定义 Prompt</p>
  </div>;
}

function OverseasPreview({ platform, market }) {
  return <><ToolHeading tool="海外电商" platform={platform} market={market} /><div className="market-preview"><div className="market-thumbs">{['detail','lifestyle','spec','package'].map((name, index) => <img key={name} src={asset(`/assets/${['scene-commute.webp','scene-sport.webp','scene-business.webp','detail-hero.webp'][index]}`)} alt={`${name} 副图`} />)}</div><div className="market-card"><img src={asset('/assets/detail-hero.webp')} alt="AI 生成的海外电商主图示例" /><div className="market-copy"><b>Wireless ANC Headphones, 40h Battery, BT 5.3</b><span className="stars">★★★★★ <i>(2,841)</i></span><strong>$49.99</strong><small>Free shipping · Ships in 24h</small></div></div></div><p className="demo-note">↑ 主图 / 副图 / 信息图 / A+ 例证均可生成</p></>;
}

function PosterTemplates({ onUse }) {
  const images = ['/assets/detail-hero.webp', '/assets/scene-commute.webp', '/assets/scene-sport.webp', '/assets/scene-business.webp'];
  return <div className="poster-library"><div className="poster-title"><span>模板起点</span><h1>从一个好版式开始</h1><p>点击任意模板自动填入左侧 Prompt，改几处内容即可生成。</p></div><div className="template-grid">{posterTemplates.map(([name, desc, prompt], index) => <button key={name} className={`template-card template-${index % 6}`} onClick={() => onUse(prompt)}><img src={asset(images[index % images.length])} alt="" /><span>使用此模板</span><div><strong>{name}</strong><small>{desc}</small></div></button>)}</div></div>;
}

function ProductPreview() {
  return <div className="product-preview">
    <div className="hero-image"><img src={asset('/assets/detail-hero.webp')} alt="AI 生成的产品主图示例" /><span className="seller">BEST SELLER</span><span className="rating">★★★★★ <b>4.9 / 1,283</b></span></div>
    <div className="feature-row"><div><Zap /><b>主动降噪</b></div><div><Box /><b>40h 续航</b></div><div><Bluetooth /><b>蓝牙 5.3</b></div></div>
    <div className="spec-row"><span>Hi-Fi 立体声</span><span>快充 10min = 6h</span><span>多端无缝连接</span></div>
    <div className="scenes"><Scene src={asset('/assets/scene-commute.webp')} name="通勤" /><Scene src={asset('/assets/scene-sport.webp')} name="运动" /><Scene src={asset('/assets/scene-business.webp')} name="商务" /></div>
    <div className="assurances"><span>正品保障</span><span>7 天无理由退换</span><span>顺丰包邮</span></div>
    <p className="demo-note">↑ 示意效果 · 真实生成由 AI 完成，可一键导出</p>
  </div>;
}

function Scene({ src, name }) { return <div><img src={src} alt={`AI 生成的 ${name} 场景示例`} /><b>{name}</b></div>; }

createRoot(document.getElementById('root')).render(<App />);
