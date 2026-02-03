# TAD

## 1. 架构概览
- 前端: SvelteKit (frontend)
- 后端: Bun + Hono (src)
- 外部服务: TMDB API, Dify AI
- 存储: 本地文件系统 (媒体目录 + NFO + 海报)

## 2. 运行方式
- Docker: docker-compose.yml + Dockerfile
- 本地: bun run src/server.ts + frontend build 静态托管

## 3. 目录结构
- src/server.ts: 路由装配, CORS, 静态资源
- src/routes/media.ts: 媒体扫描与统计, 海报代理
- src/routes/scrape.ts: 搜索/匹配/AI/处理/刷新/批量
- src/lib/scanner.ts: 文件扫描与文件名解析
- src/lib/tmdb.ts: TMDB 查询与匹配评分
- src/lib/dify.ts: AI 消歧 (SSE 解析)
- src/lib/scraper.ts: 文件移动, NFO 生成, 海报下载
- src/lib/config.ts: 环境变量与解析配置

## 4. 前端页面
- /: 仪表盘 + TMDB 搜索
- /tv: 剧集列表 + 刮削 + 分组
- /movies: 电影列表 + 刮削
- /inbox: 收件箱目录视图与批量处理

## 4.1 交互要点(实现约束)
- 表格为默认视图, 支持多选与批量操作
- 列表下方统一展示批量任务进度
- 详情采用抽屉, 决策采用弹窗
- 高风险操作需要预览与二次确认

## 5. API 清单
- GET /api/media/tv
- GET /api/media/movies
- GET /api/media/inbox
- GET /api/media/stats
- GET /api/media/poster?path=
- GET /api/scrape/search/tv?q=&year=&language=
- GET /api/scrape/search/movie?q=&year=&language=
- POST /api/scrape/match
- POST /api/scrape/resolve
- POST /api/scrape/process/tv
- POST /api/scrape/process/movie
- POST /api/scrape/refresh
- POST /api/scrape/batch

## 5.1 API 变更建议
- GET /api/media/inbox?view=dir: 返回目录分组结构
- GET /api/media/tv?include=assets: 返回海报/NFO 完整性标记
- GET /api/media/movies?include=assets: 返回海报/NFO 完整性标记
- POST /api/scrape/preview: 返回移动/覆盖预览清单
- POST /api/scrape/batch: 增加 disambiguationMode=manual|ai
- GET /api/tasks: 任务中心与进度查询

## 6. 核心数据模型
- MediaFile: path, name, size, kind, parsed, hasNfo, isProcessed
- ShowInfo: path, name, seasons, hasNfo, isProcessed, posterPath
- MovieInfo: path, name, file, hasNfo, isProcessed, posterPath
- MatchResult: matched, result, candidates, ambiguous
- 新增视图模型(前端):
  - DirectoryGroup: path, name, files[], summary
  - ScrapeStatus: total, done, failed, percent
  - AssetFlags: hasPoster, hasNfo
  - TaskItem: id, type, target, status, progress, eta, logs
  - ScrapePlan: actions[], impactSummary

## 7. 关键流程
- 扫描: 递归目录 -> 解析文件名 -> 检查 NFO -> 返回结构
- 匹配: TMDB 搜索 -> 评分 -> 候选 -> (可选) AI 决策
- 处理: 移动文件 -> 写 NFO -> 下载海报 -> 清理源目录
- 刷新: TMDB 详情 -> 更新 NFO -> 下载海报
- 补刮: 已刮削目录新增文件 -> 解析季/集 -> 复用剧集/季元数据
- 批量: 多选 -> 选择消歧策略(手动/AI) -> 执行 -> 汇总进度

## 7.1 补刮识别策略(建议)
- 从 tvshow.nfo 读取 tmdbId 作为已有剧集元数据来源
- 仅对缺失 NFO 的新剧集文件执行补刮
- 按季聚合, 允许针对季级元数据刷新

## 8. 配置项
- INBOX_PATH / TV_PATH / MOVIES_PATH
- TMDB_API_KEY
- DIFY_API_KEY / DIFY_URL (可选)
- PORT

## 9. 安全与限制
- poster 接口仅允许媒体目录路径
- CORS 全开放, 适合内网
- 路径参数需要持续校验
- 预览清单用于避免覆盖风险

## 10. 性能与可靠性
- 扫描为全量同步流程, 适合小中型库
- 批处理串行并带 500ms 间隔
- 补刮与批量操作需限制并发, 保护磁盘 IO

## 11. 可观测性
- 使用 console 记录异常
- 无统一追踪与结构化日志

## 12. 技术债与改进点
- 配置默认值不应包含真实 API Key
- 收件箱批量按钮未接后端
- 缺少任务队列/进度/失败重试
- 列表缺少资产完整性字段(海报/NFO)
- UI 未集中展示刮削进度条
