"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { GAMES, type GameId } from "@/lib/games";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useWindowStore } from "@/stores/windowStore";
import { useNoteStore } from "@/stores/noteStore";
import {
  CalendarIcon,
  GamepadIcon,
  GearIcon,
  GridIcon,
  NotesIcon,
  Squircle,
  TrophyIcon,
} from "./icons";

const FUNCTIONS: { label: string; icon: (p: { className?: string }) => React.ReactNode; href?: string }[] = [
  { label: "启动台", icon: GridIcon },
  { label: "每日签到", icon: CalendarIcon },
  // 「成就」→ 年度报告页（彩蛋入口）
  { label: "成就", icon: TrophyIcon, href: "/report" },
  { label: "手柄", icon: GamepadIcon },
  { label: "设置", icon: GearIcon },
];

/* 放大镜参数：中心 1.45 倍，高斯衰减 σ=70px（约覆盖相邻 2 个图标） */
const MAX_SCALE = 1.45;
const SIGMA = 70;

export default function Dock() {
  const navRef = useRef<HTMLElement>(null);
  const tileRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const windows = useWindowStore((s) => s.windows);

  const openOrRestore = (gameId: GameId) => {
    const s = useWindowStore.getState();
    const w = s.windows.find((x) => x.gameId === gameId);
    if (w && w.minimized) {
      // 从 Dock 中心飞回
      const r = navRef.current?.getBoundingClientRect();
      const from = r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight - 40 };
      s.restoreWin(w.id, from);
      return;
    }
    s.open(gameId);
  };

  const noteWin = windows.find((w) => w.app === "notes");

  const dockCenter = () => {
    const r = navRef.current?.getBoundingClientRect();
    return r
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight - 40 };
  };

  const openNotes = () => {
    const s = useWindowStore.getState();
    if (noteWin) {
      if (noteWin.minimized) s.restoreWin(noteWin.id, dockCenter());
      else s.focus(noteWin.id);
      return;
    }
    const store = useNoteStore.getState();
    const n = store.notes[0] ?? store.create();
    s.openNote(n.id);
  };

  const magnify = (e: React.MouseEvent) => {
    if (reduced || !navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    tileRefs.current.forEach((el) => {
      if (!el) return;
      const center = el.offsetLeft + el.offsetWidth / 2;
      const d = mx - center;
      const s = 1 + (MAX_SCALE - 1) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      el.style.transform = `scale(${s.toFixed(3)})`;
    });
  };

  const reset = () => {
    tileRefs.current.forEach((el) => {
      if (el) el.style.transform = "";
    });
  };

  const tileCls =
    "relative grid h-11 w-11 place-items-center transition-transform duration-100 ease-out will-change-transform";

  return (
    <div
      className="enter-dock absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ "--enter-delay": "320ms" } as React.CSSProperties}
    >
      <div className="text-[9px] font-medium tracking-[0.3em] text-[var(--ink)]/55">
        常用功能 · QUICK ACTIONS
      </div>
      <nav
        ref={navRef}
        className="glass-deep os-dock-nav relative flex items-end gap-2 rounded-2xl border border-[var(--dock-border)] px-3 py-2"
        onMouseMove={magnify}
        onMouseLeave={reset}
      >
        {/* 功能入口（带 href 的直接跳转，如「成就」→ 年度报告） */}
        {FUNCTIONS.map(({ label, icon: Icon, href }, i) => {
          const tile = (
            <>
              <span className="pointer-events-none absolute -top-9 hidden rounded-md bg-black/75 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-active:block">
                {label} · {href ? "年度报告" : "开发中"}
              </span>
              <span
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                className={`${tileCls} rounded-[12px] bg-[var(--tile)] text-[var(--ink)] shadow-sm ring-1 ring-white/30`}
                style={{ transformOrigin: "bottom center" }}
              >
                <Icon className="h-5 w-5" />
              </span>
            </>
          );
          const cls = "group relative flex flex-col items-center";
          return href ? (
            <Link key={label} href={href} className={cls} title={label}>
              {tile}
            </Link>
          ) : (
            <button key={label} className={cls} title={`${label}（开发中）`}>
              {tile}
            </button>
          );
        })}

        {/* 分隔线 */}
        <span className="mx-1 h-8 w-px self-center bg-[var(--dock-border)]" />

        {/* 便签 App：点击打开/聚焦，最小化时恢复 */}
        <button
          className="group relative flex flex-col items-center"
          title={`便签 · ${noteWin ? (noteWin.minimized ? "已最小化" : "运行中") : "未打开"}`}
          onClick={openNotes}
        >
          <span className="pointer-events-none absolute -top-9 hidden rounded-md bg-black/75 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-active:block">
            便签 · {noteWin ? (noteWin.minimized ? "已最小化" : "运行中") : "未打开"}
          </span>
          <span
            ref={(el) => {
              tileRefs.current[FUNCTIONS.length] = el;
            }}
            className={tileCls}
            style={{ transformOrigin: "bottom center" }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#fdf6d3] text-amber-700 shadow-sm ring-1 ring-black/10">
              <NotesIcon className="h-5 w-5" />
            </span>
            {noteWin && (
              <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
            )}
          </span>
        </button>

        {/* 游戏入口：点击打开/聚焦，最小化时恢复 */}
        {GAMES.map((g, i) => {
          const w = windows.find((x) => x.gameId === g.id);
          const state = w ? (w.minimized ? "已最小化" : "运行中") : "未打开";
          const idx = FUNCTIONS.length + 1 + i;
          return (
            <button
              key={g.id}
              data-ctx="dock-game"
              data-game={g.id}
              className="group relative flex flex-col items-center"
              title={`${g.name} · ${state}`}
              onClick={() => openOrRestore(g.id)}
            >
              <span className="pointer-events-none absolute -top-9 hidden rounded-md bg-black/75 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-active:block">
                {g.name} · {state}
              </span>
              <span
                ref={(el) => {
                  tileRefs.current[idx] = el;
                }}
                className={tileCls}
                style={{ transformOrigin: "bottom center" }}
              >
                <Squircle size={40} className="[filter:drop-shadow(0_2px_5px_rgba(15,23,42,0.25))]">
                  <Image
                    src={g.icon}
                    alt={g.name}
                    width={40}
                    height={40}
                    draggable={false}
                    className="block h-full w-full object-cover"
                  />
                </Squircle>
                {/* 运行指示点：有打开/最小化窗口的游戏 */}
                {w && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
