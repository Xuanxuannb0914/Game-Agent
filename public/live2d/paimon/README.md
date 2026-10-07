# public/live2d/paimon/

派蒙的运行时资源目录，含两条渲染路径（三级回退见下）。

## 1. 真 Live2D（首选，目前为空占位）

`paimon.model3.json` 需在 Cubism Editor 中制作后导出到此处。**文件一旦出现，
前端会自动切到真模型**，无需改代码：

- **文件存在且格式正确** → 渲染 Live2D 派蒙（呼吸、眨眼、注视、口型联动）。
- **文件缺失或加载失败** → 自动降级到下面的 rig 骨骼。

```
paimon.model3.json       # 入口清单
paimon.moc3              # 模型本体
paimon.physics3.json     # 头发/披风物理
paimon.cdi3.json         # 参数显示名（可选）
textures/texture_00.png  # 图集
motions/idle_*.motion3.json
motions/tap_*.motion3.json
motions/wave_*.motion3.json
motions/drag_*.motion3.json
expressions/*.exp3.json
```

> `.moc3` 只能由 Cubism Editor 的 GUI 导出（无无头/命令行导出器，也无开源写入器），
> 所以在此之前先用 rig 顶上。

## 2. 参数化骨骼 rig（当前生效）

`rig/` 是 `scripts/live2d/complete_layers.py` 从分层素材生成的**补全版图层 + 裁切偏移**
（`rig.json`），由 `src/lib/live2d/paimonRig.ts` 用 Pixi.js 驱动。行为对齐同一套
Cubism 参数语义（头部旋转 / 眼球偏移 / 眨眼 / 口型 / 呼吸）。

## 三级回退

| 级别 | 条件 | 结果 |
|---:|---|---|
| 1 | `paimon.model3.json` 可用 | 真 Live2D |
| 2 | 否则 `rig/rig.json` 可用 | Pixi 参数化骨骼 |
| 3 | 都不可用，或设了 `NEXT_PUBLIC_PAIMON_LIVE2D=0` | 静态立绘 `paimon-pet.png` + CSS 呼吸动画 |

三级都失败应用仍正常运行，不白屏、不报错。

## 文档

- 完整命名规范、参数 ID、动作/表情/物理设置与自检清单：
  [`docs/live2d/02-cubism-modeling-spec.md`](../../../docs/live2d/02-cubism-modeling-spec.md)
- rig 运行时原理、素材管线与升级路径：
  [`docs/live2d/04-rig-runtime.md`](../../../docs/live2d/04-rig-runtime.md)
- 分层素材（建模输入）：`assets/live2d/paimon/layers/`，
  分层说明见 [`docs/live2d/01-layering-report.md`](../../../docs/live2d/01-layering-report.md)，
  **可直接上手的补画清单 + 底图**见
  [`docs/live2d/03-redraw-checklist.md`](../../../docs/live2d/03-redraw-checklist.md)
  （底图在 `assets/live2d/paimon/redraw/`）。

## 强制关闭 Live2D

在 `.env.local` 中设置：

```
NEXT_PUBLIC_PAIMON_LIVE2D=0
```

即可强制使用静态立绘回退（调试用）。