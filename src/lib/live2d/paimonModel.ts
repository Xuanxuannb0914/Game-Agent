/**
 * Live2D 派蒙控制器（三级回退的总入口）。
 *
 *  1. `mountCubism` —— 真 Live2D：加载 `paimon.model3.json`（需 Cubism Editor 导出）。
 *  2. `mountRig`    —— 参数化骨骼：Cubism 无无头编译器，moc3 未就位时用分层 PNG
 *                      组成参数驱动的骨骼，行为对齐同一套参数语义（见 paimonRig.ts）。
 *  3. 抛出          —— 交由 `PaimonAssistant` 回退到静态立绘 + CSS 呼吸动画。
 *
 * 仅在浏览器端调用：内部动态 import `pixi.js` 与 `pixi-live2d-display/cubism4`，
 * 避免 Next.js 在服务端求值 WebGL 相关模块。
 *
 * 参数写入时机很关键：注册在 internalModel 的 `beforeModelUpdate` 事件上。
 * 该事件在 motion / 物理 / 呼吸全部算完、核心模型 `update()` 之前触发，
 * 所以这里的写入既不会被库内建逻辑覆盖，也不会产生一帧延迟。
 *
 * 加算 vs 覆盖：
 *   · 注视、口型用 `addParameterValueById`——叠加在内建呼吸/动作之上，不打架；
 *   · 眨眼用 `setParameterValueById`——库内建眨眼同样用 set，我们写得更晚因而生效。
 */

import type { Live2DModel } from "pixi-live2d-display/cubism4";

const MODEL_URL = "/live2d/paimon/paimon.model3.json";

/** 库把核心模型标注为 object，这里声明我们实际用到的部分 */
type CoreModel = {
  setParameterValueById(id: string, value: number, weight?: number): void;
  addParameterValueById(id: string, value: number, weight?: number): void;
  getParameterIndex(id: string): number;
};

/**
 * InternalModel 实际继承自 EventEmitter，但打包出的 .d.ts 里 `utils.EventEmitter`
 * 命名空间未解析（dts-bundle-generator 的已知问题），导致 on/off 没被声明。
 * 这里补一个最小接口。
 */
type EventedInternalModel = {
  on(event: "beforeModelUpdate", fn: () => void): void;
  off(event: "beforeModelUpdate", fn: () => void): void;
};

/** 参数 ID，与 docs/live2d/02-cubism-modeling-spec.md 保持一致 */
const P = {
  eyeLOpen: "ParamEyeLOpen",
  eyeROpen: "ParamEyeROpen",
  eyeballX: "ParamEyeBallX",
  eyeballY: "ParamEyeBallY",
  angleX: "ParamAngleX",
  angleY: "ParamAngleY",
  bodyAngleX: "ParamBodyAngleX",
  mouthOpenY: "ParamMouthOpenY",
} as const;

/** 动作组名：Cubism4 的 idle 组固定叫 "Idle"，其余按 model3.json 中的键名 */
const GROUP = { idle: "Idle", tap: "Tap", wave: "Wave", drag: "Drag" } as const;

const EXPRESSIONS = ["smile", "happy", "surprised"] as const;

export type PaimonController = {
  /** 归一化指针坐标：屏幕左上为 (-1,-1)，右下为 (1,1) */
  setGaze(x: number, y: number): void;
  /** 拖拽中暂停自动注视，松开恢复 */
  setDragging(dragging: boolean): void;
  /** 打字机每输出一个字符调用一次，驱动口型 */
  pulseMouth(): void;
  /** 点击：触发 tap 动作 + 随机表情 */
  playTap(): void;
  /** 卸载：释放 WebGL 上下文、纹理、rAF 与事件监听 */
  destroy(): void;
};

