# 阶段 2 · 派蒙 Live2D 建模规格书（Cubism Editor）

> 目标：把 `assets/live2d/paimon/layers/` 的分层素材，在 **Live2D Cubism Editor** 中
> 建成一个可被 `pixi-live2d-display`（cubism4 入口）驱动的模型，导出到 `public/live2d/paimon/`。
> 本文件是**给建模师的施工图**；前端（阶段 3）按此规格的命名来驱动模型，命名不一致会导致动不起来。
>
> ⚠️ **在 moc3 就位之前，前端已经能用**：`.moc3` 无法由脚本生成（只能 Cubism Editor 的
> GUI 导出），所以阶段 3 先用参数化骨骼 rig 顶上，参数语义与本规格一致。
> 详见 [`04-rig-runtime.md`](./04-rig-runtime.md)。本规格仍是最终形态的施工图。

---

## 0. 前置：工具与版本

| 项 | 要求 |
|---|---|
| Cubism Editor | **5.x**（推荐 5.1+；4.2 亦可，但导出 moc3 版本需 ≤ 运行时 Core 支持的版本） |
| Cubism Core（运行时） | 已放置于 `public/live2d/live2dcubismcore.min.js` |
| Core 校验 | `sha256 = 25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f`，207,155 bytes |
| 导出格式 | `.moc3` + `motion3.json` + `exp3.json` + `physics3.json`（即 Cubism 4/5 格式） |

> ⚠️ **版本兼容**：`.moc3` 的版本号由 Editor 决定，必须 **≤** 运行时 Core 支持的最新版本。
> 若加载报 "unsupported moc version"，用更高版本的 Core 覆盖 `public/live2d/live2dcubismcore.min.js` 即可。

---

## 1. 图层与绘制顺序（Draw Order）

从后往前（数值越小越靠后）。Cubism 中「部件」按此顺序排列：

| 顺序 | 部件 ID | 对应素材 | 备注 |
|---:|---|---|---|
| 10 | `PartHairBack` | `Hair_Back` | 后发，需先补成完整头型 |
| 20 | `PartCapeBack` | `Cape_Back` | 披风内衬（藏青） |
| 30 | `PartBody` | `Body` | 连衣裙主体 |
| 40 | `PartLegL` | `Leg_L` | |
| 45 | `PartLegR` | `Leg_R` | |
| 50 | `PartBootL` | `Boot_L` | |
| 55 | `PartBootR` | `Boot_R` | |
| 60 | `PartArmL` | `Arm_L` | 举起的手臂 |
| 65 | `PartArmR` | `Arm_R` | 垂下的手臂 |
| 70 | `PartCapeFront` | `Cape_Front` | 白色披风外层（含胸口金星） |
| 75 | `PartHandL` | `Hand_L` | |
| 80 | `PartHandR` | `Hand_R` | |
| 90 | `PartHead` | `Head`（由 `Face` + 头部轮廓补画合成） | 脸+耳+颈 |
| 100 | `PartBrowL` | `Brow_L` | 需新增绘制 |
| 105 | `PartBrowR` | `Brow_R` | 需新增绘制 |
| 110 | `PartEyeL` | `Eye_L` / `Eye_Closed_L` | 两个 ArtMesh 用 `ParamEyeLOpen` 切换透明度 |
| 115 | `PartEyeR` | `Eye_R` / `Eye_Closed_R` | 同上，用 `ParamEyeROpen` |
| 120 | `PartMouth` | `Mouth_Closed` / `Mouth_Open` | 用 `ParamMouthOpenY` 切换 |
| 130 | `PartHairFront` | `Hair_Front` | 刘海 |
| 140 | `PartHairTip` | `Hair_Tip` | 呆毛 |
| 150 | `PartOrnament` | `Star_Ornament` | 金色发饰 |

**眼部实现要点**：`Eye_L`（睁开）与 `Eye_Closed_L`（闭眼）叠放，
绑定 `ParamEyeLOpen`：`0` 时睁眼 ArtMesh 不透明度 0、闭眼为 100；`1` 时相反。
在 Cubism 中用「不透明度」参数联动实现（不要用切换部件显隐，否则无法平滑眨眼）。

