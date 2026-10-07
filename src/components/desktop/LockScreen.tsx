"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { GAMES, type GameId, type ThemeId } from "@/lib/games";
import { sound } from "@/lib/sound";
import RollingText from "./RollingText";
import Wallpaper from "./Wallpaper";
import { LogoMark, Squircle } from "./icons";

interface LockScreenProps {
  theme: ThemeId;
  onExitStart?: () => void;
  onUnlock: (gameId: GameId | null) => void;
}

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function LockScreen({ theme, onExitStart, onUnlock }: LockScreenProps) {
  const [stage, setStage] = useState<"boot" | "locked">("boot");
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const now = useNow();

  // 开机音效（占位）
  useEffect(() => {
    sound.play("boot");
  }, []);

  // 进度按真实时钟推进（rAF 负责平滑，watchdog 保证后台标签页也能完成开机）
  useEffect(() => {
    const t0 = performance.now();
    const DURATION = 2200;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / DURATION);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const watchdog = setInterval(() => {
      if (performance.now() - t0 > DURATION + 300) {
        setProgress(1);
        setStage("locked");
      }
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
    };
  }, []);

  const beginExit = (g: GameId | null) => {
    if (exiting) return;
    setExiting(true);
    // 锁屏退场与桌面入场同时开始，交叉溶解成一次过渡，避免「先露出桌面再重新入场」的双重刷新
    onExitStart?.();
    sound.play("unlock");
    window.setTimeout(() => onUnlock(g), 550);
  };

  // 锁屏阶段按任意键也可解锁
  useEffect(() => {
    if (stage !== "locked" || exiting) return;
    const onKey = () => beginExit(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, exiting]);

  const dateText = now
    ? now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })
    : " ";
  const timeText = now
    ? now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  // 时段问候语
  const greeting = now
    ? (() => {
        const h = now.getHours();
        if (h >= 5 && h < 11) return "早上好，旅行者 ✦";
        if (h < 14) return "中午好，旅行者 ✦";
        if (h < 18) return "下午好，旅行者 ✦";
        if (h < 23) return "晚上好，旅行者 ✦";
        return "夜深了，注意休息 ✦";
      })()
    : "";

  return (
    <div
      className={`absolute inset-0 z-50 overflow-hidden transition-all duration-500 ease-out ${
        exiting ? "pointer-events-none -translate-y-8 scale-[1.02] opacity-0" : "opacity-100"
      }`}
      onClick={() => stage === "locked" && beginExit(null)}
    >
      {/* 毛玻璃层：把后面的桌面糊成轮廓。boot 阶段被不透明壁纸盖住无感；
          不做任何 opacity 动画（红线1），常驻即可 */}
      <div className="absolute inset-0 backdrop-blur-[28px] backdrop-saturate-[1.2]" />

      {/* 壁纸：boot 全遮住，锁屏降到 0.72 隐约透出模糊桌面；
          brightness 随开机进度由暗到亮（rAF 驱动，无 transition） */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: stage === "locked" ? 0.72 : 1,
          filter: `brightness(${0.55 + progress * 0.45})`,
        }}
      >
        <Wallpaper theme={theme} />
      </div>

      <div className="relative flex h-full flex-col items-center px-6">
        {/* 日期 + 大时钟 */}
        <div className="mt-[6vh] flex flex-col items-center">
          <div className="text-[15px] font-semibold text-white/95 drop-shadow-sm">
            {dateText}
          </div>
          <RollingText
            value={timeText}
            className="mt-1 block select-none text-[min(30vw,28vh)] font-thin leading-none tracking-tight text-white/65 tabular-nums drop-shadow-sm md:text-[min(24vw,34vh)]"
          />
        </div>

        {stage === "boot" && (
          /* 开机进度条 */
          <div className="mt-[6vh] h-1 w-44 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-[#4a8df0]"
              style={{ width: `${3 + progress * 97}%` }}
            />
          </div>
        )}

        {/* Logo + 时段问候语 + 名称 */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <LogoMark className="h-11 w-11 text-white/95 drop-shadow" />
          {greeting && (
            <div className="animate-fade-in text-[13px] tracking-wide text-white/85">
              {greeting}
            </div>
          )}
          <div className="text-[24px] font-bold tracking-wide text-white drop-shadow-sm">
            Game-Agent
          </div>
          <div className="text-[12px] font-medium tracking-[0.4em] text-white/85">
            二次元游戏桌面
          </div>
        </div>

        {/* 解锁提示（替换原「点击解锁」按钮） */}
        {stage === "locked" && (
          <div className="mt-[4vh] text-[11px] font-medium tracking-[0.3em] text-white/70">
            点击任意位置解锁
          </div>
        )}

        {/* 底部：快捷方式（外链 + 游戏入口） */}
        {stage === "locked" ? (
          <div className="mt-auto flex w-full flex-col items-center gap-3 pb-6">
            <div className="flex items-center gap-2.5">
              <a
                className="lock-pill"
                href="https://www.hoyolab.com"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                HoYoLAB ↗
              </a>
              <a
                className="lock-pill"
                href="https://www.miyoushe.com"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                米游社 ↗
              </a>
            </div>
            <div className="flex max-w-[560px] flex-wrap items-center justify-center gap-2.5">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  className="glass-deep lock-pill"
                  title={`解锁并打开${g.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    beginExit(g.id);
                  }}
                >
                  <Squircle size={20}>
                    <Image
                      src={g.icon}
                      alt=""
                      width={20}
                      height={20}
                      className="block h-full w-full object-cover"
                    />
                  </Squircle>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-auto pb-6 text-[10px] tracking-[0.35em] text-white/55">
            正在准备桌面 · PREPARING DESKTOP
          </div>
        )}
      </div>
    </div>
  );
}
