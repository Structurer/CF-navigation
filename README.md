# 导航页项目

一个轻量级纯前端导航页，双栏图标布局、拖拽排序、本地存储、种子数据初始化，配合 Cloudflare Pages Function 自动获取网站图标。

## 功能特性

### 核心功能
- **双栏图标布局**：上栏（k=1）+ 下栏（k=2），独立管理
- **图标增删改**：右键任意图标进行编辑、添加、删除
- **拖拽排序**：支持同栏排序 + 跨栏移动，长按 200ms 触发，使用 Sortable.js
- **本地持久化**：localStorage 单键存储，所有操作即时保存
- **种子数据初始化**：首次加载时若本地无数据，自动从 `nav_data.json` 加载种子数据写入 localStorage
- **自动获取网站图标**：部署到 Cloudflare Pages 后，输入网址按 Enter 或失焦，自动调 `/api/favicon` 获取网站 Favicon 并预览（Base64 写入 localStorage）
- **图标 2 级兜底渲染**：Base64 图片 → alt 文字（带文字阴影）
- **占位图标**：空栏自动显示「+」占位，右键添加图标自动归属对应栏位
- **数据导出**：右键任意图标 → 导出 localStorage 最新数据为 JSON 文件
- **搜索功能**：顶部搜索栏，支持 Google（Go 按钮）和百度（搜索按钮 / 回车）
- **右键菜单 4 项**：编辑图标、添加图标、删除图标、导出数据

### 视觉特性
- 12 种颜色预设 + 自定义取色器
- 图标拖拽上传预览（Base64 内联存储）
- 图标 hover 缩放动效、拖拽抖动动效
- 文字预览与图片预览双模式
- 移动端触摸长按触发
- 响应式网格布局

## 项目结构

```
CF-navigation/
├── index.html              # 页面入口（搜索栏 + 图标容器 + 模态框）
├── style.css               # 全部样式
├── app-bundle.js           # 主逻辑（单文件，5 大模块分区）
├── Sortable.min.js         # 第三方拖拽库
├── nav_data.json           # 种子数据（首次加载时写入 localStorage）
├── favicon.ico             # 站点图标
└── functions/              # Cloudflare Pages Functions
    └── api/
        └── favicon.js      # GET /api/favicon?url=...  获取网站图标返回 Base64
```

## 数据架构

### 逻辑分层（app-bundle.js 内部分区）

| 分区 | 核心函数 | 职责 |
|------|----------|------|
| **工具层 utils** | `generateId`、`fixUrlPrefix`、`fileToBase64`、`showToast`、`initColorPresets`、`tryGetFavicon` | ID 生成、URL 处理、Base64 转换、提示、颜色预设、Favicon API 调用 |
| **存储层 storage** | `getLocalStorageData`、`loadIcons`、`saveIcons`、`exportData` | localStorage 读写 + 种子数据回退 + 数据导出 |
| **渲染层 render** | `renderIcons`、`createRightClickMenu`、`initCrossColumnSortable`、`openAddModal`、`openEditModal`、`openDeleteModal`、`checkPlaceholders`、`createPlaceholder` | 页面渲染 + 模态框 + 拖拽 + 右键菜单 |
| **入口 main** | `initDomEvents`、`submitIcon`、`initDragUpload`、`handleFileUpload`、`DOMContentLoaded` | 初始化流程 |

### 数据加载流程

```
页面加载
  ↓
loadIcons()
  ↓
localStorage 有数据？
  ├── 是 → 直接读取 → 渲染
  └── 否 → fetch('./nav_data.json')
              ↓
         写入 localStorage
              ↓
         读取 → 渲染
```

### 自动获取图标流程（部署到 Cloudflare Pages 后生效）

```
添加/编辑图标 → URL 输入框按 Enter 或失焦
  ↓  (若用户尚未手动上传图片)
GET /api/favicon?url=https://example.com
  ↓
Cloudflare Pages Function 按优先级尝试 7 个来源：
  1. 目标网站 origin/favicon.ico（保留用户输入的 http/https）
  2. 抓取目标网站 HTML，解析 <link rel="icon"> 自定义 URL
  3. https://www.{host}/favicon.ico
  4. https://{host}/favicon.ico
  5. http://{host}/favicon.ico
  6. Google S2 favicons（公共代理，sz=128）
  7. DuckDuckGo ip3
  ↓
返回 { success: true, base64: "data:image/...", hostname }
  ↓
前端写入 window.uploadedBase64 → 更新预览 → 保存时写入 localStorage
```

### 数据结构

```json
{
  "navList": [
    {
      "id": "唯一ID",
      "k": 1,
      "name": "网站名称",
      "url": "https://...",
      "alt": "图标替代文字",
      "backgroundColor": "#4cafef",
      "iconBase64": "data:image/png;base64,..."
    }
  ],
  "operateLog": []
}
```

