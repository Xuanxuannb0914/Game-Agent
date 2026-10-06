export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z" />
    </svg>
  );
}

/**
 * iOS 风格连续圆角（squircle）：objectBoundingBox 归一化路径，
 * 同一份 clipPath 可缩放适配任意方形尺寸（配合 .squircle 的 @supports 兜底）。
 */
export const SQUIRCLE_CLIP_ID = "ga-squircle-clip";
const SQUIRCLE_PATH =
  "M0.5,0 C0.885,0 1,0.115 1,0.5 C1,0.885 0.885,1 0.5,1 C0.115,1 0,0.885 0,0.5 C0,0.115 0.115,0 0.5,0 Z";

/** 全局只需渲染一次的 squircle 裁剪路径定义（挂 Desktop 根部） */
export function SquircleDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <clipPath id={SQUIRCLE_CLIP_ID} clipPathUnits="objectBoundingBox">
          <path d={SQUIRCLE_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** 把任意方形内容裁成 iOS squircle；不支持 clip-path 时由 CSS 回退 border-radius */
export function Squircle({
  size,
  className = "",
  children,
}: {
  size: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`squircle block overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/** 图标角标：红点 / 数字胶囊（白字红底 + 白描边），badge 为空时不渲染 */
export function IconBadge({
  badge,
}: {
  badge?: { type: "dot" | "count"; count?: number } | null;
}) {
  if (!badge) return null;
  if (badge.type === "dot") {
    return (
      <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-[#ef4444] ring-2 ring-white/80" />
    );
  }
  return (
    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] leading-none font-bold text-white ring-1 ring-white">
      {badge.count ?? 0}
    </span>
  );
}

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 4h8v5.5a4 4 0 0 1-8 0Z" />
      <path d="M8 5.5H5A3 3 0 0 0 8 9M16 5.5h3A3 3 0 0 1 16 9" />
      <path d="M12 13.5V16M8.5 19.5h7M10 16.5h4a1 1 0 0 1 1 1v2h-6v-2a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="8" width="19" height="10.5" rx="5" />
      <path d="M7.5 11v4.5M5.25 13.25h4.5" />
      <circle cx="15.5" cy="11.5" r="0.4" fill="currentColor" />
      <circle cx="18" cy="14" r="0.4" fill="currentColor" />
    </svg>
  );
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** 播放三角（Now Playing 占位封面用） */
export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/** 便签（折角文档） */
export function NotesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v9L14 20.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
      <path d="M20.5 14H15a1 1 0 0 0-1 1v5.5" />
      <path d="M7 8h10M7 11.5h6" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 7h16M9.5 7V5h5v2" />
      <path d="M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v11m0 0 4-4m-4 4-4-4" />
      <path d="M5 17.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-1.5" />
    </svg>
  );
}

/** 派蒙助手头像（内联 SVG，无需外部素材） */
export function PaimonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="ga-paimon-bg" cx="35%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#dceafb" />
          <stop offset="100%" stopColor="#a6c5ee" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="url(#ga-paimon-bg)" />
      {/* 白色头发 */}
      <path
        d="M32 9c-9.4 0-16.5 6.2-16.5 15.2 0 3.6 1 6.6 2.8 8.8l1.8-7.4 2.9 5.6 2-8.4 3 7.4 3.1-7.4 2.9 8.4 2-5.6 2 7.4c1.8-2.2 2.8-5.2 2.8-8.8C48.5 15.2 41.4 9 32 9Z"
        fill="#ffffff"
        opacity="0.96"
      />
      {/* 眼睛 */}
      <ellipse cx="25" cy="35.5" rx="2.3" ry="3.1" fill="#3b4a63" />
      <ellipse cx="39" cy="35.5" rx="2.3" ry="3.1" fill="#3b4a63" />
      {/* 腮红 */}
      <circle cx="20.5" cy="40.5" r="2.4" fill="#f7b3b3" opacity="0.72" />
      <circle cx="43.5" cy="40.5" r="2.4" fill="#f7b3b3" opacity="0.72" />
      {/* 嘴 */}
      <path
        d="M29 42.5c1.6 2 4.4 2 6 0"
        stroke="#c98b8b"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 星星发饰 */}
      <path d="M47.5 19.5l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3Z" fill="#ffd97a" />
    </svg>
  );
}

/** 眼睛（划掉）：小组件编辑模式的隐藏按钮 */
export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.6M6.6 6.6C4.4 8 3 10 2 12c1 2.5 5 7 10 7 1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
