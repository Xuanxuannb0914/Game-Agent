# Game-Agent 下一阶段提示词集（真 Live2D + 桌面体验深化 + 工程化上线）

> 用法：每条提示词独立可用。发给 AI 编程工具前，先粘贴【〇、通用上下文】，再粘贴对应任务提示词。
> 建议一次一个任务，做完验收再下一个。L0 必须最先做（排雷）；L1/L2 是人工任务，不是 AI 编程任务。
> 里程碑编号与路线图一致：L0–L4（真 Live2D）、E1–E5（体验 + 工程化）。

## 路线图与依赖

| 里程碑 | 内容 | 类型 | 依赖 | 预估 |
|---|---|---|---|---|
| L0 | 真 Live2D 链路验证（排雷） | Agent | 无 | 0.5–1 天 |
| L1 | 素材补画（13 张图层） | 人工/美术 | 无 | 1–3 天 |
| L2 | Cubism 建模导出 moc3 | 人工/建模师 | L1 | 3–5 天 |
| L3 | 集成回归 | Agent | L2 | 0.5 天 |
| L4 | 表现力增强（可选） | Agent | L3 | 1–2 天 |
| E1 | ⌘K 命令面板 + 通知中心 | Agent | 无 | 2–3 天 |
| E2 | 多工作区 / 多桌面 | Agent | 无 | 2–3 天 |
| E3 | 触屏与窄屏降级 | Agent | 无 | 1–2 天 |
| E4 | 测试 + 性能 + 无障碍 | Agent | E1–E3 | 2–3 天 |
| E5 | 部署上线 | Agent | E4 | 1–2 天 |

两条线并行：L1/L2 是人力排期，不阻塞主线；E1→E5 顺序推进，E4 的 E2E 要覆盖前面所有交互。

---

## 〇、通用上下文（每次都先粘贴这段）

```text
项目：Game-Agent —— 模仿 macOS 的「伪操作系统」二次元游戏聚合桌面。
技术栈：Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + Zustand。

目录约定：
- 桌面根组件 src/components/desktop/Desktop.tsx（主题、锁屏、快捷键、右键菜单分发、toast 都在这里）
- 窗口系统 src/stores/windowStore.ts（windows[] / topZ / open / close / focus / minimize / restoreWin /
  toggleMaximize / move / resize；导出 topWindowId()、hasApp()）
- 其他 store：settingsStore（followGame / soundOn / cursor）、widgetStore（浮动小组件）、
  noteStore、contextMenuStore
- 游戏元数据 src/lib/games.ts（GAMES / GameId / ThemeId / GAME_THEME / THEMES）
- 派蒙 Live2D：src/components/desktop/PaimonAssistant.tsx
  + src/lib/live2d/paimonModel.ts（mountPaimon() 三级回退入口）
  + src/lib/live2d/paimonRig.ts（PaimonController：setGaze / setDragging / pulseMouth / playTap / destroy）
- 全局样式与主题变量 src/app/globals.css（[data-os="sky|violet|green|dark|auto"]）
- 本地启动接口 src/app/api/launch/route.ts（Node runtime，按 games.ts 的 exePath 启动本地程序）
- 动效工具 src/lib/motion.ts（usePrefersReducedMotion）

【技术红线，违反会出渲染事故】
1. 含 backdrop-filter 的元素（.glass-*、.lock-pill、Dock 等）禁止套 opacity 关键帧动画
   （@keyframes + fill-mode 会触发合成层冻结/鬼影，已踩坑两次）；改用 transition 或只动 transform。
2. 动画只允许 transform/opacity；不要用 width/height/top/left 做动画
   （进度条类需求用 JS 时钟 + rAF，先例见 LockScreen.tsx）。
3. 每个新动效必须在 @media (prefers-reduced-motion: reduce) 下禁用。
4. 本机 Turbopack dev 热更新会死循环：验证一律用生产模式 ——
   npm run build && npm run start -- --port 3000，浏览器打开 http://localhost:3000 自测。
5. 环境：若 npm 不在 PATH，用 PATH="$HOME/.npm-cli/shims:$PATH" 前缀执行 npm 命令。

【通用验收】
- npm run build 通过（0 error）。
- 生产模式浏览器自测通过，截图确认视觉效果。
- 既有功能无回归：锁屏解锁、双击开窗、多窗口置顶/最小化/最大化、右键菜单、
  主题切换、便签、浮动小组件、派蒙气泡。
```

