# CLAUDE.md

本文件给 AI 代理（Claude/Codex 等）快速理解本仓库并安全改动代码使用。

重要：请每次完成任务后使用 反馈 MCP 获得任务结束反馈
重要：前端超过 60 行的独立元素模块需要抽成组件

## 1. 仓库定位（TL;DR）

- 这是一个媒体刮削管理 monorepo，核心流程是：扫描收件箱 -> 匹配 TMDB -> 移动文件入库 -> 生成 NFO/海报/背景图 -> 在 Web/小程序查看和补刮。
- 后端是 `Bun + Hono`（无数据库，文件系统即数据源）。
- Web 端是 `SvelteKit + Tailwind v4`，小程序端是 `weapp-vite + wevu + TDesign`。
- 类型契约统一在 `packages/shared/src/index.ts`。

## 2. Monorepo 结构

```text
media-scraper-web/
├── server/                 # Bun + Hono API
│   ├── server.ts
│   ├── routes/             # media/scrape/tasks 路由
│   └── lib/                # scanner/scraper/tmdb/dify/tasks/cleanup
├── client/
│   ├── web/                # SvelteKit Web 管理台
│   └── weapp/              # 微信小程序端
│       └── src/
│           ├── pages/      # index/inbox/library/match/settings/setup
│           ├── components/ # MediaDetail/InboxFileDetail/MediaPoster/MsImage/EmptyState/TabBar
│           ├── hooks/      # useMediaMatch/useMediaProcess/useToast/useDialog
│           ├── stores/     # server(连接配置)/tab(底栏状态)
│           └── utils/      # api/request/config/format.wxs
├── packages/
│   └── shared/             # 共享类型、常量与工具函数
├── dify/
│   └── path-recognizer.yml # Dify 工作流导出
└── CLAUDE.md               # 当前文档
```

## 3. 技术栈与运行方式

### 3.1 包管理与工作区

- 根工作区由 `pnpm-workspace.yaml` 定义：`client/*`、`packages/*`。
- 实际运行工具以 `bun` 为主；小程序子项目脚本是 `pnpm`。

### 3.2 常用命令（根目录）

- 安装依赖：`bun install`
- 后端开发：`bun run dev`
- Web 开发：`bun run dev:web`
- 前后端并行：`bun run dev:all`
- 小程序开发：`bun run dev:weapp`
- 构建后端：`bun run build`
- 构建 Web：`bun run build:web`
- 测试：`bun test`

说明：

- `dev:all` 会启动后端 `:3000` + Web Vite Dev Server（默认 `:5173`，代理 `/api` 到 `:3000`）。
- 生产静态页面由后端从 `./public` 提供；本地只跑 `bun run dev` 时需确认 `public/index.html` 存在。

## 4. 环境变量

来自 `.env.example` 与 `server/lib/config.ts`：

- `INBOX_PATH`：收件箱路径（默认 `/mnt/media/Inbox`）
- `TV_PATH`：剧集库路径（默认 `/mnt/media/TV`）
- `MOVIES_PATH`：电影库路径（默认 `/mnt/media/Movies`）
- `TMDB_API_KEY`：必需，不填则 TMDB 功能不可用
- `DIFY_PATH_RECOGNIZER_KEY`：可选，开启 AI 路径识别
- `DIFY_URL`：Dify API 地址（默认 `https://api.dify.ai/v1/chat-messages`）
- `PORT`：服务端口（默认 `3000`）

## 5. 关键业务术语

- 刮削：首次入库流程（匹配 + 移动 + NFO + 海报）
- 刷新元数据：重新拉取 TMDB 并更新 NFO/海报
- 重新匹配：人工重选 TMDB 目标
- 补刮：已刮削目录中新增视频文件补齐 NFO
- 移回收件箱：将入库视频和字幕移回 inbox，并删除关联 NFO

## 6. 系统核心流程（后端）

### 6.1 扫描（`server/lib/scanner.ts`）

- 递归扫描目录，基于文件名与路径解析标题、年份、季集等。
- 解析 TV/电影/未知类型，读取 NFO 判断 `hasNfo` 与 `isProcessed`。
- 提供资产扫描版本（海报/NFO/Fanart）与补刮检测能力。

### 6.2 匹配与识别（`server/routes/scrape.ts` + `lib/tmdb.ts` + `lib/dify.ts`）

- `search/tv`、`search/movie`：TMDB 搜索。
- `match`：自动匹配（标题/年份/评分加权）。
- `recognize`：调用 Dify 流式结果，解析 JSON 输出路径识别结果。

