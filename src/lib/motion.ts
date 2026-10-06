"use client";

import { useEffect, useState } from "react";

/** 是否开启系统「减弱动态效果」——动效实现处用它做 JS 侧降级 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** 通用媒体查询（挂载后求值，SSR 期间为 false） */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** 触屏设备（粗指针）：桌面图标单击即打开，跳过双击 */
export function useIsCoarsePointer() {
  return useMediaQuery("(pointer: coarse)");
}
