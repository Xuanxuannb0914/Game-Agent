"use client";

import { useEffect, useState } from "react";
import { WALL_THEMES, type ThemeId } from "@/lib/games";
import { computeWallpaper, type WallBlend } from "@/lib/wallpaper";

/**
 * 壁纸层。theme === "auto" 时按真实时间在 dawn/day/dusk/night 间线性插值：
 * 下层放 from 组、上层放 to 组并用 --dawn-blend 控制透明度，每分钟重算一次。
 */
export default function Wallpaper({ theme }: { theme: ThemeId }) {
  const [blend, setBlend] = useState<WallBlend | null>(null);

  useEffect(() => {
    if (theme !== "auto") return;
    const tick = () => setBlend(computeWallpaper(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [theme]);

  if (theme === "auto") {
    const b: WallBlend = blend ?? { from: "night", to: "night", blend: 0 };
    return (
      <div
        className="absolute inset-0"
        style={{ "--dawn-blend": b.blend } as React.CSSProperties}
      >
        <div className={`wall-layer wall-${b.from} wall-active`} />
        <div className={`wall-layer wall-${b.to}`} style={{ opacity: b.blend }} />
        <div className="grain" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {WALL_THEMES.map((t) => (
        <div
          key={t.id}
          className={`wall-layer wall-${t.id} ${theme === t.id ? "wall-active" : ""}`}
        />
      ))}
      <div className="grain" />
    </div>
  );
}