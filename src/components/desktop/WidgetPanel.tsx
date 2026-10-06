"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GAMES, type GameId, type ThemeId } from "@/lib/games";
import { useWidgetStore } from "@/stores/widgetStore";
import { WidgetCard, type WidgetCtx } from "./WidgetCards";
import { EyeOffIcon } from "./icons";

interface WidgetPanelProps {
  theme: ThemeId;
  onTheme: (t: ThemeId, e: { clientX: number; clientY: number }) => void;
  onOpenGame: (id: GameId) => void;
  /** <lg 视口下的抽屉开合（≥lg 常驻，忽略该值） */
  open: boolean;
  onClose: () => void;
}

/** 编辑模式下被隐藏的卡片 id（localStorage 持久化） */
const HIDDEN_KEY = "ga:widget-hidden";

/**
 * 右侧栏卡片：编辑态抖动 + 隐藏按钮；拖动（复用窗口拖拽的 Pointer 逻辑）拖出栏外
 * 即 dockOut 到桌面（与右侧栏互斥），拖动过程用 portal 渲染跟随光标的幽灵。
 */
function RailCard({
  id,
  editing,
  hidden,
  onHide,
  children,
}: {
  id: string;
  editing: boolean;
  hidden: string[];
  onHide: (id: string) => void;
  children: React.ReactNode;
}) {
  const isFloating = useWidgetStore((s) => s.floating.some((f) => f.id === id));
  const dockOut = useWidgetStore((s) => s.dockOut);

  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; active: boolean } | null>(null);
  const suppress = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (hidden.includes(id) || isFloating) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("textarea, input")) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, active: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const r = ref.current?.getBoundingClientRect();
      setGhost({ x: r?.left ?? e.clientX, y: r?.top ?? e.clientY, w: r?.width ?? 280 });
    }
    setGhost((g) => (g ? { ...g, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) } : g));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    suppress.current = true;
    window.setTimeout(() => {
      suppress.current = false;
    }, 0);
    setGhost(null);

    const rail = document.querySelector("[data-widget-rail]");
    const rect = rail?.getBoundingClientRect();
    const outside = rect
      ? e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom
      : true;
    if (outside) {
      const x = Math.max(8, Math.min(window.innerWidth - 120, d.ox + (e.clientX - d.sx)));
      const y = Math.max(48, Math.min(window.innerHeight - 80, d.oy + (e.clientY - d.sy)));
      dockOut(id, x, y, ref.current?.offsetWidth ?? 280);
    }
  };

  return (
    <div
      ref={ref}
      className={`relative ${editing ? "widget-shake" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (suppress.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {editing && (
        <button
          type="button"
          aria-label="隐藏该卡片"
          title="隐藏该卡片"
          onClick={(e) => {
            e.stopPropagation();
            onHide(id);
          }}
          className="absolute top-2 left-2 z-20 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/25 transition-colors hover:bg-black/75"
        >
          <EyeOffIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
      {mounted && ghost
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] opacity-90"
              style={{ left: ghost.x, top: ghost.y, width: ghost.w }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function WidgetPanel({
  theme,
  onTheme,
  onOpenGame,
  open,
  onClose,
}: WidgetPanelProps) {
  const ctx: WidgetCtx = { theme, onTheme, onOpenGame };
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const hydrate = useWidgetStore((s) => s.hydrate);

  // 恢复桌面上已拖出的小组件
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 刷新后恢复隐藏状态
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw));
    } catch {
      /* 忽略损坏的本地数据 */
    }
  }, []);

  const hideCard = (id: string) => {
    setHidden((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        /* 存储不可用时仅保留内存态 */
      }
      return next;
    });
  };

  return (
    <>
      {/* 抽屉遮罩（<lg）：黑/30，点击关闭；≥lg 隐藏 */}
      <div
        className={`fixed inset-0 z-[45] bg-black/30 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        data-widget-rail
        className={`widget-panel-enter no-scrollbar flex flex-col gap-3.5 overflow-y-auto
          fixed top-10 right-0 bottom-0 z-[46] w-full bg-[var(--win)] px-5 pt-5 pb-6 shadow-2xl
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}
          lg:absolute lg:top-14 lg:right-5 lg:bottom-6 lg:z-10 lg:w-[318px] lg:translate-x-0
          lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0 lg:pr-0.5 lg:shadow-none`}
        aria-label="组件面板"
      >
        {/* 面板标题区 + 编辑开关 */}
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[12px] font-semibold">小组件</div>
            <div className="mt-0.5 text-[9px] tracking-[0.22em] text-[var(--ink-sub)]">
              WIDGETS
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ring-1 transition-colors ${
              editing
                ? "bg-[var(--accent)] text-white ring-transparent"
                : "bg-[var(--tile)] text-[var(--ink)] ring-black/10 hover:brightness-105"
            }`}
          >
            {editing ? "完成" : "编辑"}
          </button>
        </div>

        <RailCard id="theme" editing={editing} hidden={hidden} onHide={hideCard}>
          <WidgetCard id="theme" ctx={ctx} />
        </RailCard>

        <RailCard id="now-playing" editing={editing} hidden={hidden} onHide={hideCard}>
          <WidgetCard id="now-playing" ctx={ctx} />
        </RailCard>

        {/* 实时状态：2×2 游戏小卡（整卡可点击开窗） */}
        <div className="grid grid-cols-2 gap-3.5">
          {GAMES.map((g) => (
            <RailCard
              key={g.id}
              id={`game-${g.id}`}
              editing={editing}
              hidden={hidden}
              onHide={hideCard}
            >
              <WidgetCard id={`game-${g.id}`} ctx={ctx} />
            </RailCard>
          ))}
        </div>

        <RailCard id="weekly" editing={editing} hidden={hidden} onHide={hideCard}>
          <WidgetCard id="weekly" ctx={ctx} />
        </RailCard>

        <RailCard id="achievements" editing={editing} hidden={hidden} onHide={hideCard}>
          <WidgetCard id="achievements" ctx={ctx} />
        </RailCard>

        <RailCard id="today" editing={editing} hidden={hidden} onHide={hideCard}>
          <WidgetCard id="today" ctx={ctx} />
        </RailCard>
      </aside>
    </>
  );
}