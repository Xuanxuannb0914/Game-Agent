import { create } from "zustand";

/** 被拖到桌面上的小组件：位置与宽度持久化 */
export interface FloatingWidget {
  id: string;
  x: number;
  y: number;
  w: number;
}

const KEY = "ga:floating-widgets";

interface WidgetStore {
  floating: FloatingWidget[];
  hydrate: () => void;
  dockOut: (id: string, x: number, y: number, w: number) => void;
  move: (id: string, x: number, y: number) => void;
  dockIn: (id: string) => void;
}

function persist(floating: FloatingWidget[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(floating));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

export const useWidgetStore = create<WidgetStore>((set, get) => ({
  floating: [],

  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) set({ floating: JSON.parse(raw) });
    } catch {
      /* 忽略损坏的本地数据 */
    }
  },

  dockOut: (id, x, y, w) => {
    const floating = [
      ...get().floating.filter((f) => f.id !== id),
      { id, x, y, w },
    ];
    persist(floating);
    set({ floating });
  },

  move: (id, x, y) => {
    const floating = get().floating.map((f) => (f.id === id ? { ...f, x, y } : f));
    persist(floating);
    set({ floating });
  },

  dockIn: (id) => {
    const floating = get().floating.filter((f) => f.id !== id);
    persist(floating);
    set({ floating });
  },
}));