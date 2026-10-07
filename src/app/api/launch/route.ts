import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { GAMES } from "@/lib/games";

export const runtime = "nodejs";

/**
 * 启动本地游戏。客户端只传 gameId，实际启动路径取自服务端 GAMES 配置，
 * 因此无法通过请求体执行任意程序（避免命令注入）。
 */
export async function POST(request: Request) {
  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ ok: false, error: "请求格式错误" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const game = GAMES.find((g) => g.id === id);
  if (!game) {
    return Response.json({ ok: false, error: "未找到该游戏" }, { status: 404 });
  }

  const exePath = game.exePath?.trim();
  if (!exePath) {
    return Response.json(
      { ok: false, error: `尚未配置「${game.name}」的启动路径` },
      { status: 400 },
    );
  }
  if (!existsSync(exePath)) {
    return Response.json(
      { ok: false, error: `启动路径不存在：${exePath}` },
      { status: 400 },
    );
  }

  try {
    launchDetached(exePath);
  } catch {
    return Response.json({ ok: false, error: "启动进程失败" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/** 跨平台启动：Windows 用 start（兼容 exe / .lnk），macOS 的 .app 用 open，其余直接执行 */
function launchDetached(target: string) {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", target], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else if (process.platform === "darwin" && target.endsWith(".app")) {
    spawn("open", ["-a", target], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn(target, [], { detached: true, stdio: "ignore" }).unref();
  }
}