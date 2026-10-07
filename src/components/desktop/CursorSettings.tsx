"use client";

import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  CURSOR_PRESETS,
  CURSOR_SHAPES,
  buildCursorSvgUrl,
  buildCursorUrl,
} from "@/lib/cursor";
import { SettingsBlock, SettingsRow, SwitchRow } from "./SettingsUI";

/** 取色器外观：去掉原生边框与内边距，做成小色块 */
const COLOR_INPUT =
  "h-7 w-9 appearance-none rounded-md border border-black/15 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0";

/** 设置页里的「鼠标指针」分组：开关 / 形状 / 渐变配色 / 大小 / 预览 */
export default function CursorSettings() {
  const cursor = useSettingsStore((s) => s.cursor);
  const setCursor = useSettingsStore((s) => s.setCursor);

  // 预览用固定尺寸绘制，避免大小滑块让预览图跟着缩到看不清
  const preview = useMemo(() => {
    if (!cursor.on) return null;
    const c = { ...cursor, size: 26 };
    return buildCursorSvgUrl(c) ?? buildCursorUrl(c);
  }, [cursor]);

  const activePreset = CURSOR_PRESETS.find(
    (p) =>
      p.from.toLowerCase() === cursor.from.toLowerCase() &&
      p.to.toLowerCase() === cursor.to.toLowerCase(),
  );

  return (
    <div className="divide-y divide-black/[.06]">
      <SwitchRow
        label="自定义指针"
        hint="用自定义图形替换系统箭头"
        checked={cursor.on}
        onChange={(v) => setCursor({ on: v })}
      />

      {cursor.on && (
        <>
          <SettingsRow label="形状" hint="星形取自站点 Logo">
            <div className="flex gap-1">
              {CURSOR_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={cursor.shape === s.id}
                  onClick={() => setCursor({ shape: s.id })}
                  className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                    cursor.shape === s.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-black/[.06] hover:bg-black/[.12]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsBlock label="配色" hint="选择预设渐变，或用取色器自定义起止色">
            <div className="flex flex-wrap items-center gap-2">
              {CURSOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={activePreset?.id === p.id}
                  onClick={() => setCursor({ from: p.from, to: p.to })}
                  className={`h-8 w-14 rounded-lg transition ${
                    activePreset?.id === p.id
                      ? "ring-2 ring-[var(--accent)]"
                      : "ring-1 ring-black/10 hover:ring-black/30"
                  }`}
                  style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                />
              ))}
              <label className="ml-1 flex items-center gap-2 text-[12px]">
                <input
                  type="color"
                  value={cursor.from}
                  onChange={(e) => setCursor({ from: e.target.value })}
                  aria-label="渐变起点色"
                  className={COLOR_INPUT}
                />
                <span className="text-[var(--ink-sub)]">起点</span>
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="color"
                  value={cursor.to}
                  onChange={(e) => setCursor({ to: e.target.value })}
                  aria-label="渐变终点色"
                  className={COLOR_INPUT}
                />
                <span className="text-[var(--ink-sub)]">终点</span>
              </label>
            </div>
          </SettingsBlock>

          <SettingsRow label="大小" hint="指针图形直径">
            <input
              type="range"
              min={12}
              max={30}
              step={1}
              value={cursor.size}
              onChange={(e) => setCursor({ size: Number(e.target.value) })}
              aria-label="指针大小"
              className="h-1 w-40 accent-[var(--accent)]"
            />
            <span className="w-10 text-right text-[12px] tabular-nums text-[var(--ink-sub)]">
              {cursor.size}px
            </span>
          </SettingsRow>

          <SettingsBlock label="预览" hint="左浅右深对照，确认指针在两种背景上都看得清">
            <div className="relative grid h-16 w-28 place-items-center overflow-hidden rounded-lg ring-1 ring-black/10">
              <span
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, #eef2f8 0 50%, #22304c 50% 100%)" }}
              />
              {preview && (
                <span
                  aria-hidden
                  className="relative"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundImage: `url("${preview}")`,
                    backgroundSize: "32px 32px",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              )}
            </div>
          </SettingsBlock>
        </>
      )}
    </div>
  );
}