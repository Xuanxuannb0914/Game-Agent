"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GAMES } from "@/lib/games";

/** 年度数据（占位，后续接真实统计） */
const TOTAL_HOURS = 1286;
const FAV = GAMES.find((g) => g.id === "genshin")!;
const FAV_HOURS = 486;
const ACHIEVEMENTS = 342;
const STREAK = 96;
const KEYWORD = "星海漫游者";
const YEAR = new Date().getFullYear();

/** 数字滚动：进入该屏时从 0 缓出到目标值 */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

const SLIDE_COUNT = 5;

export default function ReportPage() {
  const [active, setActive] = useState(0);
  const [poster, setPoster] = useState<"idle" | "loading" | "done">("idle");
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);

  // 滚动到哪一屏 → 更新 active（驱动数字动画与右侧指示点）
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActive(Number((e.target as HTMLElement).dataset.idx));
          }
        });
      },
      { root, threshold: 0.6 },
    );
    slides.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  const goTo = (i: number) => {
    slides.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hours = useCountUp(TOTAL_HOURS, active === 0);
  const favHours = useCountUp(FAV_HOURS, active === 1);
  const achs = useCountUp(ACHIEVEMENTS, active === 2);
  const streak = useCountUp(STREAK, active === 3);

  const share = () => {
    if (poster !== "idle") return;
    setPoster("loading");
    window.setTimeout(() => setPoster("done"), 1200);
  };

  return (
    <div className="fixed inset-0 bg-[#070912] text-white">
      {/* 星空底纹 + 光晕（纯 CSS，无外部素材） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 78% 12%, rgba(90,120,220,0.28), transparent 60%), radial-gradient(900px 500px at 12% 88%, rgba(180,120,220,0.22), transparent 62%), radial-gradient(700px 400px at 50% 50%, rgba(60,200,190,0.10), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 68% 22%, #fff, transparent), radial-gradient(1.5px 1.5px at 42% 68%, #fff, transparent), radial-gradient(1px 1px at 84% 74%, #fff, transparent), radial-gradient(1px 1px at 12% 58%, #fff, transparent), radial-gradient(1.5px 1.5px at 56% 88%, #fff, transparent)",
          backgroundSize: "100% 100%",
        }}
      />

      {/* 顶部栏 */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8">
        <Link
          href="/"
          className="rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20"
        >
          ← 返回桌面
        </Link>
        <div className="text-right">
          <div className="text-[11px] tracking-[0.28em] text-white/50">ANNUAL REPORT</div>
          <div className="text-[13px] font-semibold text-white/90">{YEAR} 年度报告</div>
        </div>
      </header>

      {/* 右侧指示点 */}
      <nav className="absolute top-1/2 right-4 z-20 flex -translate-y-1/2 flex-col items-center gap-3 md:right-7">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`第 ${i + 1} 屏`}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              active === i ? "h-6 w-1.5 bg-white" : "h-1.5 w-1.5 bg-white/35 hover:bg-white/70"
            }`}
          />
        ))}
      </nav>

      {/* 5 屏滑动叙事 */}
      <div
        ref={scroller}
        className="no-scrollbar relative z-10 h-full snap-y snap-mandatory overflow-y-scroll"
      >
        {/* 1 · 总时长 */}
        <section
          data-idx={0}
          ref={(el) => {
            slides.current[0] = el;
          }}
          className="flex h-dvh snap-start snap-always flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-[13px] tracking-[0.3em] text-white/55">这一年，你沉浸在</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-[22vw] leading-none font-black tabular-nums md:text-[180px]">
              {hours.toLocaleString()}
            </span>
            <span className="mb-4 text-[22px] font-semibold text-white/70 md:mb-8">小时</span>
          </div>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
            相当于连续游玩 {Math.round(TOTAL_HOURS / 24)} 天，
            在四个世界里留下了自己的足迹。
          </p>
        </section>

        {/* 2 · 最爱的游戏 */}
        <section
          data-idx={1}
          ref={(el) => {
            slides.current[1] = el;
          }}
          className="flex h-dvh snap-start snap-always flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-[13px] tracking-[0.3em] text-white/55">最常回到的世界是</p>
          <div className="mt-6 grid h-28 w-28 place-items-center overflow-hidden rounded-[28px] shadow-2xl ring-2 ring-white/20 md:h-32 md:w-32">
            <Image
              src={FAV.icon}
              alt={FAV.name}
              width={128}
              height={128}
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="mt-6 text-[38px] font-black md:text-[52px]">{FAV.name}</h2>
          <p className="mt-2 text-[15px] text-white/65">
            {FAV.en} · {FAV.developer}
          </p>
          <div className="mt-6 rounded-2xl bg-white/8 px-6 py-3 ring-1 ring-white/12">
            <span className="text-[26px] font-bold tabular-nums">{favHours}</span>
            <span className="ml-1.5 text-[13px] text-white/60">小时在这里度过</span>
          </div>
        </section>

        {/* 3 · 成就数 */}
        <section
          data-idx={2}
          ref={(el) => {
            slides.current[2] = el;
          }}
          className="flex h-dvh snap-start snap-always flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-[13px] tracking-[0.3em] text-white/55">解锁成就</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-[26vw] leading-none font-black tabular-nums md:text-[200px]">
              {achs}
            </span>
            <span className="mb-4 text-[22px] font-semibold text-white/70 md:mb-10">枚</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[40px]">
            <span>🏆</span>
            <span>🏅</span>
            <span>🎖️</span>
          </div>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
            其中 12 枚是稀有成就，每一枚都藏着一段熬夜的故事。
          </p>
        </section>

        {/* 4 · 连续天数 */}
        <section
          data-idx={3}
          ref={(el) => {
            slides.current[3] = el;
          }}
          className="flex h-dvh snap-start snap-always flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-[13px] tracking-[0.3em] text-white/55">最长连续登录</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-[26vw] leading-none font-black tabular-nums md:text-[200px]">
              {streak}
            </span>
            <span className="mb-4 text-[22px] font-semibold text-white/70 md:mb-10">天</span>
          </div>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
            风雨无阻，日均在线 {Math.round(TOTAL_HOURS / 365)} 小时。
          </p>
        </section>

        {/* 5 · 年度关键词 + 分享海报 */}
        <section
          data-idx={4}
          ref={(el) => {
            slides.current[4] = el;
          }}
          className="flex h-dvh snap-start snap-always flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-[13px] tracking-[0.3em] text-white/55">你的年度关键词</p>
          <h2
            className="mt-6 bg-gradient-to-r from-[#f3c9a0] via-[#8fb0f5] to-[#c9a0f3] bg-clip-text text-[13vw] font-black text-transparent md:text-[96px]"
            style={{ letterSpacing: "0.04em" }}
          >
            {KEYWORD}
          </h2>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/60">
            去过了很多地方，见过了很多风景。愿下一年，依旧热爱。
          </p>

          <button
            type="button"
            onClick={share}
            className="mt-10 rounded-full bg-white px-8 py-3 text-[14px] font-semibold text-[#0b1020] shadow-2xl transition-transform hover:scale-105 active:scale-95"
          >
            {poster === "idle" && "分享海报"}
            {poster === "loading" && "海报生成中…"}
            {poster === "done" && "海报功能开发中 ✦"}
          </button>

          <Link href="/" className="mt-6 text-[12px] text-white/50 underline underline-offset-4 hover:text-white/80">
            回到桌面
          </Link>
        </section>
      </div>

      {/* 底部进度条 */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/10">
        <div
          className="h-full bg-white/70 transition-[width] duration-300"
          style={{ width: `${((active + 1) / SLIDE_COUNT) * 100}%` }}
        />
      </div>
    </div>
  );
}