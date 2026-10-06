# Game-Agent 实现提示词（配合 docs/UI_OPTIMIZATION_PLAN.md 使用）

> 用法：每条提示词独立可用。发给 AI 编程工具前，先粘贴【通用上下文】，再粘贴对应任务提示词。
> 建议一次一个任务，做完验收再下一个。P0 四条可连续做。

---

## 〇、通用上下文（每次都先粘贴这段）

```text
项目：Game-Agent——模仿 parinazkassemi.com 的「伪 macOS 桌面」二次元游戏聚合器。
技术栈：Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4。
代码位置：桌面组件在 src/components/desktop/（Desktop.tsx 是根组件，负责主题与窗口状态；
MenuBar/LeftRail/ProfileBlock/DesktopIcons/WidgetPanel/Dock/GameWindow/LockScreen 各一个文件，
图标在 icons.tsx，游戏元数据在 src/lib/games.ts），全局样式与主题变量在 src/app/globals.css。
主题机制：根元素 data-os="sky|violet|green|dark"，CSS 变量在 globals.css 的 [data-os] 块中定义。
已验证的交互：锁屏→解锁→桌面→双击图标开窗→关闭。

【技术红线，违反会出渲染事故】
1. 含 backdrop-filter 的元素（.glass-card、.lock-pill、Dock 等）禁止套 opacity 关键帧动画
   （@keyframes + fill-mode 会触发合成层冻结/鬼影，已踩坑两次）；改用 transition 或只动 transform。
2. 动画只允许 transform/opacity；不要用 width/height/top/left 做动画（进度条等需求用
   JS 真实时钟驱动 + rAF + setInterval watchdog，先例见 LockScreen.tsx 的 progress 实现）。
3. 每个新动效必须在 @media (prefers-reduced-motion: reduce) 下禁用。
4. 本机 Turbopack dev 热更新会死循环：验证一律用生产模式——
   npm run build && npm run start -- --port 3000，然后浏览器打开 http://localhost:3000 自测。
5. 环境注意：本机 npm 不在 PATH，用 PATH="$HOME/.npm-cli/shims:$PATH" 前缀执行 npm 命令。

【验收标准（每个任务通用）】
- npm run build 通过（0 error）。
- 生产模式浏览器自测通过，截图确认视觉效果。
- 现有功能无回归：主题切换、锁屏解锁、双击开窗、关窗。
```

---

## 一、P0-1 动效系统

```text
给桌面加入一套克制的动效系统，目标是「操作系统感」。遵守通用上下文全部红线。

1. 解锁入场序列：解锁动画结束后，桌面元素按顺序入场——
   菜单栏从上方 8px 下滑淡入(0ms) → 内容簇(资料+图标)上浮 12px 淡入(100ms) →
   四个游戏图标逐个弹入(180ms + i*50ms，scale 0.8→1 带 overshoot) →
   右侧组件栏从右滑入 24px(260ms) → Dock 上浮 16px(320ms)。
   实现：Desktop.tsx 加 phase 状态 "entering"→"idle"，用 CSS class + transition-delay 控制，
   每个 delay 定义为 CSS 变量；入场只播一次。锁屏期间桌面保持静止（不要提前播）。

2. Dock 放大镜：监听 Dock 容器 mousemove，对每个图标按与鼠标的高斯距离计算 scale
   （中心 1.45，8px 内衰减到 1，transform-origin: bottom），mouseleave 全部回弹。
   纯 transform，容器 overflow-visible。

3. 桌面图标浮起：hover 时图标 translateY(-3px) 且阴影加深（两层阴影：
   0 3px 8px rgba(0,0,0,.18) 常驻 → hover 变 0 18px 32px rgba(0,0,0,.28)），
   active 按压 scale(0.94)，全部 transition 180ms。

4. 时钟数字滚动：菜单栏时钟和锁屏大时钟，分钟变化时旧数字上滑淡出、新数字下方滑入
   （每个字符独立，120ms）。用 key={value} 触发 CSS animation，
   注意：动画元素不能是含 backdrop-filter 的元素本身（红线1），包一层纯文本 span 即可。

5. 主题切换涟漪：点击主题圆点时，从点击位置扩散一个白色半透明圆环
   （scale 0→覆盖全屏，opacity 0.35→0，600ms，结束后移除节点，挂在 Desktop 根元素）。

6. 全局 prefers-reduced-motion 降级：globals.css 加 media query，
   关闭上述所有 animation/transition（保留瞬间切换）。

验收：解锁后能看到完整的入场序列；Dock 有放大镜；换主题有涟漪；
系统开启「减弱动态效果」时全部静止；build 通过、生产模式自测无回归。
```

