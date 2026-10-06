# GameDeck — 游戏状态聚合桌面 · 详细开发流程

> 用 [parinazkassemi.com](https://www.parinazkassemi.com/) 的「macOS 桌面」设计语言，做一个整合各游戏平台状态的个人驾驶舱：锁屏显示当前游戏状态，桌面图标是各个平台/游戏，Dock 是常玩的游戏，右侧小组件聚合时长、成就、好友在线等状态。

---

## 0. 参考网站设计语言拆解（实测截图结论）

对目标站点的探索发现它是一个完整的「伪操作系统」，以下元素需要逐一复刻并映射到游戏场景：

| 参考站元素 | 视觉/交互特征 | 在本项目中的对应 |
|---|---|---|
| **开机/锁屏** | 渐变蓝天壁纸 + 大号时钟 + 日期 + 社交胶囊按钮 + "CLICK TO UNLOCK" + 加载进度条 | 锁屏显示「正在玩 XXX / 上次游戏时间 / 总时长」+ "CLICK TO UNLOCK" |
| **顶部菜单栏** | 左：logo + 站点名 + Edit/Help/Customization 菜单；右：社交图标 + 实时日期时间 | 左：GameDeck logo + 设置/视图/帮助菜单；右：通知铃铛 + 实时时钟 |
| **左侧徽章栏** | 竖排圆形徽章 + 竖排文字标签（Honors），带毛玻璃底 | 成就徽章墙：稀有成就/奖杯的竖排展示 |
| **桌面图标网格** | PNG 实物图标（文件夹、书籍、相机…），双击打开窗口，可拖拽 | 每个平台/收藏游戏一个图标：Steam 库、PSN、Xbox、Switch、RetroAchievements… |
| **窗口系统** | macOS 三色灯、居中标题、左侧工具栏、内容区、底部表单；背景毛玻璃模糊 | 每个平台打开一个「应用窗口」：游戏库列表、成就墙、时长图表 |
| **右侧小组件栏** | 主题色选择器（4 色圆点）、天气卡片、Now Playing（Spotify）、Duolingo 连击 | Now Playing（当前游戏+时长）、本周时长图表、最新成就、好友在线、各平台在线状态 |
| **底部 Dock** | 毛玻璃长条 + 应用图标 + 悬停标签 + "TECH STACK" 小字 | "PINNED GAMES"：常玩游戏图标 + 运行中小红点 + 悬停显示游戏名和状态 |
| **主题系统** | 4 套配色（浅蓝/紫/绿/黑），切换后壁纸+组件全部变色 | 同款 4 主题，可扩展为「跟随当前游戏换主题」（玩 Xbox 游戏→绿色） |
| **密码弹窗** | 居中模态 + 锁图标 + 输入框 + Cancel/Unlock，背景模糊 | 平台账号绑定授权弹窗（输入 Steam API Key / PSN npsso 等） |

---

## 1. 产品定义

**一句话**：把 Steam / PSN / Xbox / Switch / Riot / Battle.net / RetroAchievements 等平台的游戏状态（在玩什么、玩了多久、成就进度、好友动态）聚合到一个「伪 macOS 桌面」里，像操作一台「游戏主机桌面」一样查看自己的全部游戏人生。

**核心用户场景**
1. 打开网页 → 锁屏显示「昨天玩了 2.4h 艾尔登法环，解锁 3 个成就」→ 点击解锁进入桌面。
2. 桌面右侧小组件实时显示 Now Playing（Steam 正在玩）+ 好友在线 + 本周时长。
3. 双击「Steam 库」图标 → 打开窗口浏览游戏列表、时长、成就。
4. Dock 上常玩游戏图标下有「最近游玩」小红点，悬停看最近会话。

**MVP 范围（第一版只做）**
- Steam（官方 API，数据最全）+ RetroAchievements（官方 API，简单）两个平台
- 锁屏、桌面、窗口系统、3 个小组件（Now Playing / 时长统计 / 最新成就）、主题切换
- 单用户自托管（先不做多用户注册体系，API Key 存本地/环境变量）

**非目标（明确不做）**：游戏内实时数据（血量/地图）、自动启动游戏、云存档管理。

---

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15 (App Router) + TypeScript** | 前后端一体，API Routes 直接写聚合接口，部署 Vercel 一键 |
| 样式 | **Tailwind CSS 4 + CSS 变量主题** | 毛玻璃（backdrop-filter）、渐变壁纸、4 套主题切换靠变量最省事 |
| 动效 | **Framer Motion** | 窗口打开/关闭缩放、图标拖拽回弹、锁屏过渡 |
| 状态 | **Zustand** | 窗口管理器（开启列表/z-index/焦点/最小化）是典型客户端状态 |
| 拖拽 | 自写 Pointer Events + 网格吸附（约 100 行） | @dnd-kit 对「自由拖拽+吸附网格」反而绕，参考站就是自由摆放 |
| 图表 | **Recharts** | 小组件里的周时长柱状图、成就进度环 |
| 数据库 | **SQLite (Drizzle ORM)**，后期可换 Postgres | MVP 单用户，SQLite 零部署成本；Drizzle 迁移无痛 |
| 缓存 | **内存 LRU + 数据库快照** | 平台 API 有速率限制，数据 5–15 分钟刷新一次足够 |
| 实时 | **SSE（Server-Sent Events）** | 比 WebSocket 简单，单向推送状态变化够用 |
| 定时 | **node-cron**（自托管）或 Vercel Cron | 每 10 分钟拉取一次各平台状态 |
| 测试 | **Vitest + Playwright** | 单测聚合层逻辑；E2E 测锁屏→桌面→开窗主链路 |

> 若确定要多用户 SaaS 化：把 SQLite 换 Supabase（Postgres + Auth + Realtime 三合一），其余不变。

---

## 3. 系统架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  桌面 UI（Next.js 客户端组件）                                │
│  WindowManager(Zustand) · ThemeProvider · Dock · Widgets     │
└──────────────┬────────────────────────────▲──────────────────┘
        GET /api/state          SSE /api/stream（状态变更推送）
┌──────────────▼────────────────────────────┴──────────────────┐
│  聚合层 (Next.js API Routes / Route Handlers)                 │
│  /api/state/aggregate   ←── 读取快照缓存                      │
│  /api/auth/[platform]   ←── 各平台 OAuth / Key 绑定           │
│  /api/stream            ←── SSE 推送                          │
├───────────────────────────────────────────────────────────────┤
│  平台适配器层 (Adapters) —— 每个平台一个文件，统一输出 GameState │
│  steam.ts · retroachievements.ts · psn.ts · xbox.ts …         │
├───────────────────────────────────────────────────────────────┤
│  调度器：node-cron 每 10 分钟 → 拉取 → 归一化 → 写快照 → 发 SSE │
└──────────────┬────────────────────────────────────────────────┘
               ▼
     SQLite（账号凭据、游戏快照、成就记录、会话历史）
```

**核心抽象：平台适配器接口**（新增平台 = 新增一个文件，其余不动）

```ts
// src/server/adapters/types.ts
export interface PlatformAdapter {
  id: "steam" | "psn" | "xbox" | "switch" | "riot" | "battle.net" | "retro";
  // 验证用户填的凭据是否有效
  verify(credentials: PlatformCredentials): Promise<PlatformProfile>;
  // 拉取全量状态（库、时长、成就、当前游戏、好友）
  fetchState(credentials: PlatformCredentials): Promise<NormalizedState>;
}
```

---

## 4. 数据模型（Drizzle Schema 草案）

```ts
// 账号绑定的凭据（加密存储）
platformAccounts: {
  id, platform, // "steam" | "retro" | ...
  credentialEnc, // 加密后的 API key / token
  displayName, avatarUrl,
  lastSyncAt, syncStatus, // ok | error | rate_limited
  createdAt
}

// 游戏库快照（每平台每游戏一行，同步时 upsert）
games: {
  id, accountId, platform,
  platformGameId,        // Steam appid 等
  name, coverUrl,
  totalPlaytimeMin,      // 累计分钟
  lastPlayedAt,
  isFavorite,            // 决定是否上 Dock
  updatedAt
}

// 成就记录（追加式，可算「本周解锁」）
achievements: {
  id, accountId, platform, platformGameId,
  achievementId, name, description, iconUrl,
  rarity,               // 稀有度百分比
  unlockedAt
}

// 游戏会话（从「lastPlayedAt + 时长差」推断，用于时间线图表）
sessions: {
  id, gameId, startedAt, endedAt, durationMin,
  source                // "inferred" | "manual"
}

// 全局状态快照（锁屏/小组件直接读这里，一个 JSON）
stateSnapshots: {
  id, key,              // "current" 
  payload,              // JSON: nowPlaying, weeklyMinutes, recentAchievements, friendsOnline
  updatedAt
}
```

---

## 5. API 路由设计

| 路由 | 方法 | 作用 |
|---|---|---|
| `/api/state/aggregate` | GET | 返回锁屏+桌面所需的全量聚合快照（读缓存） |
| `/api/stream` | GET | SSE 长连接，推送状态变化（开始游戏/成就解锁/好友上线） |
| `/api/accounts` | GET/POST/DELETE | 列出、绑定、解绑平台账号 |
| `/api/accounts/[platform]/verify` | POST | 校验用户提交的 Key/Token |
| `/api/auth/steam/callback` | GET | Steam OpenID 回调（免 Key 体验最好） |
| `/api/games/[platform]` | GET | 某平台游戏库（窗口内容，分页） |
| `/api/achievements/recent` | GET | 最近成就流 |
| `/api/sync` | POST | 手动触发同步（菜单栏放个「同步」按钮） |
| `/api/settings` | GET/PUT | 主题、Dock 配置、图标位置（桌面布局持久化） |

---

## 6. 开发阶段划分（约 7–8 周，单人）

### 阶段 0 · 调研与 API 验证（3–5 天）⚠️ 最先做，风险都在这

- [ ] 申请 **Steam Web API Key**，跑通 `GetPlayerSummaries` / `GetOwnedGames` / `GetRecentlyPlayedGames` / `GetPlayerAchievements`（官方文档：steamcommunity.com/dev）
- [ ] 验证 **Steam OpenID 登录**流程（用户无需手动找 64 位 ID）
- [ ] 申请 **RetroAchievements** Web API Key，验证用户/成就接口
- [ ] 评估风险平台的接入顺序：PSN（社区库 PSNAWP，需用户自己的 npsso，有封号风险要写免责声明）、Xbox（xbl.io 第三方）、Switch（无 API，基本放弃，可用「手动添加」兜底）
- [ ] 决策记录：MVP 平台集合 = Steam + RetroAchievements
- [ ] 用 CodePen/单 HTML 页复刻「壁纸+时钟锁屏」验证视觉方向

**验收**：一份 `docs/api-matrix.md`，列出每个平台的：官方 API？认证方式？关键端点？速率限制？风险等级？

### 阶段 1 · 设计系统与静态桌面（第 1 周）

- [ ] 初始化 Next.js + Tailwind 项目，配 ESLint/Prettier
- [ ] 设计 Token：`--wallpaper-top/--wallpaper-bottom` 渐变、`--glass` 毛玻璃、`--accent` 强调色、字体（Inter + 等宽字体做时间/数字）
- [ ] 4 套主题的 CSS 变量表（浅蓝/紫/绿/黑，对齐参考站色板）
- [ ] 静态组件（无逻辑）：`Wallpaper` `MenuBar` `WidgetPanel` `WidgetCard` `Dock` `DesktopIcon` `Window`（仅外壳：三色灯+标题栏）
- [ ] 准备图标资产：平台 logo 的 PNG/SVG（Steam/PS/Xbox/RA…），统一带阴影浮起风格
- [ ] 用假数据（mock JSON）摆出和参考站同构的桌面

**验收**：截图对比参考站，桌面四要素（菜单栏/图标网格/Dock/右侧组件栏）齐备，主题可切换。

### 阶段 2 · 桌面交互内核（第 2 周）—— 本项目最硬的前端部分

- [ ] **WindowManager（Zustand）**：open/close/focus/minimize/maximize，z-index 栈，拖拽位置与尺寸持久化
- [ ] 窗口：Framer Motion 打开（scale 0.9→1 + fade）与关闭动画、拖标题栏移动、右下角 resize、点击置顶、Esc 关闭
- [ ] **桌面图标拖拽**：Pointer Events 自由拖 + 吸附到网格 + 位置存 localStorage（后续存 `/api/settings`）
- [ ] 双击开窗 / 单击选中高亮 / 点击空白取消选中
- [ ] **Dock**：悬停放大动画 + tooltip（游戏名+状态）、运行中小红点
- [ ] **菜单栏**：实时时钟（每秒走）、下拉菜单（视图/设置/同步/关于）
- [ ] **右键菜单**：桌面空白处右键 → 更换主题 / 刷新状态 / 新建便签（占位）
- [ ] **锁屏 → 桌面**：点击解锁的过场动画（锁屏上滑消失，桌面淡入）

**验收**：开 3 个窗口互相遮挡顺序正确；拖拽图标刷新后位置保留；全流程可用鼠标完成，60fps 无卡顿。

### 阶段 3 · 数据层与 Steam 接入（第 3 周）

- [ ] Drizzle + SQLite 建表（按第 4 节 Schema），写迁移
- [ ] 平台凭据加密存储（AES-GCM，密钥走环境变量）
- [ ] Steam 适配器：OpenID 回调 → 拉取玩家摘要/游戏库/最近游玩/成就 → 归一化为 `NormalizedState`
- [ ] RetroAchievements 适配器（用户提交 Web API Key + 用户名）
- [ ] 同步调度器：cron 每 10 分钟全量刷新 → 写快照 → 变更时发 SSE
- [ ] `/api/state/aggregate` 读快照返回；`/api/accounts` 绑定管理
- [ ] 「系统设置」窗口：平台账号绑定/解绑 UI（复用参考站的密码弹窗样式做 Key 输入）

**验收**：绑定真实 Steam 账号后，`/api/state/aggregate` 返回真实「正在玩/游戏库/成就」数据，同步间隔内不重复打 API。

### 阶段 4 · 小组件与窗口内容（第 4–5 周）

- [ ] **Now Playing 小组件**：当前游戏封面+已玩时长+「自 14:32 起」，无游戏时显示「空闲 · 上次游玩」
- [ ] **本周时长组件**：Recharts 柱状图（7 天），今天高亮
- [ ] **最新成就组件**：最近 5 条成就横滑列表 + 稀有度角标
- [ ] **好友在线组件**（Steam 好友）：头像+在玩什么
- [ ] **平台库窗口**：Steam 库列表（封面网格 + 时长 + 成就进度条），虚拟滚动优化
- [ ] **成就墙窗口**：按游戏分组展示，稀有成就置顶
- [ ] **左侧徽章栏**：自动取稀有度最高的 5 个成就展示（对应参考站 Honors）
- [ ] **Dock 数据**：`isFavorite` 游戏 + 最近 24h 玩过的游戏自动出现并带红点

**验收**：锁屏、小组件、窗口里全部是真实 Steam 数据；断网时显示缓存的旧快照+「离线」角标。

### 阶段 5 · 实时与「游戏感」细节（第 6 周）

- [ ] SSE 推送：开始/停止游戏 → Now Playing 与 Dock 红点实时更新；成就解锁 → 右上角 macOS 风格通知横幅（可加音效）
- [ ] 主题联动（可选彩蛋）：正在玩的游戏所属平台决定壁纸主题色
- [ ] 锁屏问候语：「欢迎回来，你昨晚在星空里玩了 2 小时」
- [ ] 手动刷新按钮 + 各卡片「数据更新于 X 分钟前」
- [ ] 空状态/错误状态设计：未绑定平台、API 限流、平台故障三种文案

### 阶段 6 · 打磨与上线（第 7 周）

- [ ] 性能：封面图 `next/image` + 懒加载；桌面首屏 JS 控制在 200KB 内；动画只用 transform/opacity
- [ ] 移动端降级：桌面拖拽在触屏退化为「点击开窗 + 组件纵向滚动」（参考站在手机上也是简化布局）
- [ ] Playwright E2E：锁屏→解锁→开 Steam 窗口→看小组件 主链路
- [ ] 部署：Docker compose（Next.js + SQLite 挂卷 + cron 内置）部署到 VPS；或 Vercel + Turso
- [ ] 域名 + HTTPS + 基础监控（Sentry 免费版）

### 阶段 7 · 迭代池（上线后按优先级排）

PSN（PSNAWP）→ Xbox（xbl.io）→ Riot/Battle.net（官方 OAuth）→ Switch 手动添加 → 多用户注册 → 桌面小部件开放自定义排列 → 年度报告页（Spotify Wrapped 式游戏年度总结，传播点）。

---

## 7. 建议目录结构

```
Game-Agent/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 # 桌面（含锁屏状态机）
│  │  ├─ api/
│  │  │  ├─ state/aggregate/route.ts
│  │  │  ├─ stream/route.ts       # SSE
│  │  │  ├─ accounts/…
│  │  │  └─ auth/steam/callback/route.ts
│  ├─ components/
│  │  ├─ desktop/  MenuBar · Wallpaper · DesktopIcon · ContextMenu · BadgeRail
│  │  ├─ windows/  Window · WindowTitleBar · SteamLibraryWindow · AchievementWindow
│  │  ├─ dock/     Dock · DockItem
│  │  ├─ widgets/  NowPlaying · WeeklyPlaytime · RecentAchievements · FriendsOnline
│  │  └─ lock/     LockScreen · BootScreen
│  ├─ stores/      windowManager.ts · theme.ts · desktopLayout.ts
│  ├─ server/
│  │  ├─ adapters/ types.ts · steam.ts · retro.ts · psn.ts(占位)
│  │  ├─ scheduler.ts · crypto.ts
│  └─ db/          schema.ts · client.ts · migrations/
├─ public/icons/   平台图标资产
├─ docs/           api-matrix.md · design-tokens.md
└─ DEVELOPMENT_PLAN.md
```

---

## 8. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| PSN/Switch 无官方 API | 高 | MVP 不依赖；PSN 走社区库并要求用户提供自己的 token + 免责声明；Switch 提供手动添加 |
| 第三方库（PSNAWP/xbl.io）失效或封号 | 中 | 适配器隔离，坏一个平台不影响其他；默认关闭风险平台 |
| 平台 API 速率限制 | 中 | 全部读走快照，10 分钟一刷；封面图自己代理缓存 |
| 「正在玩」状态 Steam 只有分钟级精度 | 低 | 展示为「最近 5 分钟内在玩」，不承诺实时 |
| 伪 OS 交互工作量大 | 中 | 阶段 2 严格限制范围：先窗口管理器，后动画细节 |
| ToS/合规 | 中 | 只读数据、只展示给用户本人、标注数据来源，不二次分发 |

---

## 9. 立即可执行的第一步

1. `npx create-next-app@latest game-deck --typescript --tailwind --app`
2. 申请 Steam Web API Key（5 分钟）
3. 按阶段 1 搭出静态桌面骨架，对着参考站截图逐元素校对