---

## 一、L0 · 真 Live2D 链路验证（排雷，必须最先做）

```text
目标：验证「真 Live2D（.moc3）在本项目技术栈下能不能跑通」。现在
src/lib/live2d/paimonModel.ts 的第 1 级（moc3）代码路径从未被真实模型验证过，
这是当前最大的隐藏不确定性，必须先排雷。本任务不产出正式模型，只用免费示例模型验证链路。

前置：public/live2d/live2dcubismcore.min.js 已存在。

任务：
1. 取一个免费可用的 Cubism 4 示例模型（如 Live2D 官方 Haru / Hiyori 示例，或任一社区免费模型），
   放到正式探测路径 public/live2d/paimon/ 下，命名为 paimon.model3.json（连同 .moc3 与 textures/ 目录，
   保持 model3.json 内引用的相对路径完整）。第 1 级会自动接管，无需改任何代码。
   记录模型来源与授权，不得使用盗版或未授权模型。
2. 在生产模式下逐条验证并记录结果：
   a) Cubism Core 是否正确注入（window.Live2DCubismCore 存在）；
   b) pixi.js + pixi-live2d-display 能否动态 import 并创建 Application（无 SSR 报错、无打包报错）；
   c) 模型能否加载并渲染到右下角，层级不遮挡菜单栏/窗口/派蒙气泡；
   d) 参数驱动是否生效：注视鼠标（ParamAngleX/Y + ParamEyeBallX/Y）、自动眨眼、
      打字机口型（ParamMouthOpenY）；
   e) 交互是否正常：拖拽时 setDragging 回正头部、点击 playTap、位置记忆（localStorage）；
   f) destroy() 是否彻底释放 WebGL / 纹理 / rAF / 事件监听 —— 反复挂载卸载 10 次无内存增长、无报错。
3. 若失败，定位根因（依赖版本不匹配 / Core 版本偏低 / 打包或 SSR 问题）并给出最小修复方案；
   若需要更高版本的 live2dcubismcore.min.js，说明版本并要求替换。

产出：
- docs/live2d/05-pipeline-verification.md：逐项验证结果 + 复现步骤 + 已知坑 + 修复清单。
- 结论必须明确：第 1 级「可用 / 不可用 / 需满足什么条件」。

验收：
- 生产模式下示例模型被第 1 级加载并动起来（附截图）；
- 验证报告齐全、结论明确；
- 验证完成后删除 public/live2d/paimon/ 下的示例模型，让项目回到第 2 级 rig（避免误当成正式模型提交）。

红线：本任务只做验证，不得改变正式回退链行为；不得引入新依赖（除非证明必要并说明理由）。
```

---

## 二、L1 · 素材补画（人工/美术任务，非 AI 编程）

```text
对象：美术，在 Photoshop / Clip Studio 中人工完成。
依据：docs/live2d/03-redraw-checklist.md（13 张底图在 assets/live2d/paimon/redraw/）。

交付：
1. A 组 8 张「补被遮挡区域」：Hair_Back / Face / Body / Arm_L / Arm_R / Cape_Front / Hand_L / Hand_R
2. B 组 5 张「新增状态」：Eye_Closed_L / Eye_Closed_R / Mouth_Open / Brow_L / Brow_R

硬性规范：
- 尺寸严格 407×820，RGBA 透明背景，每部件一个文件，文件名与 assets/live2d/paimon/layers/ 完全一致；
- 只做「加画」：现有像素不得覆盖、移动、重新上色；
- 不合并图层，不输出带背景的图。

配色（直接取 03 文档 §2 采样值）：
肤色 #FAD3D4、头发白 #FCF8FA、披风内衬 #22255F、发饰金 #ECAE7B、
虹膜蓝 #4C9EEA、线稿/睫毛 #483458、唇线 #813A5B、张嘴口腔 #6E2B44、眉毛 #E6D6E2。

顺序（先底层后上层，颠倒会返工）：
Hair_Back → Face → Body → Cape_Front → Arm_L/Arm_R → Hand_L/Hand_R → 五官状态。

可选 AI 辅助（质量不达标就退回人工）：用图像修复（inpainting）工具按洋红区域补画，
提示词示例：「保持 407×820 画布、与周围 18% 参考层精确对齐，在洋红区域补画 <部件名> 的缺失部分，
风格与原图一致（赛璐璐二次元，线稿 #483458），用色遵循给定色板，只输出该图层的 RGBA 结果，不合并其它层」。

验收：
- 用 layers/ 全部图层叠加重建后，未补画区域与 public/paimon-pet.png 逐像素一致；
- 覆盖回 layers/ 后重跑 python3 scripts/live2d/segment.py 复核通过；
- 03 文档 §5 完成自检清单逐条打勾。
```