export type MountOptions = {
  /** 画布挂载到的容器 */
  host: HTMLElement;
  /** 画布逻辑尺寸（CSS 像素） */
  width: number;
  height: number;
  /** 角色在画布中的显示高度，用于换算缩放 */
  characterHeight: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export async function mountPaimon(opts: MountOptions): Promise<PaimonController> {
  try {
    return await mountCubism(opts);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[paimon] moc3 模型不可用，改用参数化骨骼 rig：", err);
    }
  }
  const { mountRig } = await import("./paimonRig");
  return mountRig(opts);
}

/** 第一级：真 Live2D（paimon.model3.json）。资源缺失时在任何重资源加载前抛出。 */
async function mountCubism(opts: MountOptions): Promise<PaimonController> {
  const { host, width, height, characterHeight } = opts;

  if (typeof window === "undefined") throw new Error("Paimon Live2D 仅支持浏览器环境");
  if (!(window as { Live2DCubismCore?: unknown }).Live2DCubismCore) {
    throw new Error("Live2D Cubism Core 未加载");
  }

  // 先探一下模型清单是否存在：模型还没做出来时直接抛错回退，
  // 这样既不会把 pixi.js 整包拉下来，也不会在控制台刷一堆 404 报错。
  const probe = await fetch(MODEL_URL, { cache: "no-cache" });
  if (!probe.ok) throw new Error(`Live2D 模型不存在（HTTP ${probe.status}）`);

  const PIXI = await import("pixi.js");
  const { Live2DModel: Live2D } = await import("pixi-live2d-display/cubism4");

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  // 画布纯装饰：交互（拖拽/点击）由外层容器处理。若画布可命中，Pixi 的事件系统
  // 会消费指针事件，导致外层 React 的 pointerdown 收不到、拖拽失效。
  canvas.style.pointerEvents = "none";
  canvas.setAttribute("aria-hidden", "true");

  const app = new PIXI.Application({
    view: canvas,
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoStart: false,
    sharedTicker: false,
  });

  let model: Live2DModel;
  try {
    model = await Live2D.from(MODEL_URL, {
      autoInteract: false,
      autoFocus: false,
      autoUpdate: false,
    });
  } catch (err) {
    app.destroy(true, { children: true });
    throw err;
  }

  app.stage.addChild(model);
  model.anchor.set(0.5, 1);

  const fit = () => {
    const size = (
      model.internalModel as unknown as { getSize(): [number, number] }
    ).getSize();
    model.scale.set(characterHeight / size[1]);
    model.position.set(width / 2, height);
  };
  fit();

  const core = model.internalModel.coreModel as unknown as CoreModel;
  const exists = (id: string) => {
    try {
      return core.getParameterIndex(id) >= 0;
    } catch {
      return false;
    }
  };
  const has = {
    eyeL: exists(P.eyeLOpen),
    eyeR: exists(P.eyeROpen),
    eyeballX: exists(P.eyeballX),
    eyeballY: exists(P.eyeballY),
    angleX: exists(P.angleX),
    angleY: exists(P.angleY),
    bodyAngleX: exists(P.bodyAngleX),
    mouth: exists(P.mouthOpenY),
  };

  // ---- 运行时状态 -------------------------------------------------------
  const now0 = performance.now();
  let gazeTX = 0;
  let gazeTY = 0;
  let gazeX = 0;
  let gazeY = 0;
  let dragging = false;
  let mouth = 0;
  let eyeOpen = 1;
  let blinkT = -1;
  let nextBlink = now0 + rand(1800, 4200);
  let nextIdle = now0 + rand(5000, 9000);
  let wavePending = true;
  let destroyed = false;

  /** 每帧在核心模型烘焙前写入参数 */
  const applyParams = () => {
    if (has.eyeL) core.setParameterValueById(P.eyeLOpen, eyeOpen);
    if (has.eyeR) core.setParameterValueById(P.eyeROpen, eyeOpen);
    if (has.eyeballX) core.addParameterValueById(P.eyeballX, gazeX);
    if (has.eyeballY) core.addParameterValueById(P.eyeballY, -gazeY);
    if (has.angleX) core.addParameterValueById(P.angleX, gazeX * 30);
    if (has.angleY) core.addParameterValueById(P.angleY, -gazeY * 22);
    if (has.bodyAngleX) core.addParameterValueById(P.bodyAngleX, gazeX * 8);
    if (has.mouth) core.addParameterValueById(P.mouthOpenY, mouth);
  };
  const events = model.internalModel as unknown as EventedInternalModel;
  events.on("beforeModelUpdate", applyParams);

  const hasGroup = (group: string) => {
    const defs = model.internalModel.motionManager.definitions;
    return Array.isArray(defs[group]) && defs[group].length > 0;
  };

  const playMotion = async (group: string) => {
    if (destroyed || !hasGroup(group)) return;
    try {
      await model.motion(group);
    } catch {
      /* 动作缺失或加载失败时静默忽略，不影响待机 */
    }
  };

  const playExpression = async () => {
    if (destroyed) return;
    const em = model.internalModel.motionManager.expressionManager;
    if (!em) return;
    const name = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
    try {
      if (em.getExpressionIndex(name) >= 0) await model.expression(name);
    } catch {
      /* 表情缺失时忽略 */
    }
  };

  // ---- 主循环：自己驱动 update + render，顺序确定、便于清理 ---------------
  let raf = 0;
  let last = now0;

  const frame = (t: number) => {
    if (destroyed) return;
    raf = window.requestAnimationFrame(frame);

    const dt = Math.min(t - last, 50); // 切窗口回来时钳制，避免跳变
    last = t;

    // 注视：拖拽时回正，其余时间平滑逼近指针
    const tx = dragging ? 0 : gazeTX;
    const ty = dragging ? 0 : gazeTY;
    const k = Math.min(1, dt / 110);
    gazeX += (tx - gazeX) * k;
    gazeY += (ty - gazeY) * k;

    // 眨眼：闭合 42% 时间、睁开 58%，之后随机等待
    if (blinkT < 0 && t >= nextBlink) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const p = blinkT / 170;
      if (p >= 1) {
        blinkT = -1;
        eyeOpen = 1;
        nextBlink = t + rand(2200, 5200);
      } else {
        const closed = p < 0.42 ? p / 0.42 : (1 - p) / 0.58;
        eyeOpen = Math.max(0, 1 - closed);
      }
    }

    // 口型：指数衰减到 0
    mouth *= Math.exp(-dt / 85);
    if (mouth < 0.01) mouth = 0;

    // 待机动作
    if (t >= nextIdle) {
      nextIdle = t + rand(7000, 13000);
      void playMotion(wavePending ? GROUP.wave : GROUP.idle);
      wavePending = false;
    }

    model.update(dt);
    app.render();
  };

  host.appendChild(canvas);
  raf = window.requestAnimationFrame(frame);

  // 标签页不可见时停掉 rAF（省 CPU/GPU，切回来立即恢复）；
  // 不做 destroy —— 那会导致每次切窗口都重新加载模型、闪一下。
  const onVisibility = () => {
    if (destroyed) return;
    if (document.hidden) {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    } else if (!raf) {
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const controller: PaimonController = {
    setGaze(x, y) {
      gazeTX = Math.max(-1, Math.min(1, x));
      gazeTY = Math.max(-1, Math.min(1, y));
    },
    setDragging(on) {
      dragging = on;
      if (on) void playMotion(GROUP.drag);
    },
    pulseMouth() {
      mouth = Math.min(1, mouth + 0.6);
    },
    playTap() {
      void playMotion(GROUP.tap);
      void playExpression();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        events.off("beforeModelUpdate", applyParams);
      } catch {
        /* 模型可能已销毁 */
      }
      try {
        model.destroy();
      } catch {
        /* 忽略重复销毁 */
      }
      try {
        app.destroy(true, { children: true });
      } catch {
        /* 忽略重复销毁 */
      }
    },
  };

  return controller;
}