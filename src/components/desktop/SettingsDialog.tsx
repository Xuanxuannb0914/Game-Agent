"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useSettingsStore } from "@/stores/settingsStore";
import CursorSettings from "./CursorSettings";
import { SettingsRow, SwitchRow } from "./SettingsUI";
import { GearIcon, LockIcon, LogoMark } from "./icons";

type SectionId = "general" | "cursor" | "account";

const SECTIONS: {
  id: SectionId;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "general", label: "通用", Icon: GearIcon },
  { id: "cursor", label: "鼠标指针", Icon: LogoMark },
  { id: "account", label: "账号", Icon: LockIcon },
];

/**
 * 设置页：从顶栏「设置」打开，居中弹出（不再用小方框下拉）。
 * 左侧分类 + 右侧内容；仅用 transform / opacity 做入场，面板用实色 --win。
 */
export default function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SectionId>("general");
  const panelRef = useRef<HTMLDivElement>(null);

  const followGame = useSettingsStore((s) => s.followGame);
  const soundOn = useSettingsStore((s) => s.soundOn);
  const setFollowGame = useSettingsStore((s) => s.setFollowGame);
  const setSoundOn = useSettingsStore((s) => s.setSoundOn);

  // 打开时把焦点移入面板，Esc / 键盘滚动不必先点一下
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div
      className="fixed inset-0 z-[58] flex items-center justify-center p-4"
      onContextMenu={(e) => e.stopPropagation()}
    >
      {/* 遮罩：点击关闭 */}
      <div className="dialog-fade absolute inset-0 bg-black/35" onClick={onClose} aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabIndex={-1}
        className="dialog-pop os-window relative flex h-[min(580px,calc(100vh-96px))] w-[min(880px,calc(100vw-32px))] overflow-hidden rounded-2xl ring-1 ring-black/10 outline-none"
      >
        {/* 左侧分类 */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-black/[.07] bg-black/[.025] p-3">
          <div className="px-2 pt-1 pb-3 text-[15px] font-semibold">设置</div>
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                section === id
                  ? "bg-[var(--accent)] text-white"
                  : "hover:bg-black/[.06]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {label}
            </button>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-black/[.07] px-5">
            <span className="text-[13px] font-semibold">{current.label}</span>
            <button
              type="button"
              aria-label="关闭设置"
              title="关闭设置"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-sub)] transition-colors hover:bg-black/[.06] hover:text-[var(--ink)]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            {section === "general" && (
              <div className="divide-y divide-black/[.06]">
                <SwitchRow
                  label="主题跟随游戏"
                  hint="最顶层游戏决定壁纸主题"
                  checked={followGame}
                  onChange={setFollowGame}
                />
                <SwitchRow
                  label="音效"
                  hint="开机 / 解锁 / 成就提示音"
                  checked={soundOn}
                  onChange={setSoundOn}
                />
              </div>
            )}

            {section === "cursor" && <CursorSettings />}

            {section === "account" && (
              <div className="divide-y divide-black/[.06]">
                <SettingsRow label="年度报告" hint="查看这一年的游戏数据回顾">
                  <Link
                    href="/report"
                    onClick={onClose}
                    className="rounded-lg bg-black/[.06] px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/[.12]"
                  >
                    打开 ↗
                  </Link>
                </SettingsRow>
                <SettingsRow label="账号绑定" hint="绑定米哈游 / 库街区账号，同步体力与签到">
                  <span className="rounded-lg bg-black/[.05] px-3 py-1.5 text-[12px] text-[var(--ink-sub)]">
                    开发中
                  </span>
                </SettingsRow>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}