---

## 二、P0-2 玻璃与阴影材质统一

```text
把当前各自为政的玻璃/阴影收敛为三个材质类，全部改在 globals.css，组件只换类名。

1. 定义三个材质类：
   .glass-thin：菜单栏/左侧栏用。backdrop-filter blur(20px) saturate(1.4)，
   背景 rgba(255,255,255,.30)（dark 主题换 rgba(14,16,22,.45)）。
   .glass-card：组件卡用。保持 blur(18px) saturate(1.3)，新增内高光：
   inset 0 1px 0 rgba(255,255,255,.25)（顶部受光边）+ inset 0 0 0 1px rgba(255,255,255,.12)。
   .glass-deep：锁屏胶囊/Dock 用。blur(22px) saturate(1.5)，背景更实（white/35）。

2. 阴影两级常量（CSS 变量 --shadow-contact / --shadow-ambient）：
   接触阴影 0 2px 6px rgba(15,23,42,.10)，环境阴影 0 16px 40px rgba(15,23,42,.12)，
   所有浮起元素（卡片/窗口/Dock/侧栏块）统一 boxShadow: 两个叠加。

3. 游戏图标统一浮起投影：0 12px 28px rgba(0,0,0,.30), 0 3px 8px rgba(0,0,0,.18)，
   替换 DesktopIcons 里现在的单层阴影。

4. 检查 MenuBar/LeftRail/WidgetPanel/Dock/LockScreen，全部换到对应材质类，
   删除组件内联的零散 shadow/backdrop 定义。

验收：四套主题下检查菜单栏、卡片、Dock、锁屏胶囊质感一致且文字对比度足够；
dark 主题下高光边不可过亮；build 通过。
```

---

## 三、P0-3 桌面图标 Squircle + 角标

```text
1. squircle：给游戏图标（DesktopIcons、WidgetPanel 小卡、LeftRail 圆徽章、锁屏胶囊小图）
   换成 iOS 式连续圆角（超椭圆）。实现：做一个 <Squircle size={n}> 组件（icons.tsx 内），
   用固定 path 的 SVG clipPath（20% 圆率的 iOS squircle path），Image 包在里面。
   兼容性兜底：不支持 clip-path path() 时退回 border-radius（@supports 查询）。

2. 角标系统：DesktopIcons 的图标右上角加角标容器（-top-1.5 -right-1.5，绝对定位），
   支持三种：红点（8px）、数字角标（min-width 16px 圆角胶囊，白字红底 #ef4444，
   带 1px 白描边）、无。数据结构在 src/lib/games.ts 的 GameMeta 加
   badge?: { type: "dot" | "count"; count?: number } | null，当前全部 null（占位），
   WidgetPanel 实时状态小卡同步支持。

3. games.ts 加 iconFallback 字段说明注释：官方图标会随版本更新（现在原神是 6 周年图），
   换图标时只改这个文件。

验收：图标呈 iOS squircle 圆角（肉眼对比 macOS Dock）；角标系统就位但默认隐藏；
给一个游戏临时配 count 角标截图确认样式后改回 null；build 通过。
```

---

## 四、P0-4 锁屏增强

```text
改造 LockScreen.tsx（保留现有开机进度/胶囊/解锁逻辑），三项增强：

1. 毛玻璃锁屏：锁屏壁纸层不再完全不透明——改为「桌面隐约可见」：
   锁屏根层的壁纸 div 透明度降到 0.72（露出底下桌面约 28%），
   再叠一层 backdrop-filter: blur(28px) saturate(1.2) 的磨砂层。
   注意红线1：磨砂层自身不要套 opacity 关键帧动画，解锁退场动画只动 transform。
   开机(boot)阶段保持完全遮住（透明度 1），进入锁屏阶段再淡出到 0.72。

2. 时段问候语：logo 下方、名称上方，根据 useNow 的小时数显示：
   5-11「早上好，旅行者 ✦」/ 11-14「中午好，旅行者 ✦」/ 14-18「下午好，旅行者 ✦」/
   18-23「晚上好，旅行者 ✦」/ 23-5「夜深了，注意休息 ✦」。
   样式：text-[13px] text-white/85 tracking-wide，淡入。

3. 开机天亮效果：boot 阶段给壁纸层加 filter: brightness(0.55)，随进度条
   （progress state 已存在）线性过渡到 1：直接 style={{ filter: `brightness(${0.55 + progress * 0.45})` }}，
   transition 用 linear 2.2s 或每帧更新（已是 rAF 驱动，直接内联即可，不加 transition）。

验收：开机时画面由暗变亮、进度条同步；锁屏阶段能隐约看到后面桌面的图标轮廓；
问候语按当前时段正确显示；解锁动画不回归；build 通过。
```

