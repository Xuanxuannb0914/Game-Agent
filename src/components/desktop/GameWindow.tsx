"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { GAMES, type GameMeta } from "@/lib/games";
import {
  useWindowStore,
  topWindowId,
  MIN_W,
  MIN_H,
  NOTE_MIN_W,
  NOTE_MIN_H,
  type WinState,
} from "@/stores/windowStore";
import NotesWindow from "./NotesWindow";
import { Squircle } from "./icons";

const STATUS_ROWS: { label: string; value: string }[] = [
  { label: "今日体力", value: "待接入" },
  { label: "上次游玩", value: "待接入" },
  { label: "成就进度", value: "待接入" },
  { label: "自动签到", value: "待接入" },
];

/** Dock 导航条中心（飞向/飞回的目标点） */
function dockCenter(): { x: number; y: number } | null {
  const el = document.querySelector("nav.os-dock-nav");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface Fly {
  dx: number;
  dy: number;
  dir: "out" | "in";
}

/** 游戏窗口内容（信息卡） */
function GameContent({ game }: { game: GameMeta }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="flex items-center gap-4">
        <Squircle size={56} className="shrink-0 [filter:drop-shadow(0_4px_10px_rgba(0,0,0,0.2))]">
          <Image
            src={game.icon}
            alt={game.name}
            width={56}
            height={56}
            className="block h-full w-full object-cover"
          />
        </Squircle>
        <div>
          <div className="text-[17px] font-bold">{game.name}</div>
          <div className="text-[11px] tracking-wide text-[var(--ink-sub)]">
            {game.en}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              {game.developer}
            </span>
            <span className="rounded-md bg-[var(--ink-sub)]/10 px-1.5 py-0.5 text-[10px] text-[var(--ink-sub)]">
              {game.type}
            </span>
          </div>
        </div>
      </div>

      <div className="my-4 border-t border-black/[.07]" />

      <div className="flex flex-col gap-2.5">
        {STATUS_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg bg-[var(--ink-sub)]/[.07] px-3 py-2"
          >
            <span className="text-[13px]">{row.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--ink-sub)]">
                {row.value}
              </span>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                开发中
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-sub)]">
        {game.name}
        的状态数据接入正在开发中，后续将在这里显示体力、签到、成就等实时信息。
      </p>
    </div>
  );
}

