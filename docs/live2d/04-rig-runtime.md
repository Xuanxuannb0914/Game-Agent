# 阶段 3 · 参数化骨骼运行时（rig）说明

> 本文解释「派蒙为什么现在是参数化骨骼而不是真 Live2D」，以及它的行为、素材管线、
> 回退链和后续升级路径。施工规格（参数 ID / 动作 / 表情 / 物理）见
> [`02-cubism-modeling-spec.md`](./02-cubism-modeling-spec.md)。

---

## 1. 为什么没有直接出 `.moc3`

`.moc3` 是 Live2D 的**专有二进制格式**，只有 **Cubism Editor 的图形界面**能导出：

- Cubism Editor 没有无头模式、没有命令行导出器、没有公开的导出 API；
- 没有可用的开源写入器。社区工具（如 `moc2cmo`）只能做 **moc3 → cmo3 的反编译**，
  不能反向合成 moc3；
- 因此「用脚本自动生成一个可用的 moc3」在当前工具链下不可行。

所以阶段 2 的产出是**给人工建模师的施工图**（规格书 + 补画清单 + 底图）。
在 moc3 就位之前，为了不让功能悬空，阶段 3 额外实现了本文件描述的 **rig 运行时**。

---

## 2. rig 是什么

`src/lib/live2d/paimonRig.ts` 用 **Pixi.js** 把分层 PNG 组成一套**参数驱动的骨骼**，
参数语义与规格书里的 Cubism 标准参数一一对应——也就是说，它模拟的是
「同一套参数接口」，而不是「同一个模型格式」。

| Cubism 参数 | rig 中的实现 |
|---|---|
| `ParamAngleX` | 头部绕脖子（源图 `(193,272)`）旋转 + 水平位移 |
| `ParamAngleY` | 头部垂直位移 |
| `ParamAngleZ` | 待机微摆（`sin(t/1500)`）+ 表情倾斜 |
| `ParamEyeBallX/Y` | 眼球图层相对眼窝的平移（±5 / ±4 px） |
| `ParamEyeLOpen/ROpen` | `Eye_*` 与 `Eye_Closed_*` 两组图层**交叉淡入** |
| `ParamMouthOpenY` | `Mouth_Closed` 与 `Mouth_Open` **交叉淡入** |
| `ParamBreath` | 身体图层绕脚底的极轻微纵向缩放 + 头部上下浮动 |
| `ParamArmLA/RA` | 未单独建模（手臂随身体整体摆动） |

行为层与真模型共用同一套控制器接口（`PaimonController`），所以
`PaimonAssistant.tsx` 不需要知道底下是 moc3 还是 rig：

```
setGaze(x, y)      注视鼠标（归一化 -1..1）
setDragging(on)    拖拽时回正头部
pulseMouth()       打字机每输出一字符拉高口型，随后指数衰减
playTap()          点击：阻尼弹簧压缩拉伸 + 随机表情
destroy()          释放 WebGL / 纹理 / rAF / 事件监听
```

额外的自主行为：随机眨眼（约每 2–5 秒一次，闭合 ~170ms）、待机头部微摆、
呆毛与发饰的延迟跟随（用头部角速度做惯性）。

---

## 3. 素材管线

分层原始素材是**自动分割**的近似结果，被遮挡区域从未画过——直接移动部件会露洞。
所以 rig 使用的不是 `assets/live2d/paimon/layers/`，而是经过程序化补全的
`public/live2d/paimon/rig/`。

```
public/paimon-pet.png
        │  scripts/live2d/segment.py            颜色掩膜 + 几何分割 + 线稿归属
        ▼
assets/live2d/paimon/layers/*.png                19 个原始图层（近似，供人工精修）
        │  scripts/live2d/complete_layers.py     补全遮挡区 + 生成闭眼/张嘴 + 裁切
        ▼
public/live2d/paimon/rig/*.png + rig.json        运行时素材（≈284 KB）
```

补全策略刻意保守：**只补 `Face` 的眼窝**（让虹膜能滑动），
其余部件不做补全——头部所有部件一起运动，不会互相分离而露洞；
多补只会让画面偏离原始立绘（例如补额头会从头发的缝隙里透出皮肤色）。

**嘴部单独处理。** `segment.py` 里那个叫 `Mouth_Closed` 的图层其实不是嘴——它是
下巴/领口阴影，已正名为 `Neck`。真正的嘴是一道小弧线，位置在 `y≈212..234`，
原本被烤进了 `Face`。`complete_layers.py` 把它从 `Face` 上抠掉，改成两块
**完全不透明的贴片**盖在同一个矩形上：

| 图层 | 来源 | 作用 |
|---|---|---|
| `Mouth_Closed` | 该矩形内的原始立绘，逐像素照搬 | 闭嘴（静止态） |
| `Mouth_Open` | 同一片皮肤（嘴线已 inpaint 掉）+ 程序绘制的口腔/舌头/上唇 | 张嘴（打字时） |
| `Eye_Closed_L` / `Eye_Closed_R` | 程序绘制：肤色眼睑 + 睫毛弧线 | 眨眼 |