---

## 五、P1-1 真窗口管理器（架构项，最优先的 P1）

```text
把单实例 GameWindow 升级为多窗口管理器。

1. 新建 src/stores/windowStore.ts（Zustand，需 npm i zustand）：
   windows: Array<{ id: string; gameId: GameId; z: number; pos: {x,y}; size: {w,h};
   minimized: boolean; maximized: boolean }>,
   动作：open(gameId)（已开则聚焦）、close(id)、focus(id)（置顶 z=max+1）、
   minimize(id)、restore(id)、toggleMaximize(id)、move(id,pos)、resize(id,size)。

2. GameWindow.tsx 重构：从 store 读数据，渲染 windows.map()；
   保留现有标题栏拖拽（改为写 store），新增：右下角 resize 手柄（Pointer Events，
   最小尺寸 420×320）、双击标题栏 toggleMaximize（记住还原位置）、
   失焦窗口标题栏 filter: saturate(.4)、非最顶层窗口加更深阴影。

3. 最小化：点黄色灯 → 计算窗口到 Dock 中心的位置，用 transition transform+scale(0.1)+opacity
   飞向 Dock（500ms）后 minimized=true（DOM 保留 display:none）；从 Dock 点击恢复（反向）。
   Dock 图标下方加运行指示点：有最小化/打开窗口的游戏显示 4px 白点（macOS 风格）。
   Dock 需要新增四个游戏入口项（分隔线后），点击 open/restore。

4. Esc 关闭最顶层窗口；⌘W 同。⌘1..4 打开对应游戏（KeyDown 监听，metaKey||ctrlKey）。

5. 红线自查：窗口开/关/最小化动画只用 transform+opacity；
   .os-window 已是实色背景，不要加回 backdrop-filter。

验收：同时开 3 个窗口，点击置顶顺序正确；最小化飞入 Dock、指示点出现、点击恢复；
双击标题栏最大化/还原；⌘W/⌘1..4 可用；build 通过 + 生产模式自测。
```

---

## 六、P1-2 右键菜单系统

```text
新建 components/desktop/ContextMenu.tsx + src/stores/contextMenuStore.ts（Zustand）。

1. 全局 contextmenu 事件拦截（Desktop 根层 preventDefault），按 target 分发菜单配置：
   - 桌面壁纸空白：更换主题（子菜单：晴空/星轨/苔原/深夜，带色点）、整理图标、刷新数据(开发中禁用)
   - 游戏图标：打开、固定到 Dock(开发中禁用)、移除(开发中禁用)
   - Dock 图标：打开 / 从 Dock 移除(开发中禁用)
2. 菜单样式复用 .os-drop（现有下拉菜单的玻璃面板），菜单项复用 .menu-item；
   出现动画 scale 0.96→1 淡入 120ms；点击外部/Esc 关闭；屏幕边缘自动翻转防溢出。
3. 菜单配置化：定义 MenuConfig = { items: Array<{ label; shortcut?; disabled?; danger?; onClick?; children? }> }。

验收：三处右键菜单内容正确、位置不溢出屏幕；左键/Esc 关闭；与主题联动换色即时生效；
build 通过。
```

---

## 七、P1-3 组件栏升级（可在数据接入前先做壳）

