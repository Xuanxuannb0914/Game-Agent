"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GAMES,
  GAME_THEME,
  THEMES,
  type GameId,
  type ThemeId,
} from "@/lib/games";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useWindowStore, topWindowId } from "@/stores/windowStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  useContextMenuStore,
  type MenuConfig,
} from "@/stores/contextMenuStore";
import MenuBar from "./MenuBar";
import LeftRail from "./LeftRail";
import ProfileBlock from "./ProfileBlock";
import DesktopIcons from "./DesktopIcons";
import WidgetPanel from "./WidgetPanel";
import FloatingWidgets from "./FloatingWidgets";
import PaimonAssistant from "./PaimonAssistant";
import Wallpaper from "./Wallpaper";
import Dock from "./Dock";
import WindowLayer from "./GameWindow";
import LockScreen from "./LockScreen";
import ContextMenu from "./ContextMenu";
import { SquircleDefs } from "./icons";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

function ThemeRipple({ x, y, size }: Ripple) {
  const [on, setOn] = useState(false);
  // 下一帧再翻转，确保 transition 从 scale(0) 出发
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="ripple z-[70]"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${on ? 1 : 0})`,
        opacity: on ? 0 : 0.4,
      }}
    />
  );
}

export default function Desktop() {
  const [theme, setTheme] = useState<ThemeId>("sky");
  const [selected, setSelected] = useState<GameId | null>(null);
  const [locked, setLocked] = useState(true);
  const [entered, setEntered] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [iconsKey, setIconsKey] = useState(0);
  // <lg 视口下的组件抽屉（≥lg 常驻，该状态被忽略）
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  const windows = useWindowStore((s) => s.windows);
  const followGame = useSettingsStore((s) => s.followGame);
  const setFollowGame = useSettingsStore((s) => s.setFollowGame);

  // 「主题跟随游戏」：最顶层窗口为游戏时用该游戏的主题，否则回退到手动主题
  const topWin = windows.find((w) => w.id === topWindowId(windows));
  const topGameId = topWin?.app === "game" ? topWin.gameId : undefined;
  const effectiveTheme: ThemeId =
    followGame && topGameId ? GAME_THEME[topGameId] : theme;

  // 读取本地设置（含音效开关）
  useEffect(() => {
    useSettingsStore.getState().hydrate();
  }, []);

  // 解锁后：置为已入场（触发一次性入场序列）；若从游戏胶囊进入，稍等动画播完再弹窗
  const handleUnlock = (g: GameId | null) => {
    setLocked(false);
    setEntered(true);
    if (g) window.setTimeout(() => useWindowStore.getState().open(g), 650);
  };

  // 主题切换 + 从点击位置扩散涟漪；手动选择即关闭「跟随游戏」
  const handleTheme = useCallback(
    (t: ThemeId, e?: { clientX: number; clientY: number }) => {
      setTheme(t);
      setFollowGame(false);
      if (!e || reduced) return;
      const { clientX: x, clientY: y } = e;
      const dist = Math.max(
        Math.hypot(x, y),
        Math.hypot(window.innerWidth - x, y),
        Math.hypot(x, window.innerHeight - y),
        Math.hypot(window.innerWidth - x, window.innerHeight - y),
      );
      const id = Date.now() + Math.random();
      setRipples((rs) => [...rs, { id, x, y, size: dist * 2 }]);
      window.setTimeout(
        () => setRipples((rs) => rs.filter((r) => r.id !== id)),
        700,
      );
    },
    [reduced, setFollowGame],
  );

  const openGame = useCallback((id: GameId) => {
    useWindowStore.getState().open(id);
  }, []);

  // 从组件面板开游戏：顺带收起 <lg 抽屉（≥lg 状态无效）
  const openGameFromPanel = useCallback((id: GameId) => {
    useWindowStore.getState().open(id);
    setDrawerOpen(false);
  }, []);

  // 整理图标：清除选中并重放图标入场动画（重排观感）
  const tidyIcons = useCallback(() => {
    setSelected(null);
    setIconsKey((k) => k + 1);
  }, []);

  // Dock 入口：未开则打开，最小化则从菜单位置飞回
  const openOrRestore = useCallback((id: GameId, from: { x: number; y: number }) => {
    const s = useWindowStore.getState();
    const w = s.windows.find((x) => x.gameId === id);
    if (w && w.minimized) {
      s.restoreWin(w.id, from);
      return;
    }
    s.open(id);
  }, []);

  // 右键菜单配置：按 target 分发
  const buildMenu = useCallback(
    (
      kind: string | undefined,
      gameId: GameId | undefined,
      at: { x: number; y: number },
    ): MenuConfig | null => {
      if (kind === "wallpaper") {
        return {
          items: [
            {
              label: "更换主题",
              children: THEMES.map((t) => ({
                label: t.label,
                color: t.color,
                onClick: () => handleTheme(t.id, { clientX: at.x, clientY: at.y }),
              })),
            },
            { label: "整理图标", onClick: tidyIcons },
            { label: "刷新数据", shortcut: "⌘R", disabled: true },
          ],
        };
      }
      if (kind === "game-icon" && gameId) {
        return {
          items: [
            { label: "打开", onClick: () => openGame(gameId) },
            { label: "固定到 Dock", disabled: true },
            { label: "移除", danger: true, disabled: true },
          ],
        };
      }
      if (kind === "dock-game" && gameId) {
        return {
          items: [
            { label: "打开", onClick: () => openOrRestore(gameId, at) },
            { label: "从 Dock 移除", danger: true, disabled: true },
          ],
        };
      }
      return null;
    },
    [handleTheme, tidyIcons, openGame, openOrRestore],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const el = (e.target as HTMLElement).closest("[data-ctx]") as HTMLElement | null;
      const config = buildMenu(
        el?.dataset.ctx,
        el?.dataset.game as GameId | undefined,
        { x: e.clientX, y: e.clientY },
      );
      const s = useContextMenuStore.getState();
      if (config) s.openMenu(e.clientX, e.clientY, config);
      else s.close();
    },
    [buildMenu],
  );

  // 快捷键：Esc 关最顶层窗口；⌘/Ctrl+W 关最顶层窗口；⌘/Ctrl+1..4 打开对应游戏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWindowStore.getState();
      const digit = e.key.match(/^[1-4]$/)?.[0];
      if ((e.metaKey || e.ctrlKey) && digit) {
        e.preventDefault();
        s.open(GAMES[Number(digit) - 1].id);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        if (s.windows.length) {
          e.preventDefault();
          const top = topWindowId(s.windows);
          if (top) s.close(top);
        }
        return;
      }
      if (e.key === "Escape") {
        // 优先级：抽屉（最顶层）> 右键菜单（由 ContextMenu 处理）> 最顶层窗口
        if (drawerOpen) {
          setDrawerOpen(false);
          return;
        }
        if (useContextMenuStore.getState().open) return;
        const top = topWindowId(s.windows);
        if (top) s.close(top);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div
      data-os={effectiveTheme}
      data-enter={entered ? "1" : "0"}
      className="relative h-dvh select-none overflow-hidden text-[var(--ink)]"
      onClick={() => setSelected(null)}
      onContextMenu={handleContextMenu}
      onAnimationEnd={(e) => {
        // 入场动画播完立即摘掉 enter-* 类：避免 fill-mode 永久挂层导致合成器停在中间帧
        const el = e.target as HTMLElement;
        if (!el.classList) return;
        [...el.classList]
          .filter((c) => c.startsWith("enter-"))
          .forEach((c) => el.classList.remove(c));
      }}
    >
      {/* squircle 裁剪路径（全局一份） */}
      <SquircleDefs />

      {/* 壁纸（多主题交叉淡入；「自动」档按真实时间插值） */}
      <div className="absolute inset-0" data-ctx="wallpaper">
        <Wallpaper theme={effectiveTheme} />
      </div>

      <MenuBar
        theme={effectiveTheme}
        onTheme={handleTheme}
        onOpenGame={openGame}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />
      <LeftRail />

      {/* 桌面主区域：内容簇按原站比例排布（左起约 29% 可用宽度、顶部约 14% 高度） */}
      <main className="desktop-main absolute inset-x-0 top-10 bottom-0 pr-6 lg:pr-[344px]" data-ctx="wallpaper">
        <div
          className="enter-up mt-[9vh] md:ml-[29%]"
          style={{ "--enter-delay": "100ms" } as React.CSSProperties}
        >
          <ProfileBlock />
          <DesktopIcons
            key={iconsKey}
            selected={selected}
            onSelect={setSelected}
            onOpen={openGame}
          />
        </div>
      </main>

      <WidgetPanel
        theme={effectiveTheme}
        onTheme={handleTheme}
        onOpenGame={openGameFromPanel}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <Dock />

      {/* 多窗口层 */}
      <WindowLayer />

      {/* 拖到桌面的浮动小组件（与右侧栏互斥） */}
      <FloatingWidgets
        ctx={{ theme: effectiveTheme, onTheme: handleTheme, onOpenGame: openGameFromPanel }}
      />

      {/* 右键菜单层 */}
      <ContextMenu />

      {/* 开机 / 锁屏覆盖层 */}
      {locked && <LockScreen theme={effectiveTheme} onUnlock={handleUnlock} />}

      {/* 派蒙助手（右下角，可拖拽） */}
      {!locked && <PaimonAssistant />}

      {/* 主题涟漪层 */}
      {ripples.map((r) => (
        <ThemeRipple key={r.id} {...r} />
      ))}

      <footer className="absolute bottom-5 left-5 z-10 text-[10px] tracking-[0.22em] text-[var(--ink)]/50">
        © 2026 Game-Agent · DEMO
      </footer>
    </div>
  );
}
