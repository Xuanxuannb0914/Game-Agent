"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GAMES, THEMES, type GameId, type ThemeId } from "@/lib/games";
import RollingText from "./RollingText";
import { BellIcon, GridIcon, LogoMark } from "./icons";

interface MenuBarProps {
  theme: ThemeId;
  onTheme: (t: ThemeId, e?: { clientX: number; clientY: number }) => void;
  onOpenGame: (id: GameId) => void;
  /** <lg 视口下组件抽屉是否展开（≥lg 常驻，按钮隐藏） */
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  /** 设置页（居中弹层）是否已打开，用于按钮高亮 */
  settingsOpen: boolean;
  onOpenSettings: () => void;
}

type MenuKey = "games" | "view" | null;

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function MenuButton({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
          open ? "bg-[var(--menu-hover)]" : "hover:bg-[var(--menu-hover)]"
        }`}
        onClick={onToggle}
      >
        {label}
      </button>
      {open && (
        <div className="os-drop animate-pop absolute top-full left-0 z-50 mt-1.5 min-w-52 rounded-xl p-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MenuBar({
  theme,
  onTheme,
  onOpenGame,
  drawerOpen,
  onToggleDrawer,
  settingsOpen,
  onOpenSettings,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const now = useClock();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openMenu]);

  const toggle = (key: Exclude<MenuKey, null>) =>
    setOpenMenu((cur) => (cur === key ? null : key));

  const dateText = now
    ? `${now.getMonth() + 1}月${now.getDate()}日 ${now.toLocaleDateString("zh-CN", { weekday: "short" })}`
    : "——";
  const timeText = now
    ? now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  return (
    /* 入场动画挂在不含 backdrop-filter 的包装层上（红线1） */
    <div className="enter-down relative z-40" style={{ "--enter-delay": "0ms" } as React.CSSProperties}>
      <header
        ref={rootRef}
        className="glass-thin relative flex h-10 shrink-0 items-center gap-1 px-4 text-[var(--menu-ink)]"
      >
        <LogoMark className="mr-1.5 h-4 w-4 opacity-90" />
        <span className="mr-3 text-[13px] font-bold tracking-wide">Game-Agent</span>
        <nav className="flex items-center gap-0.5">
          <MenuButton label="游戏" open={openMenu === "games"} onToggle={() => toggle("games")}>
            {GAMES.map((g) => (
              <button
                key={g.id}
                className="menu-item"
                onClick={() => {
                  onOpenGame(g.id);
                  setOpenMenu(null);
                }}
              >
                <Image
                  src={g.icon}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded-[5px]"
                />
                {g.name}
              </button>
            ))}
            <div className="mx-2 my-1 border-t border-black/10" />
            <a
              className="menu-item"
              href="https://www.hoyolab.com"
              target="_blank"
              rel="noreferrer"
            >
              打开 HoYoLAB ↗
            </a>
          </MenuButton>

          <MenuButton label="视图" open={openMenu === "view"} onToggle={() => toggle("view")}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                className="menu-item"
                onClick={(e) => {
                  onTheme(t.id, e);
                  setOpenMenu(null);
                }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                  style={{ background: t.color }}
                />
                {t.label}
                {theme === t.id && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
            <div className="mx-2 my-1 border-t border-black/10" />
            {/* 快捷键说明（灰色小字，不可点击） */}
            <div className="px-2.5 pt-1 pb-1.5 text-[10px] leading-relaxed text-[var(--ink-sub)]">
              <div className="mb-0.5 font-medium tracking-wide">快捷键</div>
              <div className="flex items-center justify-between gap-4">
                <span>打开游戏 1–4</span>
                <span className="tabular-nums opacity-70">⌘/Ctrl 1–4</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>关闭最顶层窗口</span>
                <span className="tabular-nums opacity-70">⌘/Ctrl W</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>关闭窗口 / 菜单 / 抽屉</span>
                <span className="tabular-nums opacity-70">Esc</span>
              </div>
            </div>
          </MenuButton>

          <button
            className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${
              settingsOpen ? "bg-[var(--menu-hover)]" : "hover:bg-[var(--menu-hover)]"
            }`}
            onClick={() => {
              setOpenMenu(null);
              onOpenSettings();
            }}
          >
            设置
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* 组件抽屉开关（仅 <lg 显示，位于时钟左侧） */}
          <button
            type="button"
            aria-label="小组件面板"
            aria-expanded={drawerOpen}
            title="小组件面板"
            onClick={onToggleDrawer}
            className={`grid h-7 w-7 place-items-center rounded-md transition-colors lg:hidden ${
              drawerOpen ? "bg-[var(--menu-hover)]" : "hover:bg-[var(--menu-hover)]"
            }`}
          >
            <GridIcon className="h-4 w-4 opacity-85" />
          </button>
          <BellIcon className="h-4 w-4 opacity-80" />
          <span className="flex items-center gap-2 text-[13px] tabular-nums">
            {dateText}
            <RollingText value={timeText} />
          </span>
        </div>
      </header>
    </div>
  );
}
