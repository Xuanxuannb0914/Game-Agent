/**
 * 自定义鼠标指针。
 *
 * 输出两条路径：
 * 1) 首选 SVG data URL —— 矢量光标由浏览器按「设备像素」重绘，Retina 上边缘和锁屏那颗
 *    矢量星（icons.tsx 的 LogoMark）一样锐利，不会像位图那样被放大糊掉；
 * 2) 回退 canvas 光栅化的 PNG —— 给不支持 SVG 光标的浏览器（主要是 Safari）兜底。
 *
 * CSS 的 cursor 会按顺序尝试，所以两者同时写进 --cursor 即可自动降级。
 */

export type CursorShape = "star" | "dot" | "ring";

export const CURSOR_SHAPES: { id: CursorShape; label: string }[] = [
  { id: "star", label: "星形" },
  { id: "dot", label: "圆点" },
  { id: "ring", label: "光环" },
];

export interface CursorPreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const CURSOR_PRESETS: CursorPreset[] = [
  { id: "lock-white", label: "锁屏白", from: "#ffffff", to: "#ffffff" },
  { id: "blue-white", label: "蓝白渐变", from: "#2f6fe0", to: "#ffffff" },
  { id: "ice", label: "冰蓝", from: "#22d3ee", to: "#1d4ed8" },
  { id: "gold-violet", label: "金紫", from: "#fbbf24", to: "#7c3aed" },
  { id: "sakura", label: "樱粉", from: "#fb7185", to: "#fde68a" },
  { id: "graphite", label: "石墨", from: "#111827", to: "#9ca3af" },
];

export interface CursorConfig {
  /** 是否启用自定义指针（关闭则用系统默认箭头） */
  on: boolean;
  shape: CursorShape;
  /** 渐变起点色 */
  from: string;
  /** 渐变终点色 */
  to: string;
  /** 图形直径（px），在 32×32 画布内 */
  size: number;
}

export const DEFAULT_CURSOR: CursorConfig = {
  on: true,
  shape: "star",
  from: "#ffffff",
  to: "#ffffff",
  size: 22,
};

/** 与 icons.tsx 的 LogoMark 同一路径（24×24 视图框，包围盒 1.5 → 22.5） */
const STAR_PATH =
  "M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z";
const STAR_BOX = 21;

/** 画布固定 32×32、热点取正中心：兼顾各浏览器对光标图尺寸的限制 */
export const CURSOR_CANVAS = 32;
export const CURSOR_HOTSPOT = CURSOR_CANVAS / 2;

/**
 * 投影：只为把图形从浅色面板上「托」起来，不做体积感。
 * 关键是「贴边 + 极淡」——模糊半径很小，所以读起来是一圈很细的暗边，
 * 而不是之前那种大范围灰雾（灰雾会让白色星形整体发虚，看起来就不是锁屏那颗星了）。
 * dy / sigma 均以 32px 画布为单位。
 */
const SHADOWS = [
  { rgb: "11, 18, 32", alpha: 0.3, dy: 0.5, sigma: 0.5 },
  { rgb: "11, 18, 32", alpha: 0.18, dy: 0.25, sigma: 0.28 },
] as const;

export function isCursorShape(v: unknown): v is CursorShape {
  return v === "star" || v === "dot" || v === "ring";
}

/** 半径 r、圆心 (c,c) 的圆，写成两段半圆弧的路径（便于和内外圈拼成环带） */
function circlePath(c: number, r: number): string {
  const rr = r.toFixed(2);
  const d = (r * 2).toFixed(2);
  return `M${c} ${c} m-${rr} 0 a${rr} ${rr} 0 1 0 ${d} 0 a${rr} ${rr} 0 1 0 -${d} 0Z`;
}

/** 形状本体（24 视图框坐标 / 画布坐标），填充统一引用渐变 #g */
function shapeMarkup(cfg: CursorConfig): string {
  const c = CURSOR_CANVAS / 2;
  if (cfg.shape === "dot") {
    return `<circle cx="${c}" cy="${c}" r="${(cfg.size / 2 - 0.3).toFixed(2)}" fill="url(#g)"/>`;
  }
  if (cfg.shape === "ring") {
    const outer = cfg.size / 2 - 0.3;
    const inner = Math.max(0.5, cfg.size / 2 - 2.9);
    return `<path fill="url(#g)" fill-rule="evenodd" d="${circlePath(c, outer)} ${circlePath(c, inner)}"/>`;
  }
  const s = (cfg.size / STAR_BOX).toFixed(4);
  return `<path fill="url(#g)" d="${STAR_PATH}" transform="translate(${c} ${c}) scale(${s}) translate(-12 -12)"/>`;
}

/**
 * 生成光标 SVG 源码。宽高写死 32，保证浏览器拿到正确的固有尺寸（缺了它 Chrome 会按默认尺寸渲染）。
 * 渐变方向和 canvas 版保持一致：沿图形左上 → 右下。
 */
