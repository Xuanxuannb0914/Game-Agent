import { create } from "zustand";

export interface MenuItem {
  label: string;
  /** 右侧快捷键提示，如 "⌘R" */
  shortcut?: string;
  disabled?: boolean;
  /** 危险操作：红色文字 */
  danger?: boolean;
  /** 主题色点等前置色块 */
  color?: string;
  onClick?: () => void;
  children?: MenuItem[];
}

export interface MenuConfig {
  items: MenuItem[];
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  config: MenuConfig | null;
  openMenu: (x: number, y: number, config: MenuConfig) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  config: null,
  openMenu: (x, y, config) => set({ open: true, x, y, config }),
  close: () => set({ open: false, config: null }),
}));