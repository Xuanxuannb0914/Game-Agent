"use client";

import { useEffect, useRef, useState } from "react";
import { PaimonIcon } from "./icons";

const MESSAGES = [
  "旅行者，今天也要元气满满哦！",
  "需要我帮你打开哪款游戏吗？双击桌面图标就好啦～",
  "听说年度报告已经生成，要不要去看看？",
  "累了就休息一下，派蒙帮你看着桌面！",
  "别忘了看看本周的成就进度哦～",
];

const POS_KEY = "ga:paimon-pos";
const SIZE = 64;

function clamp(p: { x: number; y: number }) {
  return {
    x: Math.max(8, Math.min(window.innerWidth - SIZE - 8, p.x)),
    y: Math.max(48, Math.min(window.innerHeight - SIZE - 8, p.y)),
  };
}

/** 右下角派蒙助手：可拖拽（位置 localStorage 记忆），点击弹出气泡并用打字机输出提示语 */
export default function PaimonAssistant() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");

  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  // 初始位置：右下角；localStorage 记忆
  useEffect(() => {
    let p: { x: number; y: number } | null = null;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) p = JSON.parse(raw);
    } catch {
      /* 忽略损坏的本地数据 */
    }
    setPos(clamp(p ?? { x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 96 }));
    const onResize = () => setPos((cur) => (cur ? clamp(cur) : cur));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 打字机
  useEffect(() => {
    if (!open) return;
    const full = MESSAGES[index % MESSAGES.length];
    setTyped("");
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(t);
    }, 45);
    return () => window.clearInterval(t);
  }, [open, index]);

  const onDown = (e: React.PointerEvent) => {
    if (!pos) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true;
    if (d.moved) setPos(clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      const p = posRef.current;
      if (p) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {
          /* 存储不可用时仅保留内存态 */
        }
      }
      return;
    }
    // 未拖动 → 视为点击：开合气泡；已开时切换到下一条
    if (open) setIndex((i) => i + 1);
    setOpen(!open);
  };

  if (!pos) return null;

  const bubbleLeft = pos.x < 250;

  return (
    <div className="fixed z-[44]" style={{ left: pos.x, top: pos.y }}>
      {open && (
        <div
          role="dialog"
          aria-label="派蒙对话"
          className={`os-drop ctx-pop absolute bottom-[72px] w-60 rounded-2xl p-3 text-[12px] leading-relaxed text-[var(--ink)] ${
            bubbleLeft ? "left-0" : "right-0"
          }`}
          style={{ transformOrigin: bubbleLeft ? "bottom left" : "bottom right" }}
        >
          <div className="text-[11px] font-semibold tracking-wide text-[var(--accent)]">
            派蒙
          </div>
          <p className="mt-1 min-h-[2.6em]">
            {typed}
            <span className="animate-pulse">▍</span>
          </p>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="text-[10px] text-[var(--ink-sub)] transition-colors hover:text-[var(--ink)]"
            >
              下一条 →
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="派蒙助手"
        title="派蒙助手（可拖动）"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="grid h-16 w-16 cursor-grab place-items-center rounded-full shadow-2xl ring-2 ring-white/60 transition-transform hover:scale-105 active:cursor-grabbing"
      >
        <PaimonIcon className="h-16 w-16 rounded-full" />
      </button>
    </div>
  );
}