"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useContextMenuStore,
  type MenuItem,
} from "@/stores/contextMenuStore";

const EDGE = 8;

/** 子菜单：默认向右展开，贴近右边缘时翻转到左侧；尺寸变化时重新判定 */
function SubMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<"right" | "left">("right");

  const decide = useCallback(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const w = el.offsetWidth;
    const p = parent.getBoundingClientRect();
    setSide(p.right + w + EDGE > window.innerWidth ? "left" : "right");
  }, []);

  useLayoutEffect(() => decide(), [decide]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => decide());
    ro.observe(el);
    return () => ro.disconnect();
  }, [decide]);

  return (
    <div
      ref={ref}
      role="menu"
      className={`os-drop ctx-pop absolute top-0 min-w-40 rounded-xl ${
        side === "right" ? "left-full -ml-1" : "right-full -mr-1"
      }`}
    >
      <MenuItems items={items} onClose={onClose} />
    </div>
  );
}

function MenuItems({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [openSub, setOpenSub] = useState<number | null>(null);

  return (
    <div className="flex flex-col">
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          className="relative"
          onMouseEnter={() => setOpenSub(it.children ? i : null)}
        >
          <button
            type="button"
            role="menuitem"
            className={`menu-item ${it.danger ? "text-red-500" : ""}`}
            disabled={it.disabled}
            aria-haspopup={it.children ? "menu" : undefined}
            onClick={() => {
              if (it.disabled || it.children) return;
              it.onClick?.();
              onClose();
            }}
          >
            {it.color && (
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ background: it.color }}
              />
            )}
            <span className="truncate">{it.label}</span>
            {it.shortcut && (
              <span className="ml-auto text-[11px] tabular-nums opacity-50">
                {it.shortcut}
              </span>
            )}
            {it.children && <span className="ml-auto text-[12px] opacity-60">›</span>}
          </button>

          {it.children && openSub === i && (
            <SubMenu items={it.children} onClose={onClose} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContextMenu() {
  const open = useContextMenuStore((s) => s.open);
  const x = useContextMenuStore((s) => s.x);
  const y = useContextMenuStore((s) => s.y);
  const config = useContextMenuStore((s) => s.config);
  const close = useContextMenuStore((s) => s.close);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // 按屏幕边缘翻转防溢出：始终以光标坐标 (x,y) 为基准、用「当前实测尺寸」计算，
  // 因此字体加载/内容变化导致宽度变化后仍能保持不溢出。
  const clamp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nx = x + w + EDGE > vw ? Math.max(EDGE, vw - w - EDGE) : x;
    const ny = y + h + EDGE > vh ? Math.max(EDGE, vh - h - EDGE) : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  // 绘制前先定位，避免闪动
  useLayoutEffect(() => {
    if (!open) return;
    setPos({ x, y });
    clamp();
  }, [open, x, y, config, clamp]);

  // 尺寸变化（如字体加载完成）后重新夹取
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => clamp());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, clamp]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open || !config) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className="os-drop ctx-pop fixed z-[9999] min-w-52 max-w-[calc(100vw-16px)] rounded-xl p-1.5"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <MenuItems items={config.items} onClose={close} />
    </div>
  );
}