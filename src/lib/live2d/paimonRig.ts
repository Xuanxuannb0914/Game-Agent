/**
 * 派蒙参数化骨骼运行时（rig）。
 *
 * 为什么不是 moc3：.moc3 只能由 Cubism Editor 的 GUI 导出，没有无头/命令行
 * 编译器，也没有可用的开源写入器（moc2cmo 只能 moc3 → cmo3 反编译）。因此这里
 * 用 Pixi 把 `public/live2d/paimon/rig/` 的分层 PNG 组成一套**参数驱动的骨骼**，
 * 行为对齐 docs/live2d/02-cubism-modeling-spec.md 里的参数语义：
 *
 *   ParamAngleX/Y  → 头部旋转 + 位移      ParamEyeBallX/Y → 眼球偏移
 *   ParamEyeLOpen/ROpen → 睁眼/闭眼交叉淡入   ParamMouthOpenY → 闭嘴/张嘴交叉淡入
 *   ParamBreath    → 身体呼吸缩放          ParamAngleZ    → 待机微摆
 *
 * 一旦 `public/live2d/paimon/paimon.model3.json` 就位，paimonModel 会优先走真
 * Live2D，本文件自动退居备用。
 *
 * 图层坐标：所有 PNG 都裁切过，rig.json 记录各自的裁切偏移；下面所有 pivot 都用
 * **源图 407×820 坐标**，写入 Pixi 时再减去裁切偏移。
 */

import type { Sprite, Texture } from "pixi.js";
import type { MountOptions, PaimonController } from "./paimonModel";

const BASE = "/live2d/paimon/rig";
const SRC_W = 407;
const SRC_H = 820;

type Part = "headBack" | "head" | "eyeL" | "eyeR" | "ahoge" | "star" | "body";

/** z 越大越靠前，顺序与 scripts/live2d/segment.py 的 ORDER 一致 */
const LAYERS: Record<string, { z: number; part: Part }> = {
  Hair_Back: { z: 0, part: "headBack" },
  Cape_Back: { z: 1, part: "body" },
  Body: { z: 2, part: "body" },
  Cape_Front: { z: 3, part: "body" },
  Arm_L: { z: 4, part: "body" },
  Arm_R: { z: 5, part: "body" },
  Leg_L: { z: 6, part: "body" },
  Leg_R: { z: 7, part: "body" },
  Boot_L: { z: 8, part: "body" },
  Boot_R: { z: 9, part: "body" },
  Hand_L: { z: 10, part: "body" },
  Hand_R: { z: 11, part: "body" },
  Face: { z: 12, part: "head" },
  Hair_Tip: { z: 13, part: "ahoge" },
  Hair_Front: { z: 14, part: "head" },
  Eye_L: { z: 15, part: "eyeL" },
  Eye_Closed_L: { z: 16, part: "eyeL" },
  Eye_R: { z: 17, part: "eyeR" },
  Eye_Closed_R: { z: 18, part: "eyeR" },
  // under-chin / collar pixels: static, rides the head so it never tears from the chin
  Neck: { z: 19, part: "head" },
  Mouth_Closed: { z: 20, part: "head" },
  Mouth_Open: { z: 21, part: "head" },
  Star_Ornament: { z: 22, part: "star" },
};

/** 各骨骼的旋转支点（源图坐标） */
const NECK = { x: 193, y: 272 };
const BODY_PIVOT = { x: 193, y: 700 };
const AHOGE_PIVOT = { x: 193, y: 58 };
const STAR_PIVOT = { x: 259, y: 120 };
/** 压缩/拉伸的支点：脚底 */
const FEET = { x: 203.5, y: 816 };

const DEG = Math.PI / 180;
const EXPR_DURATION = 1400;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Expression = { eyeScaleY: number; eyeScaleX: number; tilt: number };
const EXPRESSIONS: Expression[] = [
  { eyeScaleY: 1, eyeScaleX: 1, tilt: 3 }, // normal / smile
  { eyeScaleY: 0.8, eyeScaleX: 1.04, tilt: -4 }, // happy：眯眼
  { eyeScaleY: 1.3, eyeScaleX: 1.12, tilt: 0 }, // surprised：瞪大
];

