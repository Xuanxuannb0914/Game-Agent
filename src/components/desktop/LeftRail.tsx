"use client";

import Image from "next/image";
import { GAMES } from "@/lib/games";
import { Squircle } from "./icons";

export default function LeftRail() {
  return (
    <aside className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-start gap-3 md:flex">
      {/* 白色字母块（对应原站 W.） */}
      <div className="float-shadow ml-1 grid h-10 w-10 place-items-center rounded-xl bg-white/95 text-[12px] font-black text-slate-700">
        GA
      </div>
      {/* 蓝色竖排标签（对应原站 Honors） */}
      <div className="float-shadow rounded-r-xl bg-[#5b7fa6]/90 py-4 pl-2 pr-1.5">
        <span
          className="text-[10px] font-medium tracking-[0.3em] text-white"
          style={{ writingMode: "vertical-rl" }}
        >
          我的游戏
        </span>
      </div>
      {/* 游戏徽章（对应原站贴纸，squircle 裁剪） */}
      <div className="ml-1 flex flex-col items-center gap-3">
        {GAMES.map((g) => (
          <span
            key={g.id}
            className="block [filter:drop-shadow(0_2px_5px_rgba(15,23,42,0.25))]"
          >
            <Squircle size={40}>
              <Image
                src={g.icon}
                alt={g.name}
                width={40}
                height={40}
                className="block h-full w-full object-cover"
              />
            </Squircle>
          </span>
        ))}
      </div>
    </aside>
  );
}