---

## 三、L2 · Cubism 建模与导出（人工/建模师任务，非 AI 编程）

```text
对象：Live2D 建模师，在 Cubism Editor 中人工完成。
依据：docs/live2d/02-cubism-modeling-spec.md。
输入：L1 完成后的 assets/live2d/paimon/layers/*.png（407×820 同坐标分层）。

产出目录：public/live2d/paimon/
  paimon.model3.json / paimon.moc3 / paimon.physics3.json / paimon.cdi3.json
  textures/texture_00.png ...
  motions/idle_00.motion3.json ...
  expressions/normal.exp3.json ...

必须实现（与规格书逐条对应）：
- 参数：ParamAngleX/Y/Z、ParamEyeBallX/Y、ParamEyeLOpen/ROpen、
  ParamMouthOpenY/ParamMouthForm、ParamBodyAngleX/Z、ParamBreath
- 绘制顺序：Hair_Back(0) → 身体(1..11) → Face(12) → Hair_Tip(13) → Hair_Front(14)
  → 眼睛(15..18) → 嘴(19..20) → Star_Ornament(21)
- 支点（源图 407×820 坐标）：脖子(193,272)、身体(193,700)、呆毛(193,58)、
  发饰(259,120)、脚底(203.5,816)
- 动作：idle / tap / drag / wave；表情：normal / smile / happy / surprised
- 物理：头发 + 披风；闭眼/张嘴用不透明度联动（与睁眼/闭嘴版叠放）

导出后自检：参数 ID 与规格书完全一致；在 Cubism Viewer 中四动作、四表情可正常播放，物理自然。

验收：上述文件齐全；前端无需改任何代码，第 1 级自动接管（由 L3 验证）。
```

---

## 四、L3 · 集成回归（Agent）

```text
前置：L2 已导出 public/live2d/paimon/paimon.model3.json。

任务：验证真模型接管后的整条链路。
1. 第 1 级自动接管：确认不再加载 rig（pixi-live2d-display 生效、rig 资源未被请求）。
2. 回退链仍正确，逐级验证：
   - 临时改名 paimon.model3.json → 自动降到第 2 级 rig；
   - 再把 rig/rig.json 改坏 → 降到第 3 级静态图；
   - 设 NEXT_PUBLIC_PAIMON_LIVE2D=0 → 直接静态图。
   三级都失败时应用仍正常可用，不白屏、不报错。
3. 交互一致性：注视鼠标、待机眨眼/微摆、点击 playTap、拖拽 setDragging、打字机 pulseMouth
   全部正常，且与 rig 版本行为一致（同一 PaimonController 接口）。
4. 性能与内存：记录首帧时间与常驻内存；反复挂载/卸载 10 次无泄漏；
   窗口最小化或标签页隐藏时渲染是否暂停（如未暂停，说明优化空间）。
5. 无障碍：prefers-reduced-motion 下派蒙停止自主动画，保留静态显示。

验收：以上逐条通过 + 截图；控制台零报错；既有功能无回归；build 通过。
```

---

## 五、L4 · 表现力增强（可选，L3 通过后）

```text
1. 表情/动作与气泡对话联动：PaimonAssistant 的 MESSAGES 每条绑定表情与动作
   （问候 → smile + wave、提示 → normal、成就 → happy），说话时播放对应 motion，与打字机同步。
2. 口型与音效联动：若有 TTS 或音效，pulseMouth 跟随音量包络；无音源则维持按字符脉冲。
3. 多套皮肤/外观切换：设置页加派蒙外观选项，切换加载不同 model3.json（或不同贴图组），
   选择持久化到 localStorage。

验收：每条消息的表情/动作正确；切换外观后刷新保持；build 通过、无回归。
```

---

## 六、E1 · 交互补全：⌘K 命令面板 + 通知中心