export async function mountRig(opts: MountOptions): Promise<PaimonController> {
  const { host, width, height, characterHeight } = opts;
  if (typeof window === "undefined") throw new Error("派蒙 rig 仅支持浏览器环境");

  // 先确认 rig 资源在，不在就直接回退静态图，连 pixi 都不下载
  const probe = await fetch(`${BASE}/rig.json`, { cache: "no-cache" });
  if (!probe.ok) throw new Error(`派蒙 rig 资源不存在（HTTP ${probe.status}）`);
  const offsets = (await probe.json()) as Record<string, { x: number; y: number }>;

  const PIXI = await import("pixi.js");

  const names = Object.keys(LAYERS).filter((n) => offsets[n]);
  const loaded = (await PIXI.Assets.load(
    names.map((n) => `${BASE}/${n}.png`),
  )) as Record<string, Texture>;

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  // 画布纯装饰：交互（拖拽/点击）由外层容器处理。若画布可命中，Pixi 的事件系统
  // 会消费指针事件，导致外层 React 的 pointerdown 收不到、拖拽失效。
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");

  const app = new PIXI.Application({
    view: canvas,
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoStart: false,
    sharedTicker: false,
  });

  // root 负责整体尺寸/定位，squash 负责点击时的压缩拉伸（支点在脚底）
  const root = new PIXI.Container();
  const squash = new PIXI.Container();
  // 精灵都挂在 squash 下，所以排序开关要开在 squash 上，zIndex 才生效
  squash.sortableChildren = true;
  squash.pivot.set(FEET.x, FEET.y);
  squash.position.set(FEET.x, FEET.y);
  root.addChild(squash);
  app.stage.addChild(root);

  const s = characterHeight / SRC_H;
  root.scale.set(s);
  root.position.set(width / 2 - (SRC_W / 2) * s, height - SRC_H * s);

  type Item = {
    sprite: Sprite;
    def: { z: number; part: Part };
    /** 支点，源图坐标 */
    pivot: { x: number; y: number };
  };

  const pivotFor = (part: Part) => {
    switch (part) {
      case "ahoge":
        return AHOGE_PIVOT;
      case "star":
        return STAR_PIVOT;
      case "body":
        return BODY_PIVOT;
      default:
        return NECK;
    }
  };

  const items: Item[] = [];
  for (const name of names) {
    const def = LAYERS[name];
    const off = offsets[name];
    const tex = loaded[`${BASE}/${name}.png`];
    if (!tex) continue;
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0, 0);
    const pivot = pivotFor(def.part);
    sprite.pivot.set(pivot.x - off.x, pivot.y - off.y);
    sprite.zIndex = def.z;
    squash.addChild(sprite);
    items.push({ sprite, def, pivot });
  }

  // ---- 运行时状态 -------------------------------------------------------
  let gazeTX = 0;
  let gazeTY = 0;
  let gazeX = 0;
  let gazeY = 0;
  let dragging = false;

  let mouth = 0;
  let eyeOpen = 1;
  let blinkT = -1;
  let nextBlink = rand(1600, 3600);

  let prevHeadRot = 0;
  let ahogeAngle = 0;
  let starAngle = 0;
  let breath = 0;
  let idleSway = 0;

  let tapY = 0;
  let tapV = 0;

  let expr: Expression = EXPRESSIONS[0];
  let exprT = EXPR_DURATION; // 已结束

  let destroyed = false;
  let raf = 0;
  let last = performance.now();

  const applyParams = (t: number, dt: number) => {
    const dtSec = dt / 1000;

    // 注视平滑；拖拽时回正
    const tx = dragging ? 0 : gazeTX;
    const ty = dragging ? 0 : gazeTY;
    const k = Math.min(1, dt / 110);
    gazeX += (tx - gazeX) * k;
    gazeY += (ty - gazeY) * k;

    // 眨眼：闭合 42% 时长
    if (blinkT < 0 && t >= nextBlink) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const p = blinkT / 170;
      if (p >= 1) {
        blinkT = -1;
        eyeOpen = 1;
        nextBlink = t + rand(2200, 5200);
      } else {
        const closed = p < 0.42 ? p / 0.42 : (1 - p) / 0.58;
        eyeOpen = Math.max(0, 1 - closed);
      }
    }

    // 口型衰减
    mouth *= Math.exp(-dt / 85);
    if (mouth < 0.01) mouth = 0;

    // 点击：阻尼弹簧
    tapV += -tapY * 220 * dtSec;
    tapV *= Math.exp(-dtSec * 9);
    tapY += tapV * dtSec;
    tapY = Math.max(-16, Math.min(8, tapY));

    // 表情回正
    if (exprT < EXPR_DURATION) exprT += dt;
    const exprK = exprT >= EXPR_DURATION ? 0 : 1 - exprT / EXPR_DURATION;

    breath = Math.sin(t / 540);
    idleSway = Math.sin(t / 1500) * 1.6;

    const rot = gazeX * 10 + idleSway + expr.tilt * exprK;
    const dx = gazeX * 6;
    const dy = -gazeY * 5 + breath * 2.5 + tapY * 0.6;
    const headVel = (rot - prevHeadRot) / Math.max(dtSec, 1e-3);
    prevHeadRot = rot;

    ahogeAngle = Math.sin(t / 650) * 4 - rot * 0.6 - headVel * 0.02;
    starAngle = Math.sin(t / 900 + 1) * 3 - rot * 0.4;

    const eyeX = gazeX * 5;
    const eyeY = -gazeY * 4;
    const eyeScaleY = 1 + (expr.eyeScaleY - 1) * exprK;
    const eyeScaleX = 1 + (expr.eyeScaleX - 1) * exprK;

    // 头部骨骼的仿射：源点绕脖子旋转再平移
    const a = rot * DEG;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const headPoint = (p: { x: number; y: number }) => {
      const px = p.x - NECK.x;
      const py = p.y - NECK.y;
      return { x: NECK.x + px * cos - py * sin + dx, y: NECK.y + px * sin + py * cos + dy };
    };

    for (const { sprite, def, pivot } of items) {
      switch (def.part) {
        case "headBack":
          // 后发只转不位移，始终盖住脖颈，转头时不会露出空隙
          sprite.rotation = a;
          sprite.position.set(NECK.x, NECK.y);
          sprite.scale.set(1);
          break;
        case "head": {
          const q = headPoint(pivot);
          sprite.rotation = a;
          sprite.position.set(q.x, q.y);
          sprite.scale.set(1);
          break;
        }
        case "eyeL":
        case "eyeR": {
          const q = headPoint(pivot);
          sprite.rotation = a;
          sprite.position.set(q.x + eyeX, q.y + eyeY);
          sprite.scale.set(eyeScaleX, eyeScaleY);
          break;
        }
        case "ahoge": {
          const q = headPoint(pivot);
          sprite.rotation = a + ahogeAngle * DEG;
          sprite.position.set(q.x, q.y);
          sprite.scale.set(1);
          break;
        }
        case "star": {
          const q = headPoint(pivot);
          sprite.rotation = a + starAngle * DEG;
          sprite.position.set(q.x, q.y);
          sprite.scale.set(1);
          break;
        }
        case "body":
          sprite.rotation = gazeX * 1.2 * DEG + Math.sin(t / 1800) * 0.6 * DEG;
          sprite.position.set(BODY_PIVOT.x, BODY_PIVOT.y);
          sprite.scale.set(1 - breath * 0.004, 1 + breath * 0.006);
          break;
      }
    }

    // 睁眼/闭眼、闭嘴/张嘴：交叉淡入（对应 ParamEyeLOpen / ParamMouthOpenY）
    for (const { sprite } of items) {
      const n = sprite.texture.textureCacheIds?.[0] ?? "";
      if (n.includes("Eye_Closed")) sprite.alpha = 1 - eyeOpen;
      else if (n.includes("/Eye_")) sprite.alpha = eyeOpen;
      else if (n.includes("Mouth_Open")) sprite.alpha = mouth;
      else if (n.includes("Mouth_Closed")) sprite.alpha = 1 - mouth;
    }

    // 点击压缩拉伸（只动 scale，符合「动画只用 transform」的约束）
    squash.scale.set(1 + tapY * 0.003, 1 - tapY * 0.004);
  };

  const frame = (t: number) => {
    if (destroyed) return;
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(t - last, 50);
    last = t;
    applyParams(t, dt);
    app.render();
  };

  host.appendChild(canvas);
  raf = window.requestAnimationFrame(frame);

  const onVisibility = () => {
    if (destroyed) return;
    if (document.hidden) {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    } else if (!raf) {
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setGaze(x, y) {
      gazeTX = Math.max(-1, Math.min(1, x));
      gazeTY = Math.max(-1, Math.min(1, y));
    },
    setDragging(on) {
      dragging = on;
    },
    pulseMouth() {
      mouth = Math.min(1, mouth + 0.6);
    },
    playTap() {
      tapV = -520;
      expr = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
      exprT = 0;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        // 纹理留在 Assets 缓存里：重复挂载时复用，不会随销毁反复解码
        app.destroy(true, { children: true });
      } catch {
        /* 忽略重复销毁 */
      }
    },
  };
}