import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game-Agent — 二次元游戏桌面",
  description: "把原神、崩坏：星穹铁道、绝区零、鸣潮装进同一张桌面",
  icons: { icon: "/icons/genshin.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
