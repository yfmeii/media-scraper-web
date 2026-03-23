# 🎬 媒体刮削管理工具

可视化管理媒体文件，支持 TMDB 刮削和 AI 智能路径识别的现代化 Web + 小程序应用。

## 📖 概念说明

| 术语 | 含义 | 何时使用 |
|------|------|----------|
| **刮削** | 首次处理媒体文件：匹配 TMDB → 移动文件 → 创建 NFO → 下载海报 | 新入库的剧集/电影 |
| **刷新元数据** | 重新获取最新信息：更新 NFO + 下载海报/Fanart | 元数据有误或 TMDB 信息更新 |
| **重新匹配** | 手动选择 TMDB 条目（当自动匹配错误时） | 同名剧集/电影混淆 |
| **移回收件箱** | 将已入库文件移回收件箱，删除关联的 NFO 元数据 | 入库错误需要重新处理 |

## ✨ 功能特性

### 📥 收件箱（Web + 小程序）
- 按目录分组查看待处理文件（Web 支持目录树展开）
- TMDB 自动匹配和手动搜索
- **AI 智能路径识别**（Dify）：自动识别媒体类型、季集信息并匹配 TMDB，支持返回排序候选结果辅助人工确认
- 入库预览：显示目标路径、NFO 创建计划、覆盖提示，预览结果尽量与实际执行流程保持一致
- 一键入库：移动文件 + 生成 NFO + 下载海报/背景图，支持跨设备场景的文件操作策略
- 批量操作：一键匹配入库、一键 AI 识别入库
- 文件名关键词搜索过滤，收件箱解析对大小写扩展名和复杂路径更稳健
- Web 支持 Shift/Ctrl 多选，小程序支持勾选框多选

### 📺 剧集管理（Web + 小程序）
- Web：表格视图（海报缩略图、剧名、年份、TMDB ID、季/集数、状态标签）
- 小程序：宫格/列表切换视图，缺集徽章标记，关键词搜索
- 多选 + 批量操作：刷新元数据、重新匹配
- **详情面板**（Web 抽屉 / 小程序弹框）：
  - Fanart 背景图、海报封面
  - 剧情简介（支持展开/收起）
  - 元数据标签：评分、年份、播出状态、总季集数
  - 可折叠季集列表，显示文件大小和 NFO 状态
  - **粒度化操作**：按剧/按季/按集 刷新元数据；按集移回收件箱
  - 缺集检测与展示
  - TMDB 链接、路径复制
  - 资产完整性检查（海报、NFO、Fanart）

### 🎬 电影管理（Web + 小程序）
- Web：表格视图（海报、片名、年份、TMDB ID、状态标签）
- 小程序：宫格/列表切换视图，关键词搜索
- 多选 + 批量操作：刷新元数据、重新匹配
- **详情面板**（Web 抽屉 / 小程序弹框）：
  - Fanart 背景图
  - 剧情简介和 Tagline
  - 元数据标签：评分、年份、时长
  - 文件信息：分辨率、编码、来源、大小
  - 移回收件箱
  - TMDB 链接、路径复制
  - 资产完整性检查

### 📊 首页概览（Web + 小程序）
- 媒体库统计：剧集数、总集数、电影数、收件箱待处理数
- Web：最近任务列表；小程序：快捷导航入口

### 📱 微信小程序特有
- 封面图 HTTP 代理（绕过小程序 HTTPS 限制）
- 服务器连接配置与在线状态检测
- 图片代理地址自定义
- 下拉刷新
- 详情和收件箱交互已按更细粒度模块拆分，便于维护复杂状态和后续扩展

## 🚀 快速开始

### Docker Compose（推荐）

1. 创建配置文件：
```bash
cp .env.example .env
# 编辑 .env 设置媒体路径和 API 密钥
```

2. 启动服务：
```bash
docker compose up -d --build
```

3. 访问 http://localhost:3000

说明：当前镜像构建会直接生成 Web 静态资源并复制到 `public/`，无需额外手工处理前端产物。