export function buildCursorSvg(cfg: CursorConfig): string {
  const c = CURSOR_CANVAS / 2;
  const half = cfg.size / 2;
  const shadow = SHADOWS.map(
    (s) =>
      `<feDropShadow dx="0" dy="${s.dy}" stdDeviation="${s.sigma}" flood-color="rgb(${s.rgb})" flood-opacity="${s.alpha}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_CANVAS}" height="${CURSOR_CANVAS}" viewBox="0 0 ${CURSOR_CANVAS} ${CURSOR_CANVAS}">` +
    `<defs>` +
    `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${c - half}" y1="${c - half}" x2="${c + half}" y2="${c + half}">` +
    `<stop offset="0" stop-color="${cfg.from}"/><stop offset="1" stop-color="${cfg.to}"/>` +
    `</linearGradient>` +
    `<filter id="s" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">${shadow}</filter>` +
    `</defs>` +
    `<g filter="url(#s)">${shapeMarkup(cfg)}</g>` +
    `</svg>`
  );
}

/** SVG 源码 → data URL；无 btoa（SSR）时退化为 URL 编码形式 */
export function buildCursorSvgUrl(cfg: CursorConfig): string | null {
  const svg = buildCursorSvg(cfg);
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }
  if (typeof encodeURIComponent === "function") {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  return null;
}

/**
 * 超采样倍率：先在 4× 画布（128×128）上绘制，再等比缩回 32×32。
 * 光标位图在 Retina 上会被系统放大，直接 32×32 光栅化的星形尖角和柔边会发虚；
 * 大画布绘制 + 降采样等于拿到覆盖率级的抗锯齿，边缘明显更干净。
 */
const SS = 4;

/** 在「设备坐标」下构造形状轮廓（所有尺寸已乘 SS），供 canvas 回退路径使用 */
function buildShapePath(
  cfg: CursorConfig,
  cDev: number,
  rDev: number,
): Path2D {
  if (cfg.shape === "dot") {
    const p = new Path2D();
    p.arc(cDev, cDev, Math.max(2 * SS, rDev - 0.8 * SS), 0, Math.PI * 2);
    return p;
  }
  if (cfg.shape === "ring") {
    const ring = Math.max(2 * SS, rDev - 1.6 * SS);
    const half = 1.3 * SS; // 环带半宽 → 总宽 2.6（与旧描边一致）
    const p = new Path2D();
    p.arc(cDev, cDev, ring + half, 0, Math.PI * 2);
    p.arc(cDev, cDev, Math.max(0.5 * SS, ring - half), 0, Math.PI * 2, true);
    return p;
  }
  const sDev = (cfg.size / STAR_BOX) * SS;
  const m = new DOMMatrix();
  m.translateSelf(cDev - 12 * sDev, cDev - 12 * sDev);
  m.scaleSelf(sDev, sDev);
  const p = new Path2D();
  p.addPath(new Path2D(STAR_PATH), m);
  return p;
}

/** 光栅化光标并返回 PNG data URL；无画布能力（SSR / 异常）时返回 null */
export function buildCursorUrl(cfg: CursorConfig): string | null {
  if (typeof document === "undefined") return null;

  // 高分辨率绘制 → 降采样输出，拿到覆盖率级抗锯齿（见 SS 说明）
  const big = document.createElement("canvas");
  big.width = CURSOR_CANVAS * SS;
  big.height = CURSOR_CANVAS * SS;
  const ctx = big.getContext("2d");
  if (!ctx) return null;

  const cDev = (CURSOR_CANVAS * SS) / 2;
  const rDev = (cfg.size / 2) * SS;
  const path = buildShapePath(cfg, cDev, rDev);

  const grad = ctx.createLinearGradient(
    cDev - rDev,
    cDev - rDev,
    cDev + rDev,
    cDev + rDev,
  );
  grad.addColorStop(0, cfg.from);
  grad.addColorStop(1, cfg.to);

  // 每次填充都会在形状下方补一层投影；不透明填充盖住内侧，只留外缘晕开的光
  for (const s of SHADOWS) {
    ctx.save();
    ctx.shadowColor = `rgba(${s.rgb}, ${s.alpha})`;
    // canvas 的 shadowBlur ≈ 2σ，换算成和 SVG stdDeviation 同一视觉量级
    ctx.shadowBlur = s.sigma * 2 * SS;
    ctx.shadowOffsetY = s.dy * SS;
    ctx.fillStyle = grad;
    ctx.fill(path);
    ctx.restore();
  }

  const out = document.createElement("canvas");
  out.width = CURSOR_CANVAS;
  out.height = CURSOR_CANVAS;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(big, 0, 0, CURSOR_CANVAS, CURSOR_CANVAS);

  return out.toDataURL("image/png");
}

/**
 * 把配置写到根元素的 --cursor 上；关闭时置为 auto，恢复系统箭头。
 * 先矢量后位图：SVG 光标的浏览器用矢量，其余自动落到 PNG。
 */
export function applyCursor(cfg: CursorConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!cfg.on) {
    root.style.setProperty("--cursor", "auto");
    return;
  }
  const spot = `${CURSOR_HOTSPOT} ${CURSOR_HOTSPOT}`;
  const layers: string[] = [];
  const svg = buildCursorSvgUrl(cfg);
  if (svg) layers.push(`url("${svg}") ${spot}`);
  const png = buildCursorUrl(cfg);
  if (png) layers.push(`url("${png}") ${spot}`);
  if (layers.length === 0) {
    // 都不可用时移除变量，交给 CSS 里的静态光标兜底
    root.style.removeProperty("--cursor");
    return;
  }
  root.style.setProperty("--cursor", `${layers.join(", ")}, auto`);
}
