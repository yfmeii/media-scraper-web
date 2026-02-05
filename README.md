# 🎬 媒体刮削管理工具

可视化管理媒体文件，支持 TMDB 刮削和 AI 智能路径识别的现代化 Web 应用。

## 📖 概念说明

| 术语 | 含义 | 何时使用 |
|------|------|----------|
| **刮削** | 首次处理媒体文件：匹配 TMDB → 移动文件 → 创建 NFO → 下载海报 | 新入库的剧集/电影 |
| **刷新元数据** | 重新获取最新信息：更新 NFO + 下载海报/Fanart | 元数据有误或 TMDB 信息更新 |
| **重新匹配** | 手动选择 TMDB 条目（当自动匹配错误时） | 同名剧集/电影混淆 |
| **移回收件箱** | 将已入库文件移回收件箱，删除关联的 NFO 元数据 | 入库错误需要重新处理 |

## ✨ 功能特性

### 📥 收件箱
- 按目录分组查看待处理文件
- 自动解析文件名获取标题、季集、分辨率等信息
- TMDB 自动匹配和手动搜索
- **AI 智能路径识别**：自动识别文件类型、季集信息、匹配 TMDB
- 预览移动计划（目标路径、NFO 创建、覆盖提示）
- 批量刮削支持
- 一键入库：移动文件 + 生成 NFO + 下载海报

### 📺 剧集管理
- 表格视图展示剧集库
- 海报缩略图、TMDB ID、处理状态
- 多选支持（Shift/Ctrl 快捷键）
- 批量操作：刷新元数据、重新匹配、移回收件箱
- **详情抽屉**：
  - Fanart 背景图展示
  - 剧情简介（支持展开/收起）
  - 元数据标签：评分、年份、播出状态、季/集数
  - 可折叠季集文件列表，显示文件大小
  - TMDB 链接跳转
  - 路径一键复制
  - 资产完整性检查（海报、NFO、Fanart）
- 实时进度条和表格更新

### 🎬 电影管理
- 电影库表格视图
- 年份、TMDB ID 显示
- 批量刷新元数据、重新匹配
- **详情抽屉**：
  - Fanart 背景图展示
  - 剧情简介和 Tagline
  - 元数据标签：评分、年份、时长、分辨率、编码
  - 文件技术信息：分辨率、编码、来源、大小
  - TMDB 链接跳转
  - 路径一键复制
  - 资产完整性检查

### 📊 首页概览
- 媒体库统计：剧集数、集数、电影数、待处理数
- 最近任务列表

## 🚀 快速开始

### Docker Compose（推荐）

1. 创建配置文件：
```bash
cp .env.example .env
# 编辑 .env 设置媒体路径和 API 密钥
```

2. 启动服务：
```bash
docker compose up -d
```

3. 访问 http://localhost:3000

### 手动运行

需要 [Bun](https://bun.sh) 运行时（v1.0+）。

```bash
# 安装依赖
bun install
cd client/web && bun install && cd ../..

# 构建前端
cd client/web && bun run build && cd ../..

# 复制前端构建到 public
cp -r client/web/build/* public/

# 启动服务
bun run server/server.ts
```

## ⚙️ 配置

通过环境变量或 `.env` 文件配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `INBOX_PATH` | 待处理文件目录 | `/mnt/media/Inbox` |
| `TV_PATH` | 剧集目录 | `/mnt/media/TV` |
| `MOVIES_PATH` | 电影目录 | `/mnt/media/Movies` |
| `TMDB_API_KEY` | TMDB API 密钥 | *必填* |
| `DIFY_PATH_RECOGNIZER_KEY` | Dify 路径识别 API 密钥 | *可选* |
| `DIFY_URL` | Dify API 地址 | `https://api.dify.ai/v1/chat-messages` |
| `PORT` | 服务端口 | `3000` |

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
- 返回匹配结果和置信度

## 📁 项目结构

```
media-scraper-web/
├── server/                 # 后端源码 (Bun + Hono)
│   ├── lib/
│   │   ├── config.ts       # 配置
│   │   ├── scanner.ts      # 文件扫描（含 NFO 解析）
│   │   ├── scraper.ts      # 刮削逻辑（NFO 生成）
│   │   ├── tmdb.ts         # TMDB API
│   │   ├── dify.ts         # AI 路径识别
│   │   ├── tasks.ts        # 任务管理
│   │   └── progress.ts     # SSE 进度
│   ├── routes/
│   │   ├── media.ts        # 媒体 API
│   │   ├── scrape.ts       # 刮削 API
│   │   └── tasks.ts        # 任务 API
│   ├── server.ts           # 入口
│   └── tsconfig.json       # 服务端 TS 配置
├── client/web/             # 前端源码 (SvelteKit)
│   └── src/
│       ├── lib/
│       │   ├── api.ts      # API 客户端
│       │   ├── format.ts   # 格式化工具
│       │   ├── components/ # UI 组件库
│       │   └── stores/     # Svelte 状态存储
│       └── routes/         # 页面路由
├── packages/shared/        # 共享类型定义
│   └── src/index.ts        # ShowInfo, MovieInfo 等类型
├── tsconfig.base.json      # 基础 TS 配置
├── tsconfig.json           # 项目引用入口
├── public/                 # 前端构建输出
├── dify/                   # Dify 工作流配置
│   └── path-recognizer.yml # AI 路径识别工作流
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 🔌 API 端点

### 媒体
- `GET /api/media/tv` - 剧集列表
- `GET /api/media/movies` - 电影列表
- `GET /api/media/inbox` - 收件箱文件
- `GET /api/media/inbox?view=dir` - 收件箱按目录分组
- `GET /api/media/stats` - 媒体库统计

### 刮削
- `GET /api/scrape/search/tv?q=` - 搜索剧集
- `GET /api/scrape/search/movie?q=` - 搜索电影
- `POST /api/scrape/match` - 自动匹配
- `POST /api/scrape/recognize` - AI 路径识别
- `POST /api/scrape/process/tv` - 处理剧集
- `POST /api/scrape/process/movie` - 处理电影
- `POST /api/scrape/refresh` - 刷新元数据
- `POST /api/scrape/preview` - 预览移动计划
- `POST /api/scrape/batch` - 批量处理
- `POST /api/scrape/move-to-inbox` - 移回收件箱

### 任务
- `GET /api/tasks` - 任务列表
- `GET /api/tasks/stats` - 任务统计
- `GET /api/tasks/active` - 活跃任务
- `POST /api/tasks/:id/cancel` - 取消任务

### 进度
- `GET /api/progress` - SSE 实时进度

## 🛠 开发

```bash
# 安装依赖
bun install
cd client/web && bun install && cd ../..

# 开发模式（前后端同时启动）
bun run dev:all

# 或分别启动
bun run dev          # 后端 (热重载)
bun run dev:web      # 前端

# 运行测试
bun test
bun test --watch

# 类型检查
bunx tsc --build
```

### 远程部署

```bash
# 同步代码（排除 .env 避免覆盖远程配置）
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'client/web/node_modules' \
  --exclude 'client/web/.svelte-kit' \
  --exclude 'client/web/build' \
  --exclude 'public' \
  --exclude '.env' \
  ./ user@server:~/media-scraper-web/

# 在远程服务器构建并启动
ssh user@server << 'EOF'
cd ~/media-scraper-web/client/web
bun run build
cp -r build/* ~/media-scraper-web/public/
cd ~/media-scraper-web
bun run server/server.ts &
EOF
```

## 📝 License

MIT
