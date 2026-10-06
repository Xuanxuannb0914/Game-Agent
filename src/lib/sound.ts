export type SoundName = "boot" | "unlock" | "achievement";

const VOLUME = 0.4;
const KEY = "ga:sound";

/**
 * 音效管理器（单例）：默认关闭，开关持久化；播放用 HTMLAudioElement，音量固定 0.4。
 * 资源为空占位文件时 play() 会 reject，这里静默吞掉。
 */
class SoundManager {
  private enabled = false;

  /** 客户端挂载后调用：读取持久化的开关状态 */
  init() {
    try {
      this.enabled = localStorage.getItem(KEY) === "1";
    } catch {
      this.enabled = false;
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* 存储不可用时仅保留内存态 */
    }
  }

  play(name: SoundName) {
    if (!this.enabled) return;
    try {
      const audio = new Audio(`/sounds/${name}.mp3`);
      audio.volume = VOLUME;
      void audio.play().catch(() => {});
    } catch {
      /* 资源缺失或播放被拦截时静默失败 */
    }
  }
}

export const sound = new SoundManager();