function WindowFrame({ win }: { win: WinState }) {
  const game = win.app === "game" ? GAMES.find((g) => g.id === win.gameId) : undefined;
  const windows = useWindowStore((s) => s.windows);
  const restoring = useWindowStore((s) => s.restoring);
  const focused = topWindowId(windows) === win.id;
  const minW = win.app === "notes" ? NOTE_MIN_W : MIN_W;
  const minH = win.app === "notes" ? NOTE_MIN_H : MIN_H;

  // 飞出/飞入动画状态：dir="in" 时先跳到起点（无过渡），下一帧清除后过渡回位
  const [fly, setFly] = useState<Fly | null>(null);
  const flyJump = fly?.dir === "in";

  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  // Dock 点击恢复 → 从 Dock 中心飞回原位。
  // 用 useLayoutEffect 在浏览器绘制前先跳到起点，避免恢复时闪一帧完整窗口。
  useLayoutEffect(() => {
    if (win.minimized || restoring?.id !== win.id) return;
    const dx = restoring.from.x - (win.pos.x + win.size.w / 2);
    const dy = restoring.from.y - (win.pos.y + win.size.h / 2);
    setFly({ dx, dy, dir: "in" });
    const raf = requestAnimationFrame(() => {
      setFly(null);
      useWindowStore.getState().clearRestoring(win.id);
    });
    return () => cancelAnimationFrame(raf);
  }, [restoring, win.minimized, win.id, win.pos.x, win.pos.y, win.size.w, win.size.h]);

  const onMinimize = () => {
    const c = dockCenter();
    if (!c) {
      useWindowStore.getState().minimize(win.id);
      return;
    }
    const dx = c.x - (win.pos.x + win.size.w / 2);
    const dy = c.y - (win.pos.y + win.size.h / 2);
    setFly({ dx, dy, dir: "out" });
    timers.current.push(
      window.setTimeout(() => {
        useWindowStore.getState().minimize(win.id);
        setFly(null);
      }, 500),
    );
  };

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (win.maximized) return;
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: win.pos.x,
      oy: win.pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTitlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.max(-(win.size.w - 100), Math.min(vw - 100, d.ox + e.clientX - d.sx));
    const y = Math.max(0, Math.min(vh - 48, d.oy + e.clientY - d.sy));
    useWindowStore.getState().move(win.id, { x, y });
  };

  const onTitlePointerUp = () => {
    dragRef.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    // stopPropagation 阻断了窗口容器的置顶，这里补一次，保证拖拽 resize 也置顶
    useWindowStore.getState().focus(win.id);
    resizeRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ow: win.size.w,
      oh: win.size.h,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    const d = resizeRef.current;
    if (!d) return;
    useWindowStore.getState().resize(win.id, {
      w: Math.max(minW, d.ow + e.clientX - d.sx),
      h: Math.max(minH, d.oh + e.clientY - d.sy),
    });
  };

  const onResizePointerUp = () => {
    resizeRef.current = null;
  };

  return (
    <div
      className="os-window absolute flex flex-col rounded-2xl ring-1 ring-black/10"
      style={{
        left: win.pos.x,
        top: win.pos.y,
        width: win.size.w,
        height: win.size.h,
        zIndex: win.z,
        display: win.minimized ? "none" : undefined,
        transform: fly ? `translate(${fly.dx}px, ${fly.dy}px) scale(0.1)` : undefined,
        opacity: fly ? 0 : undefined,
        transition: flyJump
          ? "none"
          : "transform 500ms cubic-bezier(0.4, 0.1, 0.2, 1), opacity 500ms ease",
        boxShadow: focused
          ? undefined
          : "0 2px 6px rgba(15,23,42,0.10), 0 24px 64px rgba(15,23,42,0.28)",
      }}
      onPointerDown={() => useWindowStore.getState().focus(win.id)}
    >
      {/* 标题栏：拖拽 + 双击最大化 */}
      <div
        className="flex h-11 shrink-0 cursor-grab items-center border-b border-black/[.06] bg-black/[.03] px-4 active:cursor-grabbing"
        style={{ filter: focused ? undefined : "saturate(0.4)" }}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onDoubleClick={() => useWindowStore.getState().toggleMaximize(win.id)}
      >
        <div className="flex w-14 items-center gap-2">
          <button
            aria-label="关闭窗口"
            className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-black/10 transition-colors hover:brightness-90"
            onClick={() => useWindowStore.getState().close(win.id)}
          />
          <button
            aria-label="最小化窗口"
            className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-black/10 transition-colors hover:brightness-90"
            onClick={onMinimize}
          />
          <button
            aria-label="最大化窗口"
            className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-black/10 transition-colors hover:brightness-90"
            onClick={() => useWindowStore.getState().toggleMaximize(win.id)}
          />
        </div>
        <div className="flex-1 text-center text-[13px] font-semibold">
          {win.title}
          {win.maximized ? " · 已最大化" : ""}
        </div>
        <div className="w-14" />
      </div>

      {/* 内容：便签为满铺编辑器，其余为游戏信息卡 */}
      {win.app === "notes" ? (
        <NotesWindow noteId={win.noteId!} />
      ) : (
        game && <GameContent game={game} />
      )}

      {/* 右下角 resize 手柄 */}
      <div
        aria-label="调整窗口大小"
        className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-black/25" aria-hidden>
          <path
            d="M15 6 6 15M15 10.5 10.5 15M15 15h-0.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

/** 渲染所有窗口；最小化的窗口保留在 DOM 中（display:none），以保留内容与滚动状态 */
export default function WindowLayer() {
  const windows = useWindowStore((s) => s.windows);
  return (
    <>
      {windows.map((w) => (
        <WindowFrame key={w.id} win={w} />
      ))}
    </>
  );
}
