"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { mountPaimon, type PaimonController } from "@/lib/live2d/paimonModel";

const MESSAGES = [
  "旅行者，今天也要元气满满哦！",
  "需要我帮你打开哪款游戏吗？双击桌面图标就好啦～",
  "听说年度报告已经生成，要不要去看看？",
  "累了就休息一下，派蒙帮你看着桌面！",
  "别忘了看看本周的成就进度哦～",
];

const POS_KEY = "ga:paimon-pos";
/** 角色显示高度（两种模式一致，避免切换时跳位） */
const PET_H = 150;
/** 容器尺寸：比角色略大，给 Live2D 转头留出余量 */
const BOX_W = 120;
const BOX_H = 180;

/** 设 NEXT_PUBLIC_PAIMON_LIVE2D=0 可强制走静态回退（调试用） */
const LIVE2D_ENABLED = process.env.NEXT_PUBLIC_PAIMON_LIVE2D !== "0";

function clamp(p: { x: number; y: number }) {
  return {
    x: Math.max(8, Math.min(window.innerWidth - BOX_W - 8, p.x)),
    y: Math.max(48, Math.min(window.innerHeight - BOX_H - 8, p.y)),
  };
}

/**
 * 右下角派蒙助手。
 * 优先加载 Live2D 模型（呼吸 / 眨眼 / 注视鼠标 / 口型联动），
 * 模型缺失或加载失败时回退静态立绘 + CSS 呼吸动画，功能不中断。
 * 两种模式都保留：拖拽移动、位置 localStorage 记忆、点击开合气泡、打字机输出。
 */
export default function PaimonAssistant() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  /** live2d = 模型已就绪；static = 回退静态图 */
  const [mode, setMode] = useState<"live2d" | "static">("static");

  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const controllerRef = useRef<PaimonController | null>(null);
  /** lx/ly 记录拖拽过程中最新落点，pointerup 时直接读取，避免在 render 中写 ref */
  const drag = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
    lx: number;
    ly: number;
  } | null>(null);
  const movedRef = useRef(false);

  // 初始位置：右下角；localStorage 记忆
  useEffect(() => {
    let p: { x: number; y: number } | null = null;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) p = JSON.parse(raw);
    } catch {
      /* 忽略损坏的本地数据 */
    }
    // 初始位置只能在挂载后从 localStorage / window 读取（SSR 无 window），
    // 故必须在此 effect 中同步落一次 state；先渲染 null 以避免 hydration 不一致。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(clamp(p ?? { x: window.innerWidth - BOX_W - 16, y: window.innerHeight - BOX_H - 56 }));
    const onResize = () => setPos((cur) => (cur ? clamp(cur) : cur));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 挂载 Live2D；失败则保持静态回退。
  // 依赖 host（回调 ref）而非空数组：pos 未就绪时组件先返回 null、DOM 尚未挂载，
  // 空依赖的 effect 只会跑一次并因 host 为空而提前退出，导致模型永远不加载。
  useEffect(() => {
    if (!LIVE2D_ENABLED || !host) return;

    let cancelled = false;
    let created: PaimonController | null = null;

    void (async () => {
      try {
        const ctrl = await mountPaimon({
          host,
          width: BOX_W,
          height: BOX_H,
          characterHeight: PET_H,
        });
        if (cancelled) {
          ctrl.destroy();
          return;
        }
        created = ctrl;
        controllerRef.current = ctrl;
        setMode("live2d");
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[paimon] Live2D 不可用，已回退静态立绘：", err);
        }
        setMode("static");
      }
    })();

    return () => {
      cancelled = true;
      controllerRef.current = null;
      created?.destroy();
    };
  }, [host]);

  // 注视鼠标：把屏幕坐标归一化到 -1..1 交给控制器
  useEffect(() => {
    if (mode !== "live2d") return;
    const onMove = (e: MouseEvent) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      ctrl.setGaze(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mode]);

  // 打字机；每输出一个字符驱动一次口型
  useEffect(() => {
    if (!open) return;
    const full = MESSAGES[index % MESSAGES.length];
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      controllerRef.current?.pulseMouth();
      if (i >= full.length) window.clearInterval(t);
    }, 45);
    return () => window.clearInterval(t);
  }, [open, index]);

  const onDown = (e: React.PointerEvent) => {
    if (!pos) return;
    movedRef.current = false;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false, lx: pos.x, ly: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
      d.moved = true;
      movedRef.current = true;
      controllerRef.current?.setDragging(true);
    }
    if (d.moved) {
      const np = clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
      d.lx = np.x;
      d.ly = np.y;
      setPos(np);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) controllerRef.current?.setDragging(false);
    if (!d.moved) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x: d.lx, y: d.ly }));
    } catch {
      /* 存储不可用时仅保留内存态 */
    }
  };

  // 点击开合气泡（拖动结束后不触发）；已开时点击切换到下一条
  const onClick = () => {
    if (movedRef.current) return;
    controllerRef.current?.playTap();
    if (open) setIndex((i) => i + 1);
    setTyped("");
    setOpen(!open);
  };

  if (!pos) return null;

  const bubbleLeft = pos.x < 250;

  return (
    <div
      className="fixed z-[44]"
      style={{ left: pos.x, top: pos.y, width: BOX_W, height: BOX_H }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="派蒙对话"
          className={`os-drop ctx-pop absolute bottom-full mb-2 w-60 rounded-2xl p-3 text-[12px] leading-relaxed text-[var(--ink)] ${
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
              onClick={() => {
                setIndex((i) => i + 1);
                setTyped("");
              }}
              className="text-[10px] text-[var(--ink-sub)] transition-colors hover:text-[var(--ink)]"
            >
              下一条 →
            </button>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="派蒙助手"
        title="派蒙助手（可拖动）"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="absolute inset-0 origin-bottom cursor-grab touch-none transition-transform duration-200 ease-out hover:scale-[1.04] active:cursor-grabbing"
      >
        {/* Live2D 画布挂载点（始终存在，模型就绪后由控制器插入 canvas） */}
        <div ref={setHost} className="absolute inset-0" />

        {mode === "static" && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
            <Image
              src="/paimon-pet.png"
              alt="派蒙"
              width={Math.round((PET_H * 407) / 820)}
              height={PET_H}
              draggable={false}
              priority
              className="paimon-breathe block h-[150px] w-auto select-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}