`paimonRig.ts` 用 `mouth` / `1 - mouth` 交叉淡入两者，两者之和恒为 1；又因为两块
贴片都不透明，`Face` 上被抠掉的区域**永远不会露出来**——静止态合成结果与原始立绘
逐像素一致（平均色差 0.05/255），同时嘴仍能张开。

重建方式（幂等）：

```bash
python scripts/live2d/segment.py           # 重新分层（需要 opencv + Pillow）
python scripts/live2d/complete_layers.py   # 重新生成 rig 素材
```

复核图（各层预览、补全前后对比、并排对照）输出到
`assets/live2d/paimon/rig-review/`，**不进 `public/`，不会被部署**。

### 图层与绘制顺序

`z` 越大越靠前（与 `segment.py` 的 `ORDER` 一致）：

| z | 图层 | 骨骼 |
|---:|---|---|
| 0 | `Hair_Back` | 只旋转、不位移（始终盖住脖颈） |
| 1–11 | `Cape_Back` `Body` `Cape_Front` `Arm_L` `Arm_R` `Leg_L` `Leg_R` `Boot_L` `Boot_R` `Hand_L` `Hand_R` | 身体（绕脚底） |
| 12 | `Face` | 头部 |
| 13 | `Hair_Tip` | 呆毛（惯性摆动） |
| 14 | `Hair_Front` | 头部 |
| 15–18 | `Eye_L` `Eye_Closed_L` `Eye_R` `Eye_Closed_R` | 眼球（跟随头部 + 偏移） |
| 19 | `Neck` | 头部（下巴/领口阴影，静态不参与口型） |
| 20–21 | `Mouth_Closed` `Mouth_Open` | 头部（交叉淡入） |
| 22 | `Star_Ornament` | 发饰（惯性摆动） |

关键支点（源图 407×820 坐标）：脖子 `(193,272)`、身体 `(193,700)`、
呆毛 `(193,58)`、发饰 `(259,120)`、脚底 `(203.5,816)`。

---

## 4. 三级回退链

`src/lib/live2d/paimonModel.ts` 的 `mountPaimon()` 是唯一入口：

| 级别 | 条件 | 结果 |
|---:|---|---|
| 1 · 真 Live2D | `public/live2d/paimon/paimon.model3.json` 存在且可加载 | 完整 moc3 模型 |
| 2 · 参数化骨骼 | moc3 缺失 / 加载失败，且 `rig/rig.json` 存在 | Pixi 骨骼动画 |
| 3 · 静态立绘 | 以上都失败，或 `NEXT_PUBLIC_PAIMON_LIVE2D=0` | `paimon-pet.png` + CSS 呼吸动画 |

第 1、2 级都会**先探测资源是否存在**再决定是否加载重依赖：moc3 不存在时不会把
`pixi-live2d-display` 拉下来，rig 不存在时连 `pixi.js` 都不下载。
三级都失败应用仍可正常使用，不白屏、不报错。

### 强制回退（调试）

```bash
# .env.local
NEXT_PUBLIC_PAIMON_LIVE2D=0
```

---

## 5. 升级到真 Live2D

**不需要改任何前端代码。** 建模师按
[`02-cubism-modeling-spec.md`](./02-cubism-modeling-spec.md) 在 Cubism Editor 中
建模并导出到 `public/live2d/paimon/`，第 1 级自动接管，rig 退居备用：

```
public/live2d/paimon/
  paimon.model3.json      ← 只要这个文件出现，前端立刻切换到真模型
  paimon.moc3
  paimon.physics3.json
  paimon.cdi3.json
  textures/texture_00.png
  motions/idle_00.motion3.json …
  expressions/normal.exp3.json …
```

> 若加载报 `unsupported moc version`，说明 Editor 导出的 moc3 版本高于当前运行时
> Core，用更高版本的 `live2dcubismcore.min.js` 覆盖即可（见规格书第 0 节）。

---

## 6. 与真 Live2D 的差距（已知限制）

| 项 | rig | 真 Live2D |
|---|---|---|
| 变形 | 图层刚体变换（旋转 / 平移 / 缩放 / 淡入淡出） | ArtMesh 顶点级网格变形 |
| 眨眼 | 两组图层交叉淡入 | 眼睑网格连续变形 |
| 口型 | 两个状态交叉淡入 | 连续变形，可与表情叠加 |
| 头发/披风 | 单一刚体摆动 | physics3 多段物理摆 |
| 手臂 | 随身体整体运动 | 独立参数（挥手动作） |
| 素材 | 自动分割，边缘为近似 | 人工精修，无近似 |

因此 rig 是**功能完整的过渡实现**，不是最终形态；视觉精细度以真模型为准。