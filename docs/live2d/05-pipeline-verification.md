# 阶段 5 · 真 Live2D（.moc3）管线验证报告

> 目的：验证「真 Live2D（`.moc3`）在本项目技术栈下能不能跑通」。
> 本文只做**验证**，不改变三级回退链行为、不引入新依赖。
> 前置背景见 [`04-rig-runtime.md`](./04-rig-runtime.md)，施工规格见
> [`02-cubism-modeling-spec.md`](./02-cubism-modeling-spec.md)。

---

## 0. 结论（TL;DR）

**第 1 级「真 Live2D（moc3）」在本项目技术栈下 —— 可用。**

在生产模式（`next build && next start`）下，一个真实 Cubism 4 示例模型被
`paimonModel.ts` 的第 1 级路径加载、渲染并驱动，全部 6 项验证（a–f）通过。

上线/替换正式模型需同时满足 4 个条件（见 [§5](#5-结论与条件)）：

1. Cubism Core 版本覆盖模型的 moc 版本（当前 Core = **5.1.0.0**，`latestMocVersion = 5`）；
2. `public/live2d/paimon/paimon.model3.json` 存在且内部引用全部可解析；
3. `model3.json` 的动作组名 / 表情名与 `paimonModel.ts` 的 `GROUP` / `EXPRESSIONS` 对齐；
4. 画布保持 `pointer-events: none`、容器保持 `z-index: 44`。

> 本次为**排雷验证**，用免费示例模型跑通链路；验证完成后已删除示例模型，
> 项目回到第 2 级 rig（见 [§7](#7-清理)）。

---

## 1. 验证环境

| 项 | 值 |
|---|---|
| Next.js | 16.3.8（App Router / Turbopack），**生产模式** `next build && next start --port 3000` |
| React | 19 |
| pixi.js | 7.4.3 |
| pixi-live2d-display | 0.5.0-beta（`pixi-live2d-display/cubism4`） |
| Cubism Core | `public/live2d/live2dcubismcore.min.js`（207 KB） |
| Core 版本 | `csmGetVersion() = 83951616` → `0x05010000` → **5.1.0.0** |
| Core 支持的最高 moc 版本 | `csmGetLatestMocVersion() = 5` |
| 验证用模型 | **Live2D 官方 Haru 示例模型**（`Haru.moc3` + `Haru.2048/texture_0{0,1}.png`） |

### 模型来源与授权

- **来源**：Live2D 官方 Cubism 示例仓库 `CubismWebSamples`（`develop` 分支），
  经 jsdelivr CDN 拉取。文件为 `Haru.moc3` / `Haru.2048/texture_*.png` /
  `Haru.physics3.json` / `Haru.pose3.json` / `Haru.cdi3.json` /
  `motions/haru_g_*.motion3.json` / `expressions/F0*.exp3.json`。
- **授权**：属 Live2D 官方示例素材，随 Cubism SDK 分发，可用于 Live2D 相关开发与测试。
- **用途**：**仅用于本次管线验证**，验证后立即从 `public/` 删除，未随项目分发、
  未用于任何正式产出。**未使用任何盗版或未授权模型。**
- **放置方式**：原样复制到 `public/live2d/paimon/`，文件重命名为 `paimon.*`
  （保持 `model3.json` 内相对路径完整），第 1 级自动接管，**未改任何加载代码**。

---

## 2. 逐项验证结果（a–f）

### a) Cubism Core 注入 —— ✅ PASS

`src/app/layout.tsx` 用 `next/script` 以 `beforeInteractive` 策略加载
`/live2d/live2dcubismcore.min.js`。运行期观测：

```json
{ "core": true, "v": 83951616, "latestMoc": 5 }
```

控制台输出 `Live2D Cubism SDK Core Version 5.1.0`。Core 在 React 水合前就绪，
`mountCubism()` 的 `window.Live2DCubismCore` 守卫通过。

### b) pixi.js 动态 import + Application 创建 —— ✅ PASS

- `mountCubism()` 内 `await import("pixi.js")` 与
  `await import("pixi-live2d-display/cubism4")` 均为**浏览器端动态 import**，
  生产构建 **0 error**，运行时无 SSR / 打包报错。
- `new PIXI.Application({ view: canvas, width:120, height:180, backgroundAlpha:0, autoStart:false, sharedTicker:false })`
  创建成功；实测 canvas 物理尺寸 **240×360**（`resolution` 取 `min(DPR,2)=2`）。
- **顺序保障**：两个重依赖都在 `fetch(paimon.model3.json)` 探测通过**之后**才加载。
  模型不存在时不会把 pixi 整包拉下来，也不会刷 404 —— 这条设计在本次验证中被确认有效。

### c) 模型加载、渲染与层级 —— ✅ PASS

- 模型经 `Live2DModel.from()` 加载成功，`app.stage.addChild(model)`，
  `anchor=(0.5,1)`、`scale=characterHeight/getSize()[1]`，渲染进右下角容器。
- 容器为 `fixed z-[44]`（`PaimonAssistant.tsx`），**低于**窗口层 / 菜单栏 / 抽屉 /
  设置弹层，派蒙气泡在容器内部叠于画布之上 —— **不遮挡菜单栏、窗口、气泡**。
- 帧抓取（`renderer.extract.canvas()`）保存的 `/tmp/cap.jpg` 中角色正常可见、
  背景透明、无黑底、无花屏。

### d) 参数驱动 —— ✅ PASS

参数写入统一注册在 `internalModel` 的 **`beforeModelUpdate`** 事件上：

```ts
const events = model.internalModel as unknown as EventedInternalModel;
events.on("beforeModelUpdate", applyParams);
```

该事件在 **motion → 表情 → 眨眼 → 注视 → 呼吸 → 物理 → 姿态** 全部算完、
**`coreModel.update()` 烘焙之前**触发，因此写入既不被库内建逻辑覆盖，也无一帧延迟。

| 行为 | 参数 | 写法 | 结果 |
|---|---|---|---|
| 注视（头部偏航） | `ParamAngleX/Y` | `addParameterValueById` | ✅ 见下 |
| 注视（眼球偏移） | `ParamEyeBallX/Y` | `addParameterValueById` | ✅ 见下 |
| 眨眼 | `ParamEyeLOpen/ROpen` | `setParameterValueById` | ✅ 见下 |
| 口型 | `ParamMouthOpenY` | `addParameterValueById` | ✅ 见下 |

- **注视**：对同一待机动作状态下的两帧 `gaze_l` / `gaze_r` 做区域化像素对比 ——
  **脸部区域 MAD ≈ 45–51**，而四肢 / 腿部区域 **< 13**。差异高度集中在面部（偏航旋转
  会让五官在头部轮廓内横向位移，但轮廓质心基本不动），确认为头部偏航 + 眼球偏移生效。
- **眨眼**：采样 `ParamEyeLOpen` 观测到在 **0 ↔ 1** 之间周期性变化（随机间隔约 2–5s，
  闭合约 170ms）。
- **口型**：`pulseMouth()` 与注视**共用同一条写入路径**（同一个 `applyParams`、
  同一个 `beforeModelUpdate`、同一个 `core` 对象），注视已被证明能到达渲染，
  故口型链路成立；模型侧 `has.mouth = true`。
- 模型参数存在性探测全部通过：

```json
{ "eyeL": true, "eyeR": true, "eyeballX": true, "eyeballY": true,
  "angleX": true, "angleY": true, "bodyAngleX": true, "mouth": true }
```

> ⚠️ 本节最初一度误判「注视 / 口型失效」，原因是**参数读回方法错误**——
> 详见 [§4 已知坑 1](#4-已知坑踩坑记录)。改用像素级对比后确认生效。

### e) 交互 —— ✅ PASS

| 交互 | 实现 | 结果 |
|---|---|---|
| 拖拽 | 外层容器 `pointerdown/move/up` → `setDragging(true/false)` | ✅ 拖拽中注视归零（头部回正）并触发 `Drag` 组动作，松开恢复注视 |
| 点击 | `onClick` → `playTap()` | ✅ 触发 `Tap` 组动作 + 随机表情（`smile`/`happy`/`surprised`） |
| 位置记忆 | `localStorage["ga:paimon-pos"]` | ✅ 拖拽落点持久化，重载后容器 `left/top` 恢复为上次落点 |

- 画布设 `pointer-events: none`，指针事件由外层容器独占处理，避免 Pixi 事件系统吞掉
  `pointerdown` 导致拖拽失效。

### f) `destroy()` 资源释放 —— ✅ PASS

连续 **mount → 120ms → destroy → 60ms** 循环 **10 次**：

```json
{ "errs": [], "canvasAfterEachMount": 1, "canvasAfterDestroy": 0,
  "jsHeapMB": 70 }
```

- 10 次挂载/卸载 **0 报错**；每次挂载后宿主内 canvas = 1，`destroy()` 后 canvas = 0
  （DOM 节点与 WebGL 上下文均释放）；
- `usedJSHeapSize` 稳定在 ~70 MB，**无明显增长**；
- `destroy()` 依次执行：`cancelAnimationFrame` → 移除 `visibilitychange` 监听 →
  `events.off("beforeModelUpdate", applyParams)` → `model.destroy()` →
  `app.destroy(true, { children: true })`，并带 `destroyed` 幂等守卫。

---

## 3. 复现步骤

```bash
# 1) 放入示例模型（保持 model3.json 内相对路径完整），第 1 级自动接管
#    目录：public/live2d/paimon/{paimon.model3.json, paimon.moc3, textures/,
#          motions/, expressions/, paimon.physics3.json, paimon.pose3.json,
#          paimon.cdi3.json, paimon.userdata3.json}

# 2) 生产模式构建 + 启动（红线：Turbopack dev 热更新会死循环，一律用生产模式）
npm run build && npm run start -- --port 3000

# 3) 打开 http://localhost:3000，等待开机动画（~2.2s）后点击解锁
```

浏览器控制台验证（示例）：

```js
// ① Core 注入
window.Live2DCubismCore.Version.csmGetVersion();      // 83951616 (5.1.0.0)
window.Live2DCubismCore.Version.csmGetLatestMocVersion(); // 5

// ② 模型是否挂载：观察右下角是否出现 canvas
document.querySelectorAll("canvas").length;            // ≥1

// ③ 参数驱动的正确观测姿势：必须在 beforeModelUpdate 内读
window.__probe = { n: 0 };
window.__paimonDebug.model.internalModel.on("beforeModelUpdate", () => {
  const c = window.__paimonDebug.core;
  window.__probe.angleX = c.getParameterValueById("ParamAngleX");
  window.__probe.mouth  = c.getParameterValueById("ParamMouthOpenY");
  window.__probe.n++;
});
// 强制注视后读 window.__probe.angleX（应随 setGaze 变化）

// ④ 像素级对比（最可靠）：对两个状态各取一帧做区域化 MAD
const frame = () => {
  const c = window.__paimonDebug.app.renderer.extract.canvas(window.__paimonDebug.app.stage);
  const t = document.createElement("canvas");
  t.width = c.width; t.height = c.height;
  t.getContext("2d").drawImage(c, 0, 0);
  return t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
};
```

> 若 `window.__paimonDebug` 不存在：本次验证用了一个**构建期临时钩子**
> （`NEXT_PUBLIC_PAIMON_VERIFY`，见 [§6 修复清单](#6-修复清单)）。
> 验证结束后该钩子已移除；复现时可按需临时加回，或直接在 DevTools 里
> 通过 React DevTools 拿到控制器实例。

---

## 4. 已知坑（踩坑记录）

1. **参数读回陷阱（本次最大发现，必读）**
   `pixi-live2d-display` 的 `InternalModel.update()` 每帧顺序为：

   ```
   saveParameters()                 // 快照（motion 之后）
     → 表情 / 眨眼 / 注视 / 呼吸 / 物理 / 姿态
     → emit("beforeModelUpdate")    // ← 我们的参数写在这里
     → coreModel.update()           // 烘焙（本帧渲染用这套值）
     → loadParameters()             // 恢复到上面那份快照
   ```

   `loadParameters()` 会把参数**还原**成 `saveParameters()` 的快照，
   所以在**帧后**调用 `getParameterValueById()` 读到的是「烘焙前被还原的中间态」，
   **根本反映不出我们写入的值**。本次一开始据此误判「注视 / 口型失效」，
   实为测量方法错误。
   **正确观测姿势**：(a) 在 `beforeModelUpdate` 内读；或 (b) 用
   `renderer.extract` 做像素级对比（最可靠）。

2. **动作组 / 表情名必须与代码常量严格一致**
   `paimonModel.ts` 中 `GROUP.tap = "Tap"`、`EXPRESSIONS = ["smile","happy","surprised"]`。
   官方 Haru 原始清单里动作组叫 **`TapBody`**、表情叫 **`F01/F02/F03`**。
   不改清单则 `playTap()` / 表情切换**静默失效**（代码里 `try/catch` 吞掉了错误，
   不报错也不生效，极易漏掉）。已在 `paimon.model3.json` 中改名对齐。

3. **后台标签页会冻结 rAF**
   组件监听 `visibilitychange`，`document.hidden` 时主动 `cancelAnimationFrame`（省电）。
   因此自动化截帧 / 读参时若标签页在后台，会拿到「冻结帧」，造成**假阴性**。
   验证时务必保持标签页前台。

4. **`autoInteract` 已废弃（仅告警，不影响功能）**
   pixi-live2d-display 0.5.0-beta 会对 `options.autoInteract` 抛
   `deprecated since v0.5.0, use autoHitTest and autoFocus instead`。
   当前传 `autoInteract:false, autoFocus:false` 仍生效；画布 `pointer-events:none`，
   命中测试不影响交互。

5. **画布必须 `pointer-events: none`**
   否则 Pixi 事件系统会消费 `pointerdown`，外层 React 容器收不到、拖拽失效
   （此前已踩过，见项目记忆）。

6. **`InternalModel` 的 `.d.ts` 缺 `on/off` 声明**
   0.5.0-beta 打包出的类型里 `utils.EventEmitter` 命名空间未解析
   （`dts-bundle-generator` 已知问题），TS 会报 `Property 'on' does not exist`。
   代码里用最小接口 `EventedInternalModel` 断言解决。

---

## 5. 结论与条件

### 结论

**第 1 级「真 Live2D（moc3）」= 可用。**

### 生效条件（正式模型上线前必须逐条满足）

1. **Core 版本覆盖模型的 moc 版本。** 当前 `live2dcubismcore.min.js` 为
   **5.1.0.0**，`latestMocVersion = 5`，可覆盖 Cubism Editor 5.x 导出的 moc3。
   若导出更高 moc 版本并报 `unsupported moc version`，**替换更高版本的
   `public/live2d/live2dcubismcore.min.js` 即可**（无需改代码）。
2. **`public/live2d/paimon/paimon.model3.json` 存在且内部引用完整可解析。**
   本次校验 21/21 条引用全部命中（`Moc` / `Textures` / `Physics` / `Pose` /
   `DisplayInfo` / `UserData` / `Motions` / `Expressions`）。
3. **清单命名与代码对齐：**
   `Motions` 键需含 `Idle` 与 `Tap`；`Expressions[].Name` 需含
   `smile` / `happy` / `surprised`。
4. **渲染约定不变：** 画布 `pointer-events: none`；容器 `z-index: 44`。

### 未覆盖 / 残留风险

- 本次仅用 **Cubism 4** 的官方 Haru 示例验证。**Cubism Editor 5.x 新导出的 moc3
  未实测**，但 Core 5.1.0.0 声明支持到 moc v5，理论上覆盖。
- 口型为**链路级确认**（与注视共用同一写入路径），未做独立像素帧对比；
  正式模型上线后建议补一次目视复核。
- 未做长时间（>10 分钟）内存与 GPU 稳定性压测；10 次挂载/卸载循环无泄漏。

---

## 6. 修复清单

| # | 类型 | 内容 | 状态 |
|---|---|---|---|
| 1 | 模型侧 | `paimon.model3.json`：动作组 `TapBody` → `Tap` | ✅ 已改（验证用） |
| 2 | 模型侧 | `paimon.model3.json`：表情名 `F01/F02/F03` → `smile/happy/surprised` | ✅ 已改（验证用） |
| 3 | 代码侧 | `paimonModel.ts`：补 `EventedInternalModel` 最小接口，解决 `.d.ts` 缺 `on/off` 的 TS 报错 | ✅ 已改（长期保留） |
| 4 | 代码侧 | `paimonModel.ts`：移除验证用临时钩子（`NEXT_PUBLIC_PAIMON_VERIFY` 分支） | ✅ 已移除（验证后清理） |
| 5 | 正式模型 | 在 Cubism Editor 中**直接按 `Tap` / `smile·happy·surprised` 命名**动作组与表情，避免导出后再改清单 | ⬜ 建模时执行 |
| 6 | 正式模型 | 确认导出 moc 版本 ≤ 5；若更高，替换更高版本 Cubism Core | ⬜ 建模时执行 |

> **依赖变更：无。** 全程未新增任何依赖。

---

## 7. 清理

验证完成后：

- 已删除 `public/live2d/paimon/` 下的**示例模型文件**
  （`paimon.model3.json` / `paimon.moc3` / `textures/` / `motions/` /
  `expressions/` / `paimon.physics3.json` / `paimon.pose3.json` /
  `paimon.cdi3.json` / `paimon.userdata3.json`），
  保留 `rig/`（第 2 级素材）与 `README.md`。
- 已移除 `src/lib/live2d/paimonModel.ts` 中的验证临时钩子。
- 结果：第 1 级探测失败（`fetch(model3.json)` 404）→ 自动降级到**第 2 级 rig**，
  回退链行为与验证前**完全一致**。

> 三级回退链的**代码路径未被改变**；本次对正式代码的唯一长期改动是第 6 节第 3 条
> 的类型补丁（纯类型，无运行时行为差异）。