"use client";

import { useRef, useState } from "react";
import { useWidgetStore, type FloatingWidget } from "@/stores/widgetStore";
import { WidgetCard, type WidgetCtx } from "./WidgetCards";

function FloatingCard({ f, ctx }: { f: FloatingWidget; ctx: WidgetCtx }) {
  const move = useWidgetStore((s) => s.move);
  const dockIn = useWidgetStore((s) => s.dockIn);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [pos, setPos] = useState({ x: f.x, y: f.y });

  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos({
      x: Math.max(4, Math.min(window.innerWidth - 80, d.ox + e.clientX - d.sx)),
      y: Math.max(44, Math.min(window.innerHeight - 44, d.oy + e.clientY - d.sy)),
    });
  };

  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    move(f.id, pos.x, pos.y);
  };

  return (
    <div className="absolute z-[12]" style={{ left: pos.x, top: pos.y, width: f.w }}>
      {/* 拖拽把手（复用窗口标题栏的 Pointer 拖拽逻辑）；双击收回右侧栏 */}
      <div
        className="mb-1 flex h-5 cursor-grab items-center gap-1.5 rounded-md bg-slate-900/55 px-2 text-[9px] text-white/85 ring-1 ring-white/15 active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => dockIn(f.id)}
        title="拖动移动 · 双击收回右侧栏"
      >
        <span className="tracking-[0.18em]">⠿ 小组件</span>
        <span className="ml-auto opacity-75">双击收回</span>
      </div>
      <WidgetCard id={f.id} ctx={ctx} />
    </div>
  );
}

/** 桌面上被拖出的小组件层（与右侧栏互斥） */
export default function FloatingWidgets({ ctx }: { ctx: WidgetCtx }) {
  const floating = useWidgetStore((s) => s.floating);
  return (
    <>
      {floating.map((f) => (
        <FloatingCard key={f.id} f={f} ctx={ctx} />
      ))}
    </>
  );
}