"use client";

import Link from "next/link";
import {
  CalendarIcon,
  GamepadIcon,
  GearIcon,
  GridIcon,
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

const tileCls =
  "relative grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--tile)] text-[var(--ink)] shadow-sm ring-1 ring-white/30";

export default function Dock() {
  return (
    <div
      className="enter-dock absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ "--enter-delay": "320ms" } as React.CSSProperties}
    >
      <div className="text-[9px] font-medium tracking-[0.3em] text-[var(--ink)]/55">
        常用功能 · QUICK ACTIONS
      </div>
      <nav className="glass-deep os-dock-nav relative flex items-end gap-2 rounded-2xl border border-[var(--dock-border)] px-3 py-2">
        {/* 功能入口（带 href 的直接跳转，如「成就」→ 年度报告） */}
        {FUNCTIONS.map(({ label, icon: Icon, href }) => {
          const tile = (
            <>
              <span className="pointer-events-none absolute -top-9 hidden rounded-md bg-black/75 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-active:block">
                {label} · {href ? "年度报告" : "开发中"}
              </span>
              <span className={tileCls}>
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
      </nav>
    </div>
  );
}