```text
现状：Desktop.tsx 已有快捷键（Esc / ⌘W / ⌘1..4）与轻量 toast（2.6s 自动消失）；
无命令面板、无通知中心。本任务新增这两者。

一、⌘K 命令面板
新建 src/components/desktop/CommandPalette.tsx + src/stores/commandStore.ts。
1. ⌘/Ctrl+K 开关。在 Desktop.tsx 的 keydown 中加分支，并保持现有优先级链一致：
   命令面板 > 设置弹窗 > 抽屉 > 右键菜单 > 最顶层窗口。
2. 居中浮层，复用 .os-drop 玻璃材质，宽度 min(560px, 92vw)；输入框自动聚焦，实时过滤。
3. 数据源（配置化，便于扩展）：
   - 打开游戏：GAMES 全量 → useWindowStore.open(id)
   - 切换主题：THEMES → 复用 Desktop 的 handleTheme（带涟漪）
   - 打开便签：noteStore → openNote
   - 窗口操作：关闭 / 最小化 / 最大化最顶层窗口
   - 整理图标、打开设置
4. 键盘：↑↓ 选择、Enter 执行并关闭、Esc 关闭；鼠标 hover 同步高亮；空结果给提示文案。
5. 无障碍：role="dialog" + aria-label；焦点陷阱（Tab 不逃逸）；关闭后焦点归还触发元素。

二、通知中心
新建 src/components/desktop/NotificationCenter.tsx + src/stores/notificationStore.ts。
1. 通知模型：{ id, title, body?, icon?, at, read, action? }，动作 push / markAllRead / clear / remove。
2. 触发源：启动游戏结果（替换现有 toast，改为同时写入通知）；主题与设置变更；预留成就事件接口。
3. UI：菜单栏右侧铃铛 + 未读红点（数字角标）；点击从右上滑出面板（≤360px，最多 20 条）；
   条目可点击执行 action、可单条删除；提供「全部已读 / 清空」。
4. 保留轻量 toast 作为即时反馈（不删除），通知中心承担历史记录。
5. 与派蒙打通：重要通知（如成就）同时触发派蒙一条对应气泡文案。
   若 PaimonAssistant 未暴露接口，先加一个自定义事件（window.dispatchEvent）作为事件总线。

红线：面板与通知的进出动画只用 transform/opacity；含 backdrop-filter 的容器不得套 opacity 关键帧动画。
验收：⌘K 可全程键盘操作；通知可堆叠/已读/清除/跳转；未读角标正确；不影响既有快捷键与 toast；build 通过。
```

---

## 七、E2 · 多工作区 / 多桌面

```text
现状：src/stores/widgetStore.ts + FloatingWidgets.tsx 已实现「组件卡拖到桌面自由摆放」
（dockOut / move / dockIn，localStorage 持久化）。Desktop.tsx 的 <lg 组件抽屉也已实现。
本任务只补「多工作区 / 多桌面」这一项，不要重做浮动小组件与抽屉。

任务：
1. windowStore 扩展工作区维度：
   - WinState 增加 workspace: number；
   - 新增 workspaces（数量，默认 2）、activeWorkspace、switchWorkspace(n)、
     moveWindowToWorkspace(id, n)；
   - 所有已有动作（open / close / focus / minimize / restoreWin / toggleMaximize / move / resize）
     保持兼容，新窗口默认落在 activeWorkspace。
2. 切换快捷键：⌘/Ctrl+Shift+← / →（刻意避开浏览器前进/后退的 ⌘←/→）。
   在 Desktop.tsx 的 keydown 中实现；切换动画只用 transform + opacity（禁止改 top/left）。
3. 指示：菜单栏显示「工作区 1/2」小指示；Dock 运行指示点只统计当前工作区
   （或按工作区区分样式 —— 二选一，并说明选择理由）。
4. 持久化：工作区数量与各窗口归属写入 localStorage，刷新后恢复。
5. 边界：切到空工作区时给「空工作区」提示；关闭窗口后工作区归属清理正确。

验收：⌘⇧←/→ 切换流畅；窗口不丢失、z 栈在各工作区内正确；刷新后归属保持；
既有行为（置顶/最小化/最大化/⌘W）无回归；build 通过 + 生产模式自测。
```

---

## 八、E3 · 触屏与窄屏降级

