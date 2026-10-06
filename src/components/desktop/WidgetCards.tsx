"use client";

import Image from "next/image";
import {
  GAMES,
  THEMES,
  type GameId,
  type GameMeta,
  type ThemeId,
} from "@/lib/games";
import { Squircle, IconBadge, PlayIcon } from "./icons";

/** 小组件渲染所需的上下文（右侧栏与桌面浮层共用） */
export interface WidgetCtx {
  theme: ThemeId;
  onTheme: (t: ThemeId, e: { clientX: number; clientY: number }) => void;
  onOpenGame: (id: GameId) => void;
}

/** 全部小组件 id（顺序即右侧栏默认顺序） */
export const WIDGET_IDS: string[] = [
  "theme",
  "now-playing",
  ...GAMES.map((g) => `game-${g.id}`),
  "weekly",
  "achievements",
  "today",
];

const WEEK_BARS = [18, 34, 10, 42, 26, 52, 30];
const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card rounded-2xl p-4 ${className}`}>{children}</div>
  );
}

export function CardTitle({ zh, en }: { zh: string; en: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold">{zh}</div>
      <div className="mt-0.5 text-[9px] tracking-[0.22em] text-[var(--ink-sub)]">
        {en}
      </div>
    </div>
  );
}

function ThemeCard({ ctx }: { ctx: WidgetCtx }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle zh="选择主题" en="CHOOSE A THEME" />
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              title={t.label}
              aria-label={`切换到${t.label}主题`}
              onClick={(e) =>
                ctx.onTheme(t.id, { clientX: e.clientX, clientY: e.clientY })
              }
              className={`h-6.5 w-6.5 rounded-full shadow-inner transition-transform hover:scale-110 ${
                ctx.theme === t.id
                  ? "scale-110 ring-2 ring-[var(--ink)]/60"
                  : "ring-1 ring-black/10"
              }`}
              style={{ background: t.color }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Now Playing 大卡。数据未接入时显示占位态。
 * 预留接口：game（当前游戏元数据）、since（开始时间，如 "14:32"）。
 */
function NowPlaying({ game, since }: { game?: GameMeta | null; since?: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle zh="正在游戏" en="NOW PLAYING" />
        <span className="text-[11px] text-[var(--ink-sub)]">
          {game && since ? `自 ${since} 起` : "—"}
        </span>
      </div>

      <div className="mt-3.5 grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-[var(--ink-sub)]/[.12] ring-1 ring-black/5">
        {game ? (
          <Image
            src={game.icon}
            alt={game.name}
            width={160}
            height={90}
            className="h-full w-full object-cover"
          />
        ) : (
          <PlayIcon className="h-8 w-8 text-[var(--ink-sub)]/45" />
        )}
      </div>

      <div className="mt-3">
        <div className="text-[13px] font-semibold">
          {game ? game.name : "暂无游戏在运行"}
        </div>
        <div className="mt-1 text-[11px] text-[var(--ink-sub)]">
          {game ? `${game.developer} · ${game.type}` : "接入 Steam 后实时显示"}
        </div>
      </div>
    </Card>
  );
}

function GameMini({ game, onOpen }: { game: GameMeta; onOpen: (id: GameId) => void }) {
  return (
    <button
      type="button"
      aria-label={`打开 ${game.name}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(game.id);
      }}
      className="group block w-full rounded-2xl text-left transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <div className="glass-card rounded-2xl p-3.5 transition-colors duration-150 group-hover:border-[var(--accent)]">
        <div className="flex items-center gap-2">
          <span className="relative block shrink-0 [filter:drop-shadow(0_2px_4px_rgba(0,0,0,0.2))]">
            <Squircle size={30}>
              <Image
                src={game.icon}
                alt=""
                width={30}
                height={30}
                className="block h-full w-full object-cover"
              />
            </Squircle>
            <IconBadge badge={game.badge} />
          </span>
          <div className="min-w-0 text-[12px] font-semibold">{game.name}</div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: game.accent, opacity: 0.35 }}
          />
          <span className="text-[11px] text-[var(--ink-sub)]">待接入</span>
        </div>
        <div className="mt-1.5 text-[10px] leading-snug text-[var(--ink-sub)]">
          {game.developer} · {game.type}
        </div>
      </div>
    </button>
  );
}

function WeeklyCard() {
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7; // 0 = 周一
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle zh="本周游戏时长" en="WEEKLY PLAYTIME" />
        <span className="text-[11px] text-[var(--ink-sub)]">— 小时</span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {WEEK_BARS.map((h, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col justify-end">
            <div className="relative w-full">
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 text-[10px] whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                周{WEEK_LABELS[i]} · —小时
              </div>
              <div
                className={`w-full rounded-t-md ${
                  i === todayIndex
                    ? "bar-breathe bg-[var(--accent)]"
                    : "bg-[var(--ink-sub)]/25"
                }`}
                style={{ height: `${h}px` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {WEEK_LABELS.map((w, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-[var(--ink-sub)]">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-black/[.07] pt-2.5">
        <span className="text-[11px] text-[var(--ink-sub)]">
          数据接入后展示真实时长
        </span>
        <a
          className="text-[11px] text-[var(--ink-sub)] underline decoration-dotted underline-offset-3 transition-colors hover:text-[var(--ink)]"
          href="https://www.hoyolab.com"
          target="_blank"
          rel="noreferrer"
        >
          HoYoLAB ↗
        </a>
      </div>
    </Card>
  );
}

function AchievementsCard() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle zh="最新成就" en="RECENT ACHIEVEMENTS" />
        <span className="text-[11px] text-[var(--ink-sub)]">— 条</span>
      </div>
      {/*
        数据接口（接入后替换 5 个占位卡）：
        type Achievement = { name: string; icon: string; rarity: number; unlockedAt: string };
        props: { items?: Achievement[] }
      */}
      <div className="no-scrollbar -mx-1 mt-3.5 flex gap-3 overflow-x-auto px-1 pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[104px] shrink-0 rounded-xl bg-[var(--ink-sub)]/[.07] p-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-black/[.06] text-[18px]">
              🏆
            </div>
            <div className="mt-2.5 h-2 w-full rounded-full bg-[var(--ink-sub)]/20" />
            <div className="mt-1.5 h-2 w-2/3 rounded-full bg-[var(--ink-sub)]/15" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TodayCard() {
  const today = new Date();
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="text-[40px] leading-none font-bold tabular-nums">
          {today.getDate()}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">
            {today.getMonth() + 1}月 ·{" "}
            {today.toLocaleDateString("zh-CN", { weekday: "long" })}
          </div>
          <div className="mt-1 text-[12px] text-[var(--ink-sub)]">
            欢迎回来，旅行者 ✦
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--ink-sub)]">
            {GAMES.length} 款游戏待命中
          </div>
        </div>
      </div>
    </Card>
  );
}

/** 按 id 渲染对应小组件内容 */
export function WidgetCard({ id, ctx }: { id: string; ctx: WidgetCtx }) {
  if (id === "theme") return <ThemeCard ctx={ctx} />;
  if (id === "now-playing") return <NowPlaying />;
  if (id === "weekly") return <WeeklyCard />;
  if (id === "achievements") return <AchievementsCard />;
  if (id === "today") return <TodayCard />;
  if (id.startsWith("game-")) {
    const game = GAMES.find((g) => `game-${g.id}` === id);
    return game ? <GameMini game={game} onOpen={ctx.onOpenGame} /> : null;
  }
  return null;
}