---

## 2. 参数（Parameters）— 必须使用 Cubism 标准 ID

前端通过 `coreModel.setParameterValueById()` 直接驱动下列参数，**ID 拼写必须完全一致**。

### 2.1 视线 / 头部

| 参数 ID | 范围 | 默认 | 说明 | 前端驱动 |
|---|---|---|---|---|
| `ParamAngleX` | -30 … 30 | 0 | 头部左右转 | 注视鼠标 / 拖拽 |
| `ParamAngleY` | -30 … 30 | 0 | 头部上下 | 注视鼠标 |
| `ParamAngleZ` | -30 … 30 | 0 | 头部倾斜 | 待机微摆 |
| `ParamEyeBallX` | -1 … 1 | 0 | 眼球左右 | 注视鼠标 |
| `ParamEyeBallY` | -1 … 1 | 0 | 眼球上下 | 注视鼠标 |

### 2.2 眨眼

| 参数 ID | 范围 | 默认 | 说明 |
|---|---|---|---|
| `ParamEyeLOpen` | 0 … 1 | 1 | 左眼睁开度，`0` = 全闭 |
| `ParamEyeROpen` | 0 … 1 | 1 | 右眼睁开度 |

> 眨眼由前端定时器驱动（约每 3–5 秒一次，闭合 ~120ms），也可在 `idle` motion 内嵌。
> **两者取其一**，避免叠加导致抽搐。本规格采用 **前端驱动眨眼**（更可控，见阶段 3）。

### 2.3 口型

| 参数 ID | 范围 | 默认 | 说明 |
|---|---|---|---|
| `ParamMouthOpenY` | 0 … 1 | 0 | 嘴张开度，打字机每输出 1 字拉高后衰减 |
| `ParamMouthForm` | -1 … 1 | 0 | 嘴角形状，`1`=笑，`-1`=撇嘴 |

### 2.4 身体 / 呼吸

| 参数 ID | 范围 | 默认 | 说明 |
|---|---|---|---|
| `ParamBodyAngleX` | -10 … 10 | 0 | 身体左右倾 |
| `ParamBodyAngleZ` | -10 … 10 | 0 | 身体侧倾（漂浮感） |
| `ParamBreath` | 0 … 1 | 0 | 呼吸循环，驱动胸腔/肩部起伏 |

### 2.5 头发 / 披风物理输入（供物理演算读取）

| 参数 ID | 范围 | 说明 |
|---|---|---|
| `ParamHairFront` | -1 … 1 | 刘海摆动输入 |
| `ParamHairBack` | -1 … 1 | 后发摆动输入 |
| `ParamCape` | -1 … 1 | 披风摆动输入 |

### 2.6 手臂（用于 wave / drag）

| 参数 ID | 范围 | 说明 |
|---|---|---|
| `ParamArmLA` | 0 … 1 | 左臂抬起（挥手动作主控） |
| `ParamArmRA` | 0 … 1 | 右臂 |

---

## 3. 动作（Motions → `motion3.json`）

放在 `public/live2d/paimon/motions/`。前端按**文件名前缀**触发（`idle_`、`tap_`、`wave_`、`drag_`）。

