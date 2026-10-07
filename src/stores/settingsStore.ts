import { create } from "zustand";
import { sound } from "@/lib/sound";
import { DEFAULT_CURSOR, isCursorShape, type CursorConfig } from "@/lib/cursor";

/** 「主题跟随游戏」持久化键；音效开关由 sound 单例用 ga:sound 管理 */
const FOLLOW_KEY = "ga:follow-game";
/** 鼠标指针配置持久化键 */
const CURSOR_KEY = "ga:cursor";
/** 指针配置版本；v2 起默认配色对齐锁屏那颗纯白星（v1 默认是蓝白渐变） */
const CURSOR_VER_KEY = "ga:cursor-ver";
const CURSOR_VER = 2;

interface SettingsStore {
  /** 壁纸主题是否跟随最顶层游戏窗口（默认开） */
  followGame: boolean;
  /** 音效开关（默认关） */
  soundOn: boolean;
  /** 自定义鼠标指针配置 */
  cursor: CursorConfig;
  hydrate: () => void;
  setFollowGame: (v: boolean) => void;
  setSoundOn: (v: boolean) => void;
  setCursor: (patch: Partial<CursorConfig>) => void;
}

/** 逐字段校验本地数据，损坏或越界的值回退到默认 */
function readCursor(): CursorConfig {
  try {
    const raw = localStorage.getItem(CURSOR_KEY);
    const ver = Number(localStorage.getItem(CURSOR_VER_KEY)) || 1;
    // v1 → v2：默认指针从蓝白渐变改为锁屏那颗纯白星。只重置配色，开关与大小保留，
    // 老用户升级后立刻看到和锁屏一致的白色星形。
    const legacy = ver < CURSOR_VER;
    if (!raw) {
      localStorage.setItem(CURSOR_VER_KEY, String(CURSOR_VER));
      return DEFAULT_CURSOR;
    }
    const p = JSON.parse(raw) as Partial<CursorConfig>;
    const cfg: CursorConfig = {
      on: typeof p.on === "boolean" ? p.on : DEFAULT_CURSOR.on,
      shape: isCursorShape(p.shape) ? p.shape : DEFAULT_CURSOR.shape,
      from: !legacy && typeof p.from === "string" ? p.from : DEFAULT_CURSOR.from,
      to: !legacy && typeof p.to === "string" ? p.to : DEFAULT_CURSOR.to,
      size:
        typeof p.size === "number" && p.size >= 12 && p.size <= 30
          ? p.size
          : DEFAULT_CURSOR.size,
    };
    if (legacy) {
      writeCursor(cfg);
      localStorage.setItem(CURSOR_VER_KEY, String(CURSOR_VER));
    }
    return cfg;
  } catch {
    return DEFAULT_CURSOR;
  }
}

function writeCursor(cfg: CursorConfig) {
  try {
    localStorage.setItem(CURSOR_KEY, JSON.stringify(cfg));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  followGame: true,
  soundOn: false,
  cursor: DEFAULT_CURSOR,

  hydrate: () => {
    let followGame = true;
    try {
      const raw = localStorage.getItem(FOLLOW_KEY);
      if (raw !== null) followGame = raw === "1";
    } catch {
      /* 存储不可用时用默认值 */
    }
    sound.init();
    set({ followGame, soundOn: sound.isEnabled, cursor: readCursor() });
  },

  setFollowGame: (v) => {
    try {
      localStorage.setItem(FOLLOW_KEY, v ? "1" : "0");
    } catch {
      /* 存储不可用时仅保留内存态 */
    }
    set({ followGame: v });
  },

  setSoundOn: (v) => {
    sound.setEnabled(v);
    set({ soundOn: v });
  },

  setCursor: (patch) =>
    set((cur) => {
      const next = { ...cur.cursor, ...patch };
      writeCursor(next);
      return { cursor: next };
    }),
}));