字段说明：
- `id`：唯一标识（Date.now().toString(36) + 随机数）
- `k`：栏位（1=上栏，2=下栏）
- `iconBase64`：Base64 图标（null 时渲染 alt 文字兜底；可由 `/api/favicon` 自动填充）
- `operateLog`：保留字段

### 存储机制
- **存储键**：`STORAGE_KEY = 'nav_data'`（单键，无冗余）
- **存储位置**：浏览器 localStorage
- **写入时机**：添加 / 删除 / 修改 / 拖拽排序后即时写入
- **种子数据**：`nav_data.json`（首次加载备份）

## 快速开始

### 本地开发（无自动图标抓取）

```bash
# 方式一：Python
python -m http.server 8000

# 方式二：Node.js
npx serve
```

> ⚠️ **注意**：不能直接用 `file://` 打开，因为需要 fetch 加载 nav_data.json 种子数据，必须通过 HTTP 服务器访问。
> 本地普通 HTTP server 不会执行 Pages Functions，因此 `/api/favicon` 会 404，不影响主功能（自动获取图标会静默失败）。

### 本地调试（带 Functions / 带自动图标抓取）

使用 Cloudflare Wrangler 本地模拟 Pages 环境：

```bash
npm i -g wrangler
wrangler pages dev . --port 8788
# → http://localhost:8788
# 此时 /api/favicon?url=https://github.com 可正常返回 Base64
```

### 访问页面

浏览器访问：`http://localhost:8000` 或 wrangler 启动的端口

## Cloudflare Pages 部署

### 方式一：连接 Git 仓库（推荐）

1. 登录 Cloudflare Dashboard → Workers & Pages → **Create** → **Pages** → **Connect to Git**
2. 选择本仓库 → **Begin setup**
3. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空（纯静态项目，无需构建）
   - **Build output directory**：`/`
4. **Save and Deploy**，等待部署完成
5. 访问 `https://<项目名>.pages.dev`，`functions/api/favicon.js` 会自动挂载到 `/api/favicon` 路由

### 方式二：直接上传目录

```bash
npm i -g wrangler
wrangler login
wrangler pages deploy . --project-name=cf-navigation
```

### API 验证

部署完成后，浏览器测试：

```
https://<项目名>.pages.dev/api/favicon?url=https://github.com
```

返回示例：

```json
{
  "success": true,
  "hostname": "github.com",
  "base64": "data:image/png;base64,iVBORw0KGgo...",
  "size": 1842
}
```

## 使用指南

### 图标管理

#### 添加图标
1. 右键点击任意图标（或空栏占位符）→ **添加图标**
2. 填写字段：
   - **网站地址（URL）**：按 Enter 自动补全 http/https 前缀，并从域名提取网站名称；同时自动调用 `/api/favicon` 获取网站 Favicon（CF Pages 部署后生效）
   - **网站名称**：按 Enter / Tab 自动填充 alt 文字（仅当 alt 为空时）
   - **图标替代文字（alt）**：图标加载失败时的兜底文字
   - **图标背景色**：12 种预设色 + 自定义取色
   - **图标上传**：拖拽或点击右侧预览上传图片（转为 Base64 存储；若已自动获取图标则此步可跳过）
3. 点击「保存（即时生效）」完成

#### 编辑图标
1. 右键点击目标图标 → **编辑图标**
2. 修改 URL 后按 Enter 或失焦，会自动重新拉取该网址图标（若已手动上传图片会保留手动的）
3. 修改后点击「保存（即时生效）」

#### 删除图标
1. 右键点击目标图标 → **删除图标**
2. 在确认弹窗点击「确认删除」

#### 拖拽排序
1. 长按图标 200ms（图标开始抖动，出现「可以拖拽了」提示）
2. 拖拽到目标位置（支持跨栏移动）
3. 松开鼠标完成排序

### 数据导出
- 右键点击任意图标 → **导出数据**
- 自动下载 `nav_data_YYYY-MM-DD.json`（含 localStorage 最新数据，格式缩进 2 空格）

### 搜索
- 输入关键词 → 按「搜索」按钮或回车 → 百度搜索
- 按「Go」按钮 → Google 搜索

### 占位图标
- 空栏时自动显示「上栏占位」或「下栏占位」图标
- 右键占位图标 → 添加图标，新图标自动归属对应栏位
- 占位图标右键菜单不显示「删除图标」

## 配置常量

| 常量 | 默认值 | 说明 | 位置 |
|------|--------|------|------|
| `STORAGE_KEY` | `'nav_data'` | localStorage 存储键 | app-bundle.js |
| `DRAG_DELAY` | `200` | 拖拽触发延迟（毫秒） | app-bundle.js |
| `DEFAULT_COLOR_PRESETS` | 12 色 | 颜色预设数组 | app-bundle.js `initColorPresets` |
| `TIMEOUT_MS` | `5000` | favicon 抓取超时（毫秒） | functions/api/favicon.js |

## 浏览器兼容性

- Chrome（推荐）
- Firefox
- Safari
- Edge

## 许可证

MIT License
