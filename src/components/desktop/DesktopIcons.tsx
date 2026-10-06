"use client";

import Image from "next/image";
import { GAMES, type GameId } from "@/lib/games";
import { useIsCoarsePointer } from "@/lib/motion";
import { Squircle, IconBadge } from "./icons";

interface DesktopIconsProps {
  selected: GameId | null;
  onSelect: (id: GameId | null) => void;
  onOpen: (id: GameId) => void;
}

export default function DesktopIcons({
  selected,
  onSelect,
  onOpen,
}: DesktopIconsProps) {
  // 触屏（粗指针）：单击即打开，跳过双击
  const coarse = useIsCoarsePointer();
  return (
    <section className="mt-12">
      <div className="flex w-fit flex-wrap gap-2">
        {GAMES.map((g, i) => {
          const isSelected = selected === g.id;
          return (
            <button
              key={g.id}
              data-ctx="game-icon"
              data-game={g.id}
              className={`enter-pop group flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-colors duration-150 md:w-[128px] ${
                isSelected
                  ? "bg-[var(--sel)] ring-1 ring-white/40"
                  : "hover:bg-white/10"
              }`}
              style={{ "--enter-delay": `${180 + i * 50}ms` } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                // 触屏：单击直接打开；鼠标：单击选中
                if (coarse) onOpen(g.id);
                else onSelect(g.id);
              }}
              onDoubleClick={(e) => {
                if (coarse) return;
                e.stopPropagation();
                onOpen(g.id);
              }}
              aria-label={`${g.name}，${coarse ? "单击打开" : "双击打开"}`}
            >
              {/* 外层 div 承载 drop-shadow 与浮起动效（跟随 squircle 轮廓），角标在裁剪层之外不被裁掉 */}
              <div className="relative transition-[filter,translate,scale] duration-[180ms] ease-out group-hover:-translate-y-[3px] group-active:scale-[0.94] [filter:drop-shadow(0_12px_28px_rgba(0,0,0,0.30))_drop-shadow(0_3px_8px_rgba(0,0,0,0.18))] group-hover:[filter:drop-shadow(0_22px_40px_rgba(0,0,0,0.32))_drop-shadow(0_6px_12px_rgba(0,0,0,0.20))]">
                <Squircle size={80}>
                  <Image
                    src={g.icon}
                    alt={g.name}
                    width={80}
                    height={80}
                    draggable={false}
                    className="block h-full w-full object-cover"
                  />
                </Squircle>
                <IconBadge badge={g.badge} />
              </div>
              <span className="hidden text-[12px] leading-tight font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] md:block">
                {g.name}
              </span>
              <span className="-mt-1 hidden text-[9px] tracking-wide text-white/65 drop-shadow md:block">
                {g.en}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
