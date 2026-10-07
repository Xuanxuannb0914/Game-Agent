# 派蒙形象修复提示词（消除 Live2D 割裂感）

> 用法：整段复制发给 AI 编程工具即可。目标是修复 `rig` 渲染的割裂感（关节裂缝、眼睛漂移、
> 眨眼重影、头身不同步、纸片感），不是做真 Live2D 模型（那是另一条线，见 L2）。
> 若修复后仍不达标，任务要求给出「必须等真 moc3 模型」的结论与证据，不要硬凑。

---

```text
# 角色
你是精通 Pixi 渲染管线与 2D 角色形变（mesh warp / 骨骼混合）的图形工程师。

# 项目上下文
项目：Game-Agent —— 模仿 macOS 的「伪操作系统」二次元游戏聚合桌面。
技术栈：Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + Zustand。

派蒙目前不是真 Live2D，而是「参数化骨骼 rig」：
- 入口 src/lib/live2d/paimonModel.ts 的 mountPaimon()：三级回退（moc3 → rig → 静态图）。
- rig 实现 src/lib/live2d/paimonRig.ts：用 Pixi 把分层 PNG 组成参数驱动骨骼。
- 图层资源 public/live2d/paimon/rig/*.png，每个图层的裁切偏移在 public/live2d/paimon/rig/rig.json。
- 图层顺序与部件归属见 paimonRig.ts 的 LAYERS 常量（z 越大越靠前）。
- 源图坐标系 407×820；支点：脖子(193,272)、身体(193,700)、呆毛(193,58)、发饰(259,120)、脚底(203.5,816)。
- 对外契约 PaimonController：setGaze / setDragging / pulseMouth / playTap / destroy。
- 调用方 src/components/desktop/PaimonAssistant.tsx（拖拽、位置记忆、打字机气泡）。

# 用户反馈
派蒙形象「割裂感很强」：关节处有裂缝和硬切边、表情时眼睛会漂移、眨眼有重影、
头部和身体各动各的、整体像纸片拼贴而不是一个完整角色。

# 已定位的根因（按严重度排序，均已核对代码）
R1【支点错误·必现】paimonRig.ts 的 pivotFor() default 分支把 Eye_L / Eye_R 的支点设成 NECK(193,272)，
   而眼睛实际在 y≈170。EXPRESSIONS 的 eyeScaleY 最高 1.3（surprised），
   绕脖子这个远点缩放会让眼睛位移 20–30px，直接被甩出脸外。
R2【无底衬·必现】所有图层都是独立 Sprite，之间没有任何底衬。
   任何旋转/位移在颈部、肩部、头发根部造成的缝隙会直接露出透明背景 → 硬裂缝。
R3【头身不同步】body 层按 ParamBreath 做 scale(1-breath*0.004, 1+breath*0.006)，
   head 层完全不缩放 → 颈线上下呼吸幅度不一致，交界处持续撕扯。
R4【相位不一致】头部摆动用 sin(t/1500)*1.6，身体摆动用 sin(t/1800)*0.6 → 两个周期，头身各动各的。
R5【后发不跟随】case "headBack" 只设 rotation，不叠加头部平移 dx；
   而 Face / Hair_Front 走 headPoint() 带上了 dx → 转头时前后发错位、发根露缝。
R6【眨眼重影】Eye_L 偏移(144,170) 与 Eye_Closed_L 偏移(137,166) 相差 7px/4px，
   交叉淡入时两版眼睛同时可见且错位 → 重影。
R7【纸片感】每个图层只做刚性仿射（绕单一支点旋转+平移），没有网格形变，
   颈部/肩部/腰部的转折是整块跳变而非连续弯曲。
R8【边缘残留】图层来自自动分割，边缘有杂色/白边（halo），运动时变成可见硬切边。
R9【幅度过大且无缓动】头部旋转达 gazeX*10° + idleSway + expr.tilt（合计约 ±13°），位移 6px，
   且为线性跟随，机械感强，放大了以上所有缺陷。

# 任务：按 Tier 依次修复，每完成一个 Tier 就自测一次

## Tier 1 · 消除结构性裂缝（必做，收益最大）
1. 修正眼睛支点：Eye_L / Eye_R / Eye_Closed_L / Eye_Closed_R 的 pivot 改为各自眼睛的几何中心
   （由 rig.json 偏移 + 纹理尺寸算出），表情缩放只影响眼睛自身，绝不位移。
2. 对齐眨眼锚点：让 Eye_Closed_* 与对应 Eye_* 使用同一锚点（以睁眼位置为准），
   交叉淡入时零位移、零重影。
3. 增加底衬层（underlay）：为 body / head 各组生成「膨胀底衬」——
   把该组所有图层的 alpha 并集向外膨胀 3–4px 并用最近的边缘颜色填充，
   放在原图层下方（z 减 0.5）。任何缝隙露出的是角色颜色而不是透明背景。
   建议新增脚本 scripts/live2d/bleed.py 生成 public/live2d/paimon/rig/bleed/*.png，
   rig 优先加载 bleed 版本、缺失时回退原图。
4. 后发跟随头部：case "headBack" 同时应用头部平移 dx（或把后发挂到头部骨骼下作为子节点），
   保证转头时前后发同源运动。
5. 头身同步呼吸：把 ParamBreath 的缩放同时施加到 head 组，并统一使用同一支点与同一相位；
   颈线不再上下撕扯。
6. 统一全身相位：头、身体、头发、披风共用同一个基础相位变量，
   禁止再出现 sin(t/1500) 与 sin(t/1800) 并存。

## Tier 2 · 消除纸片感（核心）
7. 用网格形变替代刚性旋转：对 Face / Hair_Front / Hair_Back / Body / Cape_Front / Cape_Back
   改用 Pixi Mesh（如 Mesh + Geometry 或 SimplePlane 后直接改顶点缓冲），
   在颈部、肩部、腰部按 y 做权重混合形变，让转折是连续弯曲。
   备选（若 mesh 成本过高）：用「双支点仿射混合」——每个图层按其在源图中的 y
   在 NECK 与 BODY_PIVOT 两个变换之间线性插值，得到近似的连续弯曲。
   二选一，说明选择理由；不要既不实现 mesh 也不实现混合。
8. 头发与披风加次级运动：Hair_Front / Hair_Tip / Hair_Back / Cape_* 改为
   「延迟跟随 + 惯性」——跟随头部角度但滞后 80–120ms，并叠加轻微阻尼，
   产生重量感，而不是与头同帧同角度。
9. 加入视线先行的顺序感：眼球先动，头部滞后约 60–100ms 跟上，
   避免整颗头同步平移的机械感。

## Tier 3 · 消除贴片感（观感）
10. 清理边缘杂色：检查并去除分割残留的白边/杂色（对 alpha 边缘做去杂色 + 颜色扩张），
    确保缩放/旋转后不出现 halo。必要时用脚本预处理 PNG。
11. 统一轮廓与阴影：为整体 silhouette 叠加一层极浅的统一投影/暗边（不用 backdrop-filter，
    只用一个底衬 Sprite 的 tint + blur 或一张预生成阴影图），
    让分离的部件在视觉上重新「黏」成一个形体。
12. 渲染参数：开启 roundPixels 避免亚像素抖动；确认纹理 alpha 模式正确，
    不因预乘/非预乘不匹配产生暗边。

## Tier 4 · 参数调校
13. 收敛幅度并加缓动：头部旋转 ±10° → ±7°，位移 6px → 4px；
    注视跟随用 ease-out（如指数平滑）而不是线性，动作更柔和。
14. 待机加入重心偏移：左右轻微交替承重（幅度 1–2px），不要只有上下呼吸。

## Tier 5 · 调试与验证（必做）
15. 增加 dev 调试开关（环境变量 NEXT_PUBLIC_PAIMON_DEBUG=1，或 URL 参数 ?paimon=debug）：
    - 强制 gaze 推到 (-1,-1) / (1,1) 极值；
    - 强制眨眼闭合中间帧；
    - 强制最大表情（surprised）；
    - 可选：显示各图层包围盒与支点。
    用途：把平时一瞬而过的裂缝稳定复现出来。
16. 修复前后对比截图（务必附上）：
    - 4 个极端姿态：gaze 左上 / 右上 / 左下 / 右下；
    - 2 处关节放大裁剪：颈部、左肩；
    - 2 个表情瞬间：surprised、眨眼半闭。

# 验收标准（逐条自测并截图）
1. 任意 gaze 极值下，颈部、肩部、头发根部无透明缝隙、无硬切边。
2. surprised / happy 表情下眼睛不离开脸框、不漂移；眨眼全过程无重影、无跳位。
3. 图层边缘无白边/黑边（halo）。
4. 头部与身体呼吸同幅、摆动同相位，不做「各动各的」。
5. 颈部转折是连续弯曲而非整块旋转（Tier 2 的形变确实生效）。
6. 生产模式下 Pixi 每帧渲染耗时 < 8ms，动画稳定 60fps。
7. prefers-reduced-motion 下停止自主动画，仅静态显示。
8. PaimonController 接口不变，拖拽、位置记忆、点击气泡、打字机口型全部正常。
9. 三级回退链不变：删掉 rig 资源仍能回退到静态图，不白屏、不报错。

# 约束
- 只改 rig 渲染层（paimonRig.ts、新增 bleed/预处理脚本与资源、必要时 paimonModel.ts 的加载细节），
  不得改动 PaimonAssistant 的交互契约与三级回退行为。
- 含 backdrop-filter 的 DOM 元素禁止套 opacity 关键帧动画；DOM 层动画只允许 transform/opacity。
- 本机 Turbopack dev 热更新会死循环：验证一律用生产模式
  npm run build && npm run start -- --port 3000，浏览器打开 http://localhost:3000 自测。
- 若 npm 不在 PATH，用 PATH="$HOME/.npm-cli/shims:$PATH" 前缀。
- 不要引入 moc3 模型（那是 L2 的任务），也不要用盗版模型临时顶替。

# 交付
1. 改动文件清单 + 每个文件改了什么。
2. 按 Tier 说明实际采用了哪种方案（mesh 形变 or 双支点混合，并说明理由）。
3. 第 16 条要求的对比截图。
4. 若判定 rig 无法达到验收标准，给出明确结论与证据，说明「必须等 L2 真 moc3 模型」，
   并列出 rig 方案的能力上限（哪些缺陷是刚性分层原理上无法消除的）。
```