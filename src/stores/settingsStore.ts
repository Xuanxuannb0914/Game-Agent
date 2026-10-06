import { create } from "zustand";
import { sound } from "@/lib/sound";

/** 「主题跟随游戏」持久化键；音效开关由 sound 单例用 ga:sound 管理 */
const FOLLOW_KEY = "ga:follow-game";

interface SettingsStore {
  /** 壁纸主题是否跟随最顶层游戏窗口（默认开） */
  followGame: boolean;
  /** 音效开关（默认关） */
  soundOn: boolean;
  hydrate: () => void;
  setFollowGame: (v: boolean) => void;
  setSoundOn: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  followGame: true,
  soundOn: false,

  hydrate: () => {
    let followGame = true;
    try {
      const raw = localStorage.getItem(FOLLOW_KEY);
      if (raw !== null) followGame = raw === "1";
    } catch {
      /* 存储不可用时用默认值 */
    }
    sound.init();
    set({ followGame, soundOn: sound.isEnabled });
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
}));