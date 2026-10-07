"use client";

import Image from "next/image";
import { GAMES, type GameId } from "@/lib/games";
import { useIsCoarsePointer } from "@/lib/motion";
import { Squircle, IconBadge } from "./icons";

interface DesktopIconsProps {
  onLaunch: (id: GameId) => void;
}

export default function DesktopIcons({ onLaunch }: DesktopIconsProps) {
  // 触屏（粗指针）没有双击，单击即启动
  const coarse = useIsCoarsePointer();
  return (
    <section className="mt-12">
      <div className="flex w-fit flex-wrap gap-2">
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            data-ctx="game-icon"
            data-game={g.id}
            className="enter-pop group flex w-[88px] flex-col items-center gap-2 rounded-2xl px-2 py-3 outline-none transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 md:w-[128px]"
            style={{ "--enter-delay": `${180 + i * 50}ms` } as React.CSSProperties}
            onClick={(e) => {
              // 鼠标单击不产生任何动作；触屏单击即启动
              if (!coarse) return;
              e.stopPropagation();
              onLaunch(g.id);
            }}
            onDoubleClick={(e) => {
              if (coarse) return;
              e.stopPropagation();
              onLaunch(g.id);
            }}
            aria-label={`${g.name}，${coarse ? "单击启动" : "双击启动"}`}
          >
            {/* 外层 div 承载浮起动效（跟随 squircle 轮廓），角标在裁剪层之外不被裁掉 */}
            <div className="relative transition-[translate,scale] duration-[180ms] ease-out group-hover:-translate-y-[3px] group-active:scale-[0.94]">
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
            <span className="-mt-1 text-[9px] tracking-wide text-white/65 drop-shadow opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {g.en}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}