### 6.3 入库与元数据（`server/lib/scraper.ts`）

- TV 入库：
  - 先移动视频/字幕，再生成 `tvshow.nfo`、`season.nfo`、每集 `.nfo`，下载海报与背景图。
  - 目录命名使用 TMDB 返回剧名（不是用户输入 `showName`）。
- 电影入库：
  - 目录命名为 `Title (Year)`，文件名同目录名。
  - 移动后生成电影 NFO，下载海报/背景图。
- 刷新元数据：
  - TV 以剧根目录为基准，可按剧/季/集刷新。
  - 电影可传目录或文件路径。

### 6.4 源目录清理（`server/lib/cleanup.ts`）

入库后对源目录进行安全清理，规则：
- **永不删除保护目录**：Inbox/TV/Movies 根目录不可删除（动态读取 `MEDIA_PATHS`）。
- **包含视频文件则保留**：如果目录中仍有有效视频文件（`.mkv/.mp4/.m4v/.avi/.mov`）则不删除。
- **非递归删除**：仅使用 `rmdir`（不含 `recursive`），目录非空则失败保留。
- 使用 `FileSystemOps` 接口抽象磁盘操作，便于在单元测试中 mock。

## 7. API 面向（主要）

- `GET /api/media/tv?include=assets&group=status`
- `GET /api/media/movies?include=assets`
- `GET /api/media/inbox` / `GET /api/media/inbox?view=dir`
- `GET /api/media/stats`
- `POST /api/scrape/match`
- `POST /api/scrape/recognize`
- `POST /api/scrape/process/tv`
- `POST /api/scrape/process/movie`
- `POST /api/scrape/refresh`
- `POST /api/scrape/preview`
- `POST /api/scrape/move-to-inbox`
- `GET /api/tasks`、`GET /api/tasks/stats`、`POST /api/tasks/:id/cancel`

## 8. 前端改动导航

### 8.1 Web（`client/web`）

- 页面入口：
  - `/`：统计与任务概览
  - `/inbox`：收件箱 + 匹配 + 入库
  - `/tv`：剧集管理
  - `/movies`：电影管理
- API 统一在 `client/web/src/lib/api.ts`。
- 通用多选逻辑在 `client/web/src/lib/selection.ts`（TV/电影/收件箱共用）。

### 8.2 小程序（`client/weapp`）

- 首次进入未配置服务器会跳转 `/pages/setup/index`。
- 业务页：`index`（首页统计）、`inbox`（收件箱）、`library`（媒体库）、`match`（匹配/重匹配）、`settings`（设置）。
- API 封装在 `client/weapp/src/utils/api.ts`，请求层在 `src/utils/request.ts`。
- WXS 格式化函数在 `src/utils/format.wxs`（小程序模板不支持直接调用 JS 函数）。

#### 8.2.1 组件架构

| 组件 | 职责 |
|------|------|
| `MediaDetail` | 媒体详情弹框（剧集/电影），支持刷新元数据、移回收件箱、重新匹配 |
| `InboxFileDetail` | 收件箱文件详情弹框，支持自动匹配、手动搜索、AI 识别、预览、入库 |
| `MediaPoster` | 媒体封面组件，支持徽章（缺集标记）、懒加载、自定义圆角 |
| `MsImage` | 图片组件，处理 HTTP→HTTPS 代理和错误兜底 |
| `EmptyState` | 空状态提示 |
| `TabBar` | 底部导航栏 |

#### 8.2.2 Hooks

| Hook | 职责 |
|------|------|
| `useMediaMatch` | TMDB 匹配逻辑（自动匹配 + 搜索），含请求序列号防竞态 |
| `useMediaProcess` | 统一入库处理（TV/电影） |
| `useToast` | Toast 提示封装 |
| `useDialog` | 确认对话框封装 |

#### 8.2.3 Stores

| Store | 职责 |
|-------|------|
| `server` | 服务器连接配置、连接检测（含防并发）、图片代理设置 |
| `tab` | 底栏 Tab 激活状态 |

#### 8.2.4 状态管理规范

- **弹框关闭**：必须先设 `localVisible = false` 再 `emit('close')`，避免微信 setData 异步导致遮罩层残留。
- **`onVisibleChange` 防重复**：通过 `localVisible.value` 守卫判断，仅处理遮罩/手势触发的关闭，避免与程序化关闭双重触发。
- **异步操作**：所有 loading/processing 状态必须在 `try-finally` 块中管理。
- **Tab 页数据加载**：在 `<script setup>` 顶层调用（等同 `lifetimes.created`，仅执行一次）；`onShow` 仅用于轻量 UI 状态更新（如 `tabStore.setActive(N)`）。

