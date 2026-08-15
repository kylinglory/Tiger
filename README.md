# 小鸡说 AI 电商详情页工作台

参考 `tu.xiaojiaidao.com` 实现的 React + Vite 电商 AI 工作台，并已接入小鸡聚合 AI 的 `gpt-image-2` 异步生图接口。

## 启动

```bash
cp .env.example .env
# 在 .env 填入 XIAOJI_API_KEY
npm install
npm run dev
```

打开 `http://localhost:5173/`。前端通过本地服务端代理调用接口，API Key 不会进入浏览器代码。

## GitHub Pages

公开静态访问地址：`https://kylinglory.com/`

备用访问地址：`https://kylinglory.github.io/my-website/`

GitHub Pages 只托管前端静态页面，不运行 `server.js`。在线版本可以浏览界面与流程；需要真实生成图片时，请部署后端代理并配置 `XIAOJI_API_KEY`，不要把密钥写进前端代码。

## 已实现

- 商品图片上传、拖放和链接导入，最多 3 张
- 商品底图：比例、附加要求与 16 类场景预设
- 平台、国家、语言和详情页类型设置
- 商品卖点编辑、AI 辅写、复制和清空
- 六类详情页模块多选
- 海外电商：6 个平台、6 个市场与 6 类 Listing 图片模块
- 设计海报：纯 Prompt 生图、3 种比例与 12 个海报模板
- 本地草稿自动保存
- `gpt-image-2` 任务提交、进度轮询、错误处理和结果展示
- 桌面三栏工作台与移动端响应式布局

## 接口

- `POST /api/generate`：提交 `/v1/images/generations`
- `GET /api/tasks/:taskId`：轮询 `/v1/images/generations/{task_id}`
- `GET /api/health`：检查本地密钥配置状态

商品工作流通过 `reference_images` 发送参考图；设计海报支持无参考图的文生图。所有页面均可选择对应比例，单次最多生成 4 张。
