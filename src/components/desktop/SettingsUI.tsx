"use client";

/** 开关行：整行可点（与旧版下拉菜单一致的大点击区），语义为 role=switch */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-black/[.03]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--ink-sub)]">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--accent)]" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/** 普通设置行：左侧标题 + 说明，右侧放控件 */
export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-sub)]">{hint}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

/** 整块区域：标题在上，内容占满整行（配色、预览等） */
export function SettingsBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="text-[13px] font-medium">{label}</div>
      {hint && (
        <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-sub)]">{hint}</div>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}