| 动作名 | 文件名 | 时长 | 循环 | 内容要点 | 触发时机 |
|---|---|---|---|---|---|
| idle | `idle_00.motion3.json` | 4.0s | ✅ | 呼吸（`ParamBreath` 0→1→0）+ 身体轻微漂浮（`ParamBodyAngleZ` ±3）+ 呆毛轻摆（`ParamHairFront` ±0.4）+ 头部微摆（`ParamAngleZ` ±2） | 待机时每 6–12s 随机播放 |
| idle | `idle_01.motion3.json` | 5.0s | ✅ | 变体：眨眼一次 + 视线游移 | 同上，随机二选一 |
| tap | `tap_00.motion3.json` | 1.2s | ❌ | 受惊：头微后仰（`ParamAngleY` -8）→ 回弹，眼睛睁大（`ParamEyeLOpen/ROpen` 1.2 峰值），嘴微张 | 点击派蒙 |
| tap | `tap_01.motion3.json` | 1.5s | ❌ | 开心：点头（`ParamAngleY` +10）+ 微笑（`ParamMouthForm` → 1） | 点击派蒙（随机） |
| wave | `wave_00.motion3.json` | 2.5s | ❌ | 挥手：`ParamArmLA` 0→1，前臂左右摆 2 次 + 身体微倾 | 长时间未交互 / 首次出现 |
| drag | `drag_00.motion3.json` | 1.0s | ✅ | 被拖拽：身体后倾（`ParamBodyAngleX` ±6）、呆毛与后发甩动、双臂微抬 | 拖拽中循环 |

**规范**：
- 每个动作的**首尾帧必须回到默认姿态**（除循环动作外），避免状态残留。
- `tap`/`wave` 用 `Loop = false`，`idle`/`drag` 用 `Loop = true`。
- 淡入淡出建议 `FadeIn = 0.3s`、`FadeOut = 0.3s`。

---

## 4. 表情（Expressions → `exp3.json`）

放在 `public/live2d/paimon/expressions/`。前端按文件名触发（`normal` / `smile` / `happy` / `surprised`）。

| 表情 | 文件名 | 参数设置 |
|---|---|---|
| normal | `normal.exp3.json` | 全部参数默认值（`ParamMouthForm = 0`，眼睛 1） |
| smile | `smile.exp3.json` | `ParamMouthForm = 0.6`，`ParamEyeLOpen/ROpen = 0.9`，嘴角上扬 |
| happy | `happy.exp3.json` | `ParamMouthForm = 1`，`ParamEyeLOpen/ROpen = 0.7`（笑眼），`ParamAngleZ = 3` |
| surprised | `surprised.exp3.json` | `ParamEyeLOpen/ROpen = 1.3`，`ParamMouthOpenY = 0.5`，`ParamBrow*Y` 上抬 |

> 表情与动作**可叠加**（表情改参数值，动作做时间轴），Cubism 中注意参数叠加策略设为「覆盖」还是「加算」。

---

## 5. 物理演算（`physics3.json`）

用 Cubism 的物理演算设置（Physics）绑定以下「摇摆链」，实现头发与披风跟随：

| 摇摆链 | 输入参数 | 输出参数 | 建议设置 |
|---|---|---|---|
| 后发（3 段） | `ParamAngleZ` / `ParamAngleX` / `ParamHairBack` | 后发 ArtMesh 的旋转变形器 | 长度 8，移动 0.8，延迟 1.0，加速度 1.5 |
| 刘海（2 段） | `ParamAngleZ` / `ParamHairFront` | 刘海变形器 | 长度 6，移动 0.9，延迟 0.8 |
| 呆毛（2 段） | `ParamAngleZ` / `ParamHairFront` | `Hair_Tip` 变形器 | 长度 5，移动 1.0，延迟 0.6（更活泼） |
| 披风内衬（3 段） | `ParamBodyAngleX` / `ParamBodyAngleZ` / `ParamCape` | 披风变形器 | 长度 9，移动 0.6，延迟 1.4（更沉） |
| 胸口星饰（1 段） | `ParamBodyAngleZ` | 星饰变形器 | 长度 3，移动 0.5 |

---

## 6. 导出目录结构（必须完全一致）

```
public/live2d/paimon/
├── paimon.model3.json          # 入口，前端加载这个
├── paimon.moc3                 # 模型本体
├── paimon.physics3.json        # 物理
├── paimon.cdi3.json            # 参数/部件显示名（可选但建议）
├── paimon.pose3.json           # 姿势（可选）
├── textures/
│   └── texture_00.png          # 图集（建议 ≤2048×2048，PNG）
├── motions/
│   ├── idle_00.motion3.json
│   ├── idle_01.motion3.json
│   ├── tap_00.motion3.json
│   ├── tap_01.motion3.json
│   ├── wave_00.motion3.json
│   └── drag_00.motion3.json
└── expressions/
    ├── normal.exp3.json
    ├── smile.exp3.json
    ├── happy.exp3.json
    └── surprised.exp3.json
```

