export type ThemeId = "sky" | "violet" | "green" | "dark" | "auto";

export const THEMES: { id: ThemeId; label: string; color: string }[] = [
  { id: "sky", label: "晴空", color: "#7C9CD6" },
  { id: "violet", label: "星轨", color: "#A78BFA" },
  { id: "green", label: "苔原", color: "#7FBF9A" },
  { id: "dark", label: "深夜", color: "#3A3F4E" },
  // 「自动」：壁纸按真实时间在 dawn/day/dusk/night 间插值
  {
    id: "auto",
    label: "自动",
    color: "linear-gradient(135deg,#f3c9a0,#33619e 52%,#16203c)",
  },
];

/** 只用于壁纸层的四套静态主题（不含「自动」） */
export const WALL_THEMES = THEMES.filter((t) => t.id !== "auto");

export type GameId = "genshin" | "hsr" | "zzz" | "wuwa";

/** 角标：红点（有新内容）或数字（如体力已满/可领取数量） */
export interface GameBadge {
  type: "dot" | "count";
  count?: number;
}

export interface GameMeta {
  id: GameId;
  name: string;
  en: string;
  developer: string;
  type: string;
  /**
   * 官方应用图标，会随游戏版本更新（如原神当前为 6 周年图）。
   * 换图标时只改本文件的 icon 字段；iconFallback 预留旧版图标做回退/对比，暂未使用。
   */
  icon: string;
  iconFallback?: string;
  accent: string;
  badge?: GameBadge | null;
}

export const GAMES: GameMeta[] = [
  {
    id: "genshin",
    name: "原神",
    en: "Genshin Impact",
    developer: "米哈游",
    type: "开放世界 · RPG",
    icon: "/icons/genshin.png",
    accent: "#5B8BC9",
    badge: null,
  },
  {
    id: "hsr",
    name: "崩坏：星穹铁道",
    en: "Honkai: Star Rail",
    developer: "米哈游",
    type: "回合制 · RPG",
    icon: "/icons/hsr.png",
    accent: "#9B7EF2",
    badge: null,
  },
  {
    id: "zzz",
    name: "绝区零",
    en: "Zenless Zone Zero",
    developer: "米哈游",
    type: "动作 · Roguelike",
    icon: "/icons/zzz.png",
    accent: "#F28C38",
    badge: null,
  },
  {
    id: "wuwa",
    name: "鸣潮",
    en: "Wuthering Waves",
    developer: "库洛游戏",
    type: "开放世界 · 动作",
    icon: "/icons/wuwa.png",
    accent: "#2AA79B",
    badge: null,
  },
];

/** 主题联动：最顶层窗口的游戏 → 壁纸主题 */
export const GAME_THEME: Record<GameId, ThemeId> = {
  genshin: "sky",
  hsr: "violet",
  zzz: "dark",
  wuwa: "green",
};
