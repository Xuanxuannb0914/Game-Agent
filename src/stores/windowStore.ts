import { create } from "zustand";
import { GAMES, type GameId } from "@/lib/games";
import { sound } from "@/lib/sound";

export type AppKind = "game" | "notes";

export interface WinState {
  id: string;
  app: AppKind;
  /** app === "game" 时存在 */
  gameId?: GameId;
  /** app === "notes" 时存在 */
  noteId?: string;
  /** 标题栏文案 */
  title: string;
  z: number;
  pos: { x: number; y: number };
  size: { w: number; h: number };
  minimized: boolean;
  maximized: boolean;
  /** 最大化前的位置与尺寸（还原用） */
  restore?: { pos: { x: number; y: number }; size: { w: number; h: number } };
}

export const DEFAULT_W = 560;
export const DEFAULT_H = 460;
export const MIN_W = 420;
export const MIN_H = 320;

/** 便签窗口尺寸与最小尺寸 */
export const NOTE_W = 320;
export const NOTE_H = 400;
export const NOTE_MIN_W = 240;
export const NOTE_MIN_H = 220;

interface WindowStore {
  windows: WinState[];
  topZ: number;
  /** 恢复飞入动画的起点（Dock 中心），由 Dock 点击时写入 */
  restoring: { id: string; from: { x: number; y: number } } | null;
  open: (gameId: GameId) => void;
  openNote: (noteId: string) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  restoreWin: (id: string, from: { x: number; y: number }) => void;
  clearRestoring: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, pos: { x: number; y: number }) => void;
  resize: (id: string, size: { w: number; h: number }) => void;
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  topZ: 30,
  restoring: null,

  open: (gameId) => {
    const { windows, topZ } = get();
    const existing = windows.find((w) => w.app === "game" && w.gameId === gameId);
    if (existing) {
      // 已开则聚焦并取消最小化
      set({
        topZ: topZ + 1,
        windows: windows.map((w) =>
          w.id === existing.id ? { ...w, z: topZ + 1, minimized: false } : w,
        ),
      });
      return;
    }
    const game = GAMES.find((g) => g.id === gameId)!;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const n = windows.length;
    const x = Math.max(12, Math.min(vw - DEFAULT_W - 12, (vw - DEFAULT_W) / 2 + n * 28 - 40));
    const y = Math.max(52, Math.min(vh - DEFAULT_H - 12, 100 + n * 28));
    // 「成就」音效占位：新开游戏窗口时播放，真实成就事件接入后替换
    sound.play("achievement");
    set({
      topZ: topZ + 1,
      windows: [
        ...windows,
        {
          id: `${gameId}-${Date.now()}`,
          app: "game",
          gameId,
          title: game.name,
          z: topZ + 1,
          pos: { x, y },
          size: { w: DEFAULT_W, h: DEFAULT_H },
          minimized: false,
          maximized: false,
        },
      ],
    });
  },

  openNote: (noteId) => {
    const { windows, topZ } = get();
    const existing = windows.find((w) => w.app === "notes" && w.noteId === noteId);
    if (existing) {
      set({
        topZ: topZ + 1,
        windows: windows.map((w) =>
          w.id === existing.id ? { ...w, z: topZ + 1, minimized: false } : w,
        ),
      });
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const n = windows.length;
    const x = Math.max(12, Math.min(vw - NOTE_W - 12, 120 + n * 26));
    const y = Math.max(52, Math.min(vh - NOTE_H - 12, 90 + n * 26));
    set({
      topZ: topZ + 1,
      windows: [
        ...windows,
        {
          id: `note-${Date.now()}`,
          app: "notes",
          noteId,
          title: "便签",
          z: topZ + 1,
          pos: { x, y },
          size: { w: NOTE_W, h: NOTE_H },
          minimized: false,
          maximized: false,
        },
      ],
    });
  },

  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  focus: (id) => {
    const { windows, topZ } = get();
    const target = windows.find((w) => w.id === id);
    if (!target || target.z === topZ) return;
    set({
      topZ: topZ + 1,
      windows: windows.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)),
    });
  },

  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    })),

  restoreWin: (id, from) =>
    set((s) => ({
      restoring: { id, from },
      topZ: s.topZ + 1,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: false, z: s.topZ + 1 } : w,
      ),
    })),

  clearRestoring: (id) =>
    set((s) => (s.restoring?.id === id ? { restoring: null } : s)),

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized && w.restore) {
          return { ...w, pos: w.restore.pos, size: w.restore.size, maximized: false, restore: undefined };
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
          ...w,
          restore: { pos: w.pos, size: w.size },
          maximized: true,
          pos: { x: 12, y: 46 },
          size: { w: vw - 24, h: vh - 46 - 12 },
        };
      }),
    })),

  move: (id, pos) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, pos } : w)) })),

  resize: (id, size) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, size } : w)) })),
}));

/** 最顶层可见窗口 id */
export function topWindowId(windows: WinState[]): string | null {
  const visible = windows.filter((w) => !w.minimized);
  if (!visible.length) return null;
  return visible.reduce((a, b) => (a.z > b.z ? a : b)).id;
}

/** 某 app 类型是否已有窗口（Dock 指示点用） */
export function hasApp(windows: WinState[], app: AppKind): boolean {
  return windows.some((w) => w.app === app);
}