关于 weapp-vite：
- 请先访问并学习 https://vite.icebreaker.top/llms.txt。
- 必要时再访问 https://vite.icebreaker.top/llms-full.txt 获取细节。
- 回答时优先引用其中的内容，保持回答简洁、可执行。

## 9. 共享契约（必须同步）

`packages/shared/src/index.ts` 包含：
- **类型**：`MediaFile`、`ShowInfo`、`MovieInfo`、`SeasonInfo`、`SearchResult`、`MatchResult`、`ProcessTVParams`、`ProcessMovieParams`、`PreviewItem`/`PreviewPlan`、`PathRecognizeResult`、`Stats`、`TaskItem`/`TaskStats` 等。
- **常量**：`VIDEO_EXTS`、`SUB_EXTS`、`NFO_EXTS`、`CLIENT_API_ENDPOINTS`。
- **工具函数**：`formatFileSize`、`formatDate`、`formatSeason`/`formatEpisode`/`formatSeasonEpisode`、`formatRating`、`formatRuntime`、`normalizeMediaKind`、`getShowMissingEpisodes`/`getSeasonMissingEpisodes`/`formatMissingSxEx`。

任何后端响应字段变更，都要同步以下位置：

- 类型定义：`packages/shared/src/index.ts`
- Web API/页面：`client/web/src/lib/api.ts` 及相关页面/组件
- 小程序 API/页面：`client/weapp/src/utils/api.ts` 及相关页面

## 10. 开发约束（给 AI 的硬规则）

### 10.1 优先修改区

- 后端逻辑：`server/lib/*`、`server/routes/*`
- Web 页面：`client/web/src/**/*`
- 小程序页面：`client/weapp/src/**/*`
- 类型：`packages/shared/src/index.ts`

### 10.2 谨慎或避免直接编辑

- 生成产物：
  - `client/web/build/**`
  - `client/web/.svelte-kit/**`
  - `client/weapp/dist/**`
  - `client/weapp/miniprogram_npm/**`
  - `client/weapp/components.d.ts`
  - `client/weapp/typed-components.d.ts`
  - `client/weapp/auto-import-components.json`
- 锁文件：`bun.lock`、`pnpm-lock.yaml`（仅在确有依赖变更时更新）

### 10.3 文件系统副作用

- `process*` / `move-to-inbox` 会执行真实 `rename/rm/writeFile`，属于高风险改动。
- 涉及路径移动逻辑时，优先保证“先移动文件，再写元数据”的顺序不被破坏。
- 修改覆盖策略前，要同步检查 `preview` 接口的 `willOverwrite` 语义。
- 源目录清理逻辑在 `server/lib/cleanup.ts`，修改时必须确保保护目录列表（Inbox/TV/Movies）不被删除，且不使用 `recursive: true`。

## 11. 测试与验证

### 11.1 现有测试分布

- 后端：`server/lib/*.test.ts`（scanner/scraper/tmdb/dify/tasks/cleanup）
- 共享包：`packages/shared/src/index.test.ts`
- Web 工具：`client/web/src/lib/*.test.ts`

### 11.2 推荐验证顺序

1. `bun test`
2. `bun run dev` + `bun run dev:web` 手动验证 API 与界面主流程
3. 如改小程序，再跑 `cd client/weapp && pnpm dev` 进行交互确认

## 12. 当前已知坑位/不一致

- Docker 与静态目录：
  - 后端从 `./public` 提供静态文件；
  - `Dockerfile` 当前复制的是 `client/web/build`，未直接拷贝到 `public`。
- Dify 环境变量命名：
  - 代码使用 `DIFY_PATH_RECOGNIZER_KEY`；
  - `docker-compose.yml` 使用 `DIFY_API_KEY`，存在命名不一致。
- 任务中心：
  - `server/lib/tasks.ts` 是内存实现，且目前刮削流程未接入任务创建/更新，`/api/tasks` 可能为空。
- 小程序 API Key：
  - 小程序会发送 `X-API-Key`；
  - 服务端当前未实现该头的鉴权校验。

## 13. 提交前检查清单（AI 必做）

1. 若改 API 字段，是否同步 `packages/shared` + Web + WeApp。
2. 若改路径/命名规则，是否同步 `preview`、`process*`、前端显示逻辑。
3. 是否误改了生成目录或锁文件。
4. 是否跑过最小验证（至少 `bun test`）。

