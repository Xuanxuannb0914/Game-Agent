"use client";

export default function ProfileBlock() {
  return (
    <section className="flex items-center gap-6">
      <div
        className="grid h-28 w-28 shrink-0 place-items-center rounded-full shadow-lg ring-2 ring-white/60"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #9db8e8 0%, #5f7fc0 55%, #3c5691 100%)",
        }}
      >
        <span className="text-4xl font-black text-white drop-shadow">游</span>
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-bold tracking-[0.28em] text-[var(--ink)]">
          二次元游戏桌面
        </div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink)]">
          把原神、星穹铁道、绝区零、鸣潮装进同一张桌面，
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--ink)]">
          体力、签到、版本进度，一站直达。
        </p>
        <button
          className="mt-2 cursor-pointer text-[12px] font-medium tracking-[0.12em] text-[var(--ink)] underline decoration-[var(--ink-sub)]/60 underline-offset-4 transition-opacity hover:opacity-70"
          title="数据接入开发中"
        >
          接入更多游戏 →
        </button>
      </div>
    </section>
  );
}
