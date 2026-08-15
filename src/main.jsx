import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, BarChart3, Bluetooth, Box, Check, ChevronDown, Cloud, Copy,
  FileImage, FileText, FolderOpen, Globe2, Image, ImagePlus, Images, Link2,
  LoaderCircle, LogIn, Megaphone, Menu, MonitorPlay, MoreHorizontal, Package,
  Plus, Presentation, RotateCcw, Search, Sparkles, Upload, UserRound, WandSparkles,
  X, Zap,
} from 'lucide-react';
import './styles.css';

const navGroups = [
  { label: '创作工作台', items: [
    [Image, '商品底图'], [FileText, '商品详情页'], [Globe2, '海外电商'],
    [Megaphone, '设计海报', 'NEW'], [BarChart3, '爆款IP分析', 'NEW'],
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

const routeMap = { 商品底图: 'base', 商品详情页: 'detail', 海外电商: 'overseas', 设计海报: 'poster' };
const routeNames = Object.fromEntries(Object.entries(routeMap).map(([name, route]) => [route, name]));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((d) => setConfigured(d.configured)).catch(() => {});
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
    if (!images.length) return setNotice('请先上传至少一张商品原图');
    if (!brief.trim()) return setNotice('请填写商品卖点与生成要求');
    if (!selectedModules.length) return setNotice('请至少选择一个页面模块');
    setStatus('submitting'); setNotice('正在提交生成任务…'); setProgress(8);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImages: images.map((image) => image.src), aspectRatio: '4:5', n: Math.min(4, selectedModules.length) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || '提交失败');
      const tasks = (body.data || [body]).map((item) => item.task_id || item.id).filter(Boolean);
      if (!tasks.length && body.data?.some((item) => item.url)) {
        setGenerated(body.data.map((item) => item.url)); setProgress(100); setStatus('done'); return;
      }
      setStatus('polling'); setNotice(`已创建 ${tasks.length} 个任务，正在生成…`);
      const urls = [];
      for (let attempt = 0; attempt < 80 && urls.length < tasks.length; attempt += 1) {
        await sleep(3000);
        const results = await Promise.all(tasks.map((id) => fetch(`/api/tasks/${encodeURIComponent(id)}`).then((r) => r.json())));
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

  function smartWrite() {
    setBrief('产品名称：无线主动降噪耳机\n核心卖点：Hi-Fi 立体声、40 小时续航、蓝牙 5.3、10 分钟快充可用 6 小时\n适用人群：通勤、运动与商务人士\n设计要求：突出高级质感与佩戴舒适度');
    setNotice('已生成一版商品卖点，可继续修改');
  }

  function openTool(name) {
    if (routeMap[name]) {
      setActiveTool(name); location.hash = `/${routeMap[name]}`; setMobileNav(false); setNotice('');
    } else setNotice(`${name} 功能入口已保留`);
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={20} /></button>
      <img className="logo" src="/assets/logo.png" alt="小鸡说Ai" />
      <button className="new-task"><Plus size={17} /> 新建任务</button>
      <span className="task-name">当前：{activeTool.replace('商品', '')} #1 · {new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '-')} 15:05</span>
      <span className={`api-state ${configured ? 'ready' : ''}`}>{configured ? '接口已连接' : '待配置密钥'}</span>
      <button className="login"><LogIn size={15} /> 登录 / 注册</button>
    </header>

    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X /></button>
      {navGroups.map((group) => <div className="nav-group" key={group.label}>
        <div className="nav-label">{group.label}</div>
        {group.items.map(([Icon, name, badge]) => <button key={name} className={`nav-item ${name === activeTool ? 'active' : ''}`} onClick={() => openTool(name)}>
          <Icon size={19} /><span>{name}</span>{badge && <small className={badge === 'BETA' ? 'beta' : ''}>{badge}</small>}
        </button>)}
      </div>)}
      <button className="nav-item drafts"><FolderOpen size={19} /><span>草稿箱</span><b>1</b></button>
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
    </main> : <ToolWorkspace tool={activeTool} setNotice={setNotice} />}

    {notice && <div className={`toast ${status === 'error' ? 'error' : ''}`}><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示"><X size={15} /></button></div>}
    {linkOpen && <div className="modal-backdrop" onClick={() => setLinkOpen(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-title"><h3>链接导入</h3><button className="icon-button" onClick={() => setLinkOpen(false)}><X /></button></div>
      <p>粘贴公开可访问的商品图片地址</p><input autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://example.com/product.jpg" />
      <button className="primary" onClick={() => { if (linkValue) setImages((prev) => [...prev, { name: '链接图片', src: linkValue }].slice(0, 3)); setLinkOpen(false); setLinkValue(''); }}>导入图片</button>
    </div></div>}
  </div>;
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

async function submitAndPoll({ prompt, images, aspectRatio, count, onProgress }) {
  const response = await fetch('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, referenceImages: images.map((image) => image.src), aspectRatio, n: count }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || '提交失败');
  if (body.data?.some((item) => item.url)) return body.data.map((item) => item.url).filter(Boolean);
  const tasks = (body.data || [body]).map((item) => item.task_id || item.id).filter(Boolean);
  if (!tasks.length) throw new Error('接口未返回任务 ID');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(3000);
    const results = await Promise.all(tasks.map(async (id) => {
      const result = await fetch(`/api/tasks/${encodeURIComponent(id)}`); const data = await result.json();
      if (!result.ok) throw new Error(data?.error?.message || '任务查询失败'); return data;
    }));
    onProgress(Math.round(results.reduce((sum, item) => sum + (item.progress || (item.status === 'completed' ? 100 : 10)), 0) / results.length));
    const failed = results.find((item) => item.status === 'failed' || item.error);
    if (failed) throw new Error(failed.error?.message || failed.message || '图片生成失败');
    const urls = results.map((item) => item.url || item.image_url || item.data?.[0]?.url).filter(Boolean);
    if (urls.length === tasks.length) return urls;
  }
  throw new Error('生成时间较长，请稍后重试');
}

function ToolWorkspace({ tool, setNotice }) {
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
      const urls = await submitAndPoll({ prompt, images, aspectRatio: ratio, count, onProgress: setProgress });
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

function GeneratedGrid({ outputs }) { return <div className="generated-grid">{outputs.map((url, index) => <article key={url}><img src={url} alt={`AI 生成图片 ${index + 1}`} /><a href={url} target="_blank" rel="noreferrer">查看原图</a></article>)}</div>; }

function BasePreview() {
  return <><ToolHeading tool="商品底图" /><div className="base-preview-grid">{[['/assets/scene-commute.webp','原木禅意'],['/assets/scene-sport.webp','咖啡时光'],['/assets/scene-business.webp','礼盒派对'],['/assets/detail-hero.webp','都市夜色']].map(([src,name]) => <div key={name}><img src={src} alt={`AI 生成的 ${name} 场景示例`} /><span>{name}</span></div>)}</div><p className="demo-note">↑ 示意场景 · 支持快捷场景，也可自定义 Prompt</p></>;
}

function OverseasPreview({ platform, market }) {
  return <><ToolHeading tool="海外电商" platform={platform} market={market} /><div className="market-preview"><div className="market-thumbs">{['detail','lifestyle','spec','package'].map((name, index) => <img key={name} src={`/assets/${['scene-commute.webp','scene-sport.webp','scene-business.webp','detail-hero.webp'][index]}`} alt={`${name} 副图`} />)}</div><div className="market-card"><img src="/assets/detail-hero.webp" alt="AI 生成的海外电商主图示例" /><div className="market-copy"><b>Wireless ANC Headphones, 40h Battery, BT 5.3</b><span className="stars">★★★★★ <i>(2,841)</i></span><strong>$49.99</strong><small>Free shipping · Ships in 24h</small></div></div></div><p className="demo-note">↑ 主图 / 副图 / 信息图 / A+ 例证均可生成</p></>;
}

function PosterTemplates({ onUse }) {
  return <div className="poster-library"><div className="poster-title"><span>模板起点</span><h1>从一个好版式开始</h1><p>点击任意模板自动填入左侧 Prompt，改几处内容即可生成。</p></div><div className="template-grid">{posterTemplates.map(([name, desc, prompt], index) => <button key={name} className={`template-card template-${index % 6}`} onClick={() => onUse(prompt)}><span>使用此模板</span><div><strong>{name}</strong><small>{desc}</small></div></button>)}</div></div>;
}

function ProductPreview() {
  return <div className="product-preview">
    <div className="hero-image"><img src="/assets/detail-hero.webp" alt="AI 生成的产品主图示例" /><span className="seller">BEST SELLER</span><span className="rating">★★★★★ <b>4.9 / 1,283</b></span></div>
    <div className="feature-row"><div><Zap /><b>主动降噪</b></div><div><Box /><b>40h 续航</b></div><div><Bluetooth /><b>蓝牙 5.3</b></div></div>
    <div className="spec-row"><span>Hi-Fi 立体声</span><span>快充 10min = 6h</span><span>多端无缝连接</span></div>
    <div className="scenes"><Scene src="/assets/scene-commute.webp" name="通勤" /><Scene src="/assets/scene-sport.webp" name="运动" /><Scene src="/assets/scene-business.webp" name="商务" /></div>
    <div className="assurances"><span>正品保障</span><span>7 天无理由退换</span><span>顺丰包邮</span></div>
    <p className="demo-note">↑ 示意效果 · 真实生成由 AI 完成，可一键导出</p>
  </div>;
}

function Scene({ src, name }) { return <div><img src={src} alt={`AI 生成的 ${name} 场景示例`} /><b>{name}</b></div>; }

createRoot(document.getElementById('root')).render(<App />);