```text
现状：<lg 的组件抽屉已实现（Desktop.tsx 的 drawerOpen + WidgetPanel 的 open/onClose）。
本任务补齐触屏与窄屏细节。

任务：
1. @media (pointer: coarse)：
   - 桌面图标单击直接启动/开窗（跳过双击）；
   - Dock 的 hover 放大效果改为 active；
   - 右键菜单改为长按触发（touchstart 计时 500ms，移动超过阈值即取消）。
2. 窄屏：
   - 图标英文标签在 md 以下隐藏（只留图标）；
   - 锁屏大时钟字号改为 min(30vw, 28vh)；
   - 检查所有 Fixed/Absolute 定位元素与抽屉宽度，确保无横向溢出。
3. 触屏窗口操作：标题栏拖拽与 resize 已用 Pointer Events，确认无需改动；
   把 resize 手柄的触屏命中区放大到 ≥24px。
4. 性能：触屏设备关闭派蒙的鼠标注视（无鼠标），保留待机动画。

验收：DevTools 触屏模拟下单击可开窗、长按出菜单；900px 宽下抽屉开合正常；
无横向滚动条；build 通过。
```

---

## 九、E4 · 测试 + 性能 + 无障碍

```text
现状：package.json 无任何测试依赖（无 vitest / playwright）。

任务：
1. 单测（Vitest）：
   - windowStore：open 去重并聚焦、z 递增、minimize/restoreWin、toggleMaximize 记忆并还原位置、close 清理；
   - widgetStore：dockOut / move / dockIn 与 localStorage 持久化；
   - settingsStore：followGame 读写、cursor 字段校验回退到默认值；
   - 纯函数：topWindowId / hasApp / 各 clamp 类布局计算。
2. E2E（Playwright）主链路：
   锁屏点击解锁 → 双击图标开窗 → 开第二个窗口验证置顶顺序 → 最小化 → 从 Dock 恢复 →
   ⌘W 关窗 → 切换主题（含涟漪）→ 打开 ⌘K 执行一条命令 → 刷新后窗口与浮动小组件位置保持。
3. 性能预算：
   - 首屏 JS ≤ 200KB（gzip）；
   - 封面图用 next/image 懒加载；
   - 动画抽检 60fps；
   - 报告超标项并给出优化（动态 import、拆包等）。
4. 无障碍：
   - 全键盘可达、Tab 顺序合理、focus-visible 可见；
   - 关键交互有 aria-label；
   - prefers-reduced-motion 下所有动画静态降级（含派蒙、涟漪、入场序列）。
5. 脚本：package.json 增加 test / test:e2e / typecheck，本地一条命令可跑。

验收：npm run test 与 npm run test:e2e 通过；性能预算有明确数字与结论；
无障碍抽检通过；build 通过。
```

---

## 十、E5 · 部署上线

```text
现状：无 Dockerfile 与部署配置。项目是 Next.js 16，且 /api/launch 依赖 Node runtime 启动本地程序。

任务：
1. 容器化：Dockerfile（多阶段：deps → build → runner，next.config 开 output: "standalone"）
   + docker-compose.yml。
   重要取舍：容器内无法直接启动宿主机的游戏程序 —— 必须明确说明「/api/launch 在容器部署下不可用」，
   并提供「宿主直跑（npm run build && npm run start）」作为需要启动本地游戏时的部署方式，在文档中写清。
2. 环境变量：整理清单（如 NEXT_PUBLIC_PAIMON_LIVE2D），提供 .env.example。
3. 文档：README 补「本地运行 / 生产构建 / 部署」三节 + 常见问题
   （Turbopack dev 死循环、Cubism Core 版本、模型文件缺失时的回退）。
4. 监控与容错：接入 Sentry（免费版，可选）；至少加全局 error boundary + 友好错误页。
5. 冒烟：构建镜像 → 起服务 → 跑 E4 的 E2E 关键子集。

验收：docker compose up 一条命令起服务；线上冒烟通过；README 步骤可被他人复现；build 通过。
```

---

## 十一、每个任务完成后的固定验收话术

```text
完成后必须：
① npm run build 零报错；
② npm run start -- --port 3000 起生产服务；
③ 用浏览器逐项核对上面的验收点并截图；
④ 确认既有功能（锁屏/开窗/关窗/置顶/最小化/右键菜单/主题/便签/浮动小组件/派蒙）无回归；
⑤ 列出本次改动的文件清单，以及每个文件改了什么。
```