```text
改造 WidgetPanel.tsx，对齐原站的信息密度与交互：

1. 2×2 游戏小卡：整卡可点击（单击直接开游戏窗口，stopPropagation 防触发桌面取消选中），
   hover 抬升 2px + 边框亮起；角标位置预留（接 P0-3 的 badge 数据）。
2. Now Playing 大卡（新增，放在 2×2 上方）：未接入数据时显示占位态——
   大封面框(16:9 灰底+播放图标)+「暂无游戏在运行」+副文案「接入 Steam 后实时显示」；
   预留 props 接口 { game?, since? }。
3. 本周时长：柱状图加 hover tooltip（absolute 定位小气泡，显示「周X · —小时」）；
   今天柱子有呼吸动画（opacity 0.8↔1，2s，transform 实现不行就用 opacity——
   注意红线1：该柱子不含 backdrop-filter，可以用 opacity 动画）。
4. 新增成就流卡（占位壳）：横向滚动容器，5 个成就占位卡（奖杯 emoji + 灰条），
   注释标明数据接口 { name, icon, rarity, unlockedAt }[]。
5. 编辑模式：面板标题区右上角加「编辑」按钮 → 进入后所有卡片轻微抖动
   （rotate ±1deg，0.3s 交替，纯 transform）、每卡左上角出现隐藏按钮（眼睛图标），
   点隐藏则该卡从面板消失并存入 localStorage；「完成」退出。刷新后保持。

验收：小卡可点击开窗；编辑模式抖动/隐藏/持久化正常；滚动流畅无布局跳动；
build 通过 + 自测。
```

---

## 八、P1-4 响应式 + P1-5 快捷键（合并任务）

```text
1. 组件抽屉（<lg 视口）：组件栏当前 hidden lg:flex 直接消失——改为：
   菜单栏右侧（时钟左边）新增网格图标按钮，点击后组件面板以
   translate-x 全宽抽屉从右滑出（含遮罩，backdrop 黑/30），再点关闭。
   实现方式：WidgetPanel 加 open prop，<lg 时受控抽屉、≥lg 保持常驻。
2. 触屏：@media (pointer: coarse) 下——桌面图标单击直接 onOpen（跳过双击）；
   窗口标题栏拖拽已用 Pointer Events 无需改；Dock hover 效果改 active。
3. 快捷键（Desktop 根层统一监听）：Esc 关闭最顶层窗口/菜单/抽屉；
   ⌘/Ctrl+W 关最顶层窗口；⌘/Ctrl+1..4 打开对应游戏（与 windowStore 对接）。
   在菜单栏「视图」菜单底部列出快捷键说明（灰色小字）。
4. 图标标签 md 以下隐藏（只留图标），锁屏大时钟字号在窄屏用 min(30vw,28vh)。

验收：900px 宽窗口下组件从抽屉开合、遮罩正常；触屏模拟（DevTools）单击开图标；
快捷键全部生效且不影响浏览器默认行为（只在游戏打开时拦截 ⌘W 用 preventDefault）；
build 通过。
```

---

## 九、P2 彩蛋池（按需逐个发）

```text
每个彩蛋独立一句话提示词（都需要先贴通用上下文）：

· 动态壁纸：globals.css 增加 dawn/day/dusk/night 四组渐变（当前 sky 为基础微调色相），
  LockScreen 与 Desktop 的壁纸层按真实时间在相邻两组间线性插值（JS 每分钟算一次
  插值系数，输出为 CSS 变量 --dawn-blend），主题选择器加「自动」档（默认关闭）。

· 游戏主题联动：windowStore 的最顶层窗口游戏决定壁纸主题；设置菜单加
  「主题跟随游戏」开关（默认开）。手动选主题时自动关闭联动。

· 年度报告页：新增 /report 路由，全屏深色沉浸页，分 5 屏滑动叙事
  （总时长/最爱的游戏/成就数/连续天数/年度关键词），数据占位，结尾「分享海报」按钮占位。

· 桌面小部件：组件卡可拖到桌面（复用窗口拖拽逻辑），位置存 localStorage，
  与右侧栏互斥（拖出即从栏中移除，双击卡片收回）。

· 便签 App：Dock 新增便签图标，开窗为 320×400 便签，内容 localStorage 持久化，
  支持多张（左上角 + 号），黄色纸质感。

· 音效：public/sounds/ 放 boot.mp3/unlock.mp3/achievement.mp3（先留空文件占位），
  音效管理器单例，设置菜单加开关（默认关），播放用 HTMLAudioElement，音量 0.4。

· 派蒙助手：右下角 64px 圆形入口（原图标），点击弹出气泡对话框
  （打字机效果输出预设提示语），可拖拽位置，localStorage 记忆。
```

---

## 十、每个任务完成后的固定验收话术

```text
完成后必须：① npm run build 零报错；② npm run start -- --port 3000 起生产服务；
③ 用浏览器逐项核对上面列的验收点并截图；④ 确认既有功能（主题/锁屏/开窗/关窗）无回归；
⑤ 列出本次改动的文件清单和每个文件改了什么。
```