`paimon.model3.json` 中 `FileReferences` 的路径**必须是相对本文件的路径**，例如：

```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "paimon.moc3",
    "Textures": ["textures/texture_00.png"],
    "Physics": "paimon.physics3.json",
    "DisplayInfo": "paimon.cdi3.json",
    "Motions": {
      "idle": [{ "File": "motions/idle_00.motion3.json", "FadeIn": 0.3, "FadeOut": 0.3 }],
      "tap":  [{ "File": "motions/tap_00.motion3.json" }]
    },
    "Expressions": [
      { "Name": "smile", "File": "expressions/smile.exp3.json" }
    ]
  },
  "Groups": [
    { "Target": "Parameter", "Name": "EyeBlink", "Ids": ["ParamEyeLOpen", "ParamEyeROpen"] }
  ],
  "HitAreas": [
    { "Id": "Head", "Name": "Head" },
    { "Id": "Body", "Name": "Body" }
  ]
}
```

> `Groups.EyeBlink` 声明后，`pixi-live2d-display` 的内建眨眼才会生效。
> **但本规格由前端自行驱动眨眼**（见阶段 3），此组仍建议保留以便复用内建能力。
> `HitAreas` 用于点击命中判定；前端使用 `autoInteract=false` 自行处理交互，此项为可选项。

---

## 7. 验收自检（建模完成后逐条确认）

| # | 检查项 | 通过标准 |
|---|---|---|
| 1 | 参数命名 | 第 2 节所有 ID 存在且拼写一致（在 `paimon.cdi3.json` 中可见） |
| 2 | 眨眼 | 把 `ParamEyeLOpen` 从 1 拉到 0，左眼平滑闭合无穿帮 |
| 3 | 口型 | `ParamMouthOpenY` 0→1，嘴部张开，下巴不变形过度 |
| 4 | 注视 | `ParamAngleX/Y` ±30 时头部自然转动，脖子不破面 |
| 5 | 动作 | 6 个 motion 均能播放，无穿模 |
| 6 | 表情 | 4 个 exp3 均能加载 |
| 7 | 物理 | 晃动头部时头发/披风有延迟跟随，静止后回正 |
| 8 | 图集 | `texture_00.png` ≤ 2048×2048，PNG 带透明通道 |
| 9 | 体积 | 整个 `public/live2d/paimon/` 建议 < 8MB |

---

## 8. Cubism Core 版权与授权范围（重要）

`public/live2d/live2dcubismcore.min.js` 来自 Live2D 官方 CDN
（`https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js`），
文件头自带声明：

> Live2D Cubism Core — (C) 2019 Live2D Inc. All rights reserved.
> This file is licensed pursuant to the license agreement below.
> This file corresponds to the **"Redistributable Code"** in the agreement.
> https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html

**授权要点（请以官方 EULA 原文为准）**：

- Cubism Core 属于 Live2D 的 **专有软件**，不是开源库。它被授权为 **"可再分发代码"**，
  允许随使用 Cubism SDK 的应用一同分发，**但不得修改、反向工程或单独再分发**。
- 使用 Cubism SDK 需要遵守 **Live2D Cubism SDK 授权协议**，该协议按主体规模分级：
  个人 / 小规模事业者通常可在**免费范围**内使用；超过一定年营业额门槛的主体
  需要取得**付费的 Publication License（出版许可）**。
- **具体门槛与当前条款以官网为准**：<https://www.live2d.com/en/sdk/license/>
  （本文件不构成法律意见，上线商用前请自行核对）。
- 建议在应用内「关于 / 版权」处注明：
  `This application uses Live2D Cubism SDK. © Live2D Inc.`

> 本仓库将该文件纳入版本管理仅为让开发环境可直接运行；
> 若你所在主体的营收规模触及付费门槛，请先取得许可再分发。