### 手动运行

需要 [Bun](https://bun.sh) 运行时（v1.0+）和 [pnpm](https://pnpm.io)（小程序子项目）。

```bash
# 安装依赖（根目录 pnpm workspace 管理）
bun install

# 构建前端
bun run build:web

# 复制前端构建到 public
cp -r client/web/build/* public/

# 启动服务
bun run server/server.ts
```

如果使用源码部署，服务端会从根目录 `public/` 提供静态页面，因此不要跳过复制构建产物这一步。

## ⚙️ 配置

通过环境变量或 `.env` 文件配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `INBOX_PATH` | 待处理文件目录 | `/media/inbox` |
| `TV_PATH` | 剧集目录 | `/media/tv` |
| `MOVIES_PATH` | 电影目录 | `/media/movies` |
| `TMDB_API_KEY` | TMDB API 密钥 | *必填* |
| `DIFY_PATH_RECOGNIZER_KEY` | Dify 路径识别 API 密钥 | *可选* |
| `DIFY_URL` | Dify API 地址 | `https://api.dify.ai/v1/chat-messages` |
| `PORT` | 服务端口 | `3000` |
| `FILE_OPS_MODE` | 文件操作模式，`rename` 或 `copy` | `rename` |

`FILE_OPS_MODE` 说明：

- `rename`：同盘移动速度更快，适合常见 Docker/NAS 目录映射场景
- `copy`：适合跨设备、跨挂载点场景，可避免 `EXDEV` 导致的移动失败

### TMDB API Key

1. 注册 [TMDB](https://www.themoviedb.org/) 账号
2. 进入 Settings > API > Create > Developer
3. 获取 API Key (v3 auth)

### Dify AI 路径识别（可选）

> 玩 NAS 的该不会没装 [Dify](https://github.com/langgenius/dify) 吧？🤔

AI 路径识别功能可以智能解析复杂的文件名，自动识别媒体类型、季集信息，并匹配 TMDB。

**需要安装的 Dify 插件：**

| 插件 | 说明 | 安装方式 |
|------|------|----------|
| [langgenius/openai](https://marketplace.dify.ai/plugins/langgenius/openai) | OpenAI 模型接入 | Dify 插件市场 |
| [lcandy/tmdb](https://marketplace.dify.ai/plugins/lcandy/tmdb) | TMDB 搜索工具 | Dify 插件市场 |

**配置步骤：**

1. 部署 Dify 实例（自托管或云服务）
2. 安装上述两个插件
3. 导入工作流：`dify/path-recognizer.yml`
4. 配置 OpenAI API Key（支持任何 OpenAI 兼容 API）
5. 发布应用并获取 API 密钥
6. 配置环境变量：
   - `DIFY_PATH_RECOGNIZER_KEY` - 应用 API 密钥
   - `DIFY_URL` - API 地址，如 `https://your-dify.com/v1/chat-messages`

**工作流功能：**

- 解析文件路径中的标题、年份、季集信息
- 自动识别媒体类型（电视剧/电影）
- 调用 TMDB 多类型搜索
- AI 智能选择最佳匹配
- 返回匹配结果、候选项和置信度

## 📁 项目结构

```
media-scraper-web/
├── server/                 # 后端源码 (Bun + Hono)
│   ├── lib/
│   │   ├── config.ts       # 配置
│   │   ├── scanner.ts      # 文件扫描入口（已拆分多模块）
│   │   ├── scraper.ts      # 刮削逻辑入口（已拆分多模块）
│   │   ├── cleanup.ts      # 源目录安全清理
│   │   ├── tmdb.ts         # TMDB 能力入口（已拆分多模块）
│   │   ├── dify.ts         # AI 路径识别
│   │   └── tasks.ts        # 任务管理
│   ├── routes/
│   │   ├── media.ts        # 媒体 API
│   │   ├── scrape.ts       # 刮削 API 入口（已拆分请求/响应/搜索/处理模块）
│   │   └── tasks.ts        # 任务 API
│   ├── server.ts           # 入口
│   └── tsconfig.json       # 服务端 TS 配置
├── client/
│   ├── web/                # Web 管理台 (SvelteKit + Tailwind v4)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── api.ts      # API 客户端
│   │       │   ├── format.ts   # 格式化工具
│   │       │   ├── components/ # UI 组件库
│   │       │   └── stores/     # Svelte 状态存储
│   │       └── routes/         # 页面路由
│   └── weapp/              # 微信小程序 (weapp-vite + wevu + TDesign)
│       └── src/
│           ├── pages/          # 页面（index/inbox/library/match/settings/setup）
│           ├── components/     # 组件（MediaDetail/InboxFileDetail/MediaPoster 等）
│           ├── hooks/          # 复用逻辑（useMediaMatch/useMediaProcess 等）
│           ├── stores/         # 状态（server/tab）
│           └── utils/          # API/请求/配置/WXS 格式化
├── packages/shared/        # 共享类型、常量与工具函数
│   └── src/index.ts        # 共享导出入口（内部已拆分 constants/defaults/format/types/workflow 等）
├── dify/                   # Dify 工作流配置
│   └── path-recognizer.yml # AI 路径识别工作流
├── pnpm-workspace.yaml     # Monorepo 工作区配置
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 🔌 API 端点

### 媒体
- `GET /api/media/tv` - 剧集列表（支持 `?include=assets&group=status`）
- `GET /api/media/movies` - 电影列表（支持 `?include=assets`）
- `GET /api/media/inbox` - 收件箱文件列表
- `GET /api/media/inbox?view=dir` - 收件箱按目录分组
- `GET /api/media/stats` - 媒体库统计
- `GET /api/media/poster?path=` - 图片代理（返回本地海报/Fanart 文件）

### 刮削
- `GET /api/scrape/search/tv?q=` - 搜索剧集
- `GET /api/scrape/search/movie?q=` - 搜索电影
- `GET /api/scrape/search/multi?q=` - 多类型搜索
- `GET /api/scrape/search/imdb?imdb_id=` - 按 IMDB ID 搜索
- `POST /api/scrape/match` - 自动匹配
- `POST /api/scrape/recognize` - AI 路径识别（Dify）
- `POST /api/scrape/process/tv` - 剧集入库
- `POST /api/scrape/process/movie` - 电影入库
- `POST /api/scrape/refresh` - 刷新元数据（支持按剧/季/集粒度）
- `POST /api/scrape/preview` - 预览移动计划
- `POST /api/scrape/move-to-inbox` - 移回收件箱

### 任务
- `GET /api/tasks` - 任务列表（支持 `?status=&limit=`）
- `GET /api/tasks/stats` - 任务统计
- `POST /api/tasks/:id/cancel` - 取消任务

## 🛠 开发

```bash
# 安装依赖
bun install

# 开发模式（前后端同时启动）
bun run dev:all

# 或分别启动
bun run dev          # 后端 (热重载，端口 3000)
bun run dev:web      # Web 前端 (Vite Dev Server，端口 5173)
bun run dev:weapp    # 微信小程序

# 运行测试
bun test

# 构建
bun run build        # 后端
bun run build:web    # Web 前端
```

当前项目在 Web、WeApp、共享层和服务端都补充了较多测试，改动刮削、预览、匹配、请求层时建议优先跑 `bun test`。

### 远程部署

```bash
# 同步代码（排除 .env 避免覆盖远程配置）
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'client/web/node_modules' \
  --exclude 'client/web/.svelte-kit' \
  --exclude 'client/web/build' \
  --exclude 'client/weapp/dist' \
  --exclude 'client/weapp/node_modules' \
  --exclude 'public' \
  --exclude '.env' \
  ./ user@server:~/media-scraper-web/

# 在远程服务器构建并启动
ssh user@server << 'EOF'
cd ~/media-scraper-web
bun install
bun run build:web
cp -r client/web/build/* public/
bun run server/server.ts &
EOF
```

## 📝 License

MIT
