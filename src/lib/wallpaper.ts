export type WallPhase = "dawn" | "day" | "dusk" | "night";

export const PHASE_LABEL: Record<WallPhase, string> = {
  dawn: "黎明",
  day: "白昼",
  dusk: "黄昏",
  night: "深夜",
};

/**
 * 时间锚点（小时）。相邻锚点之间做线性插值，得到「上方那组渐变」的透明度
 * （即 CSS 变量 --dawn-blend）：0 = 完全 from，1 = 完全 to。
 */
const ANCHORS: { h: number; id: WallPhase }[] = [
  { h: 0, id: "night" },
  { h: 5, id: "night" },
  { h: 7, id: "dawn" },
  { h: 10, id: "day" },
  { h: 16, id: "day" },
  { h: 18, id: "dusk" },
  { h: 20, id: "night" },
  { h: 24, id: "night" },
];

export interface WallBlend {
  from: WallPhase;
  to: WallPhase;
  blend: number;
}

/** 按真实时间计算壁纸插值（每分钟调用一次即可） */
export function computeWallpaper(date: Date): WallBlend {
  const h = date.getHours() + date.getMinutes() / 60;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i];
    const b = ANCHORS[i + 1];
    if (h >= a.h && h < b.h) {
      const span = b.h - a.h || 1;
      const blend = Math.min(1, Math.max(0, (h - a.h) / span));
      return { from: a.id, to: b.id, blend };
    }
  }
  return { from: "night", to: "night", blend: 0 };
}