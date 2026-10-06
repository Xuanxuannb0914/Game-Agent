"use client";

import { useEffect, useRef, useState } from "react";

interface RollingTextProps {
  value: string;
  className?: string;
}

/**
 * 逐字符数字滚动：值变化时旧字符上滑淡出、新字符下方滑入（130ms）。
 * 只有发生变化的字符会滚动；动画元素是纯文本 span（红线1安全）。
 */
export default function RollingText({ value, className }: RollingTextProps) {
  const [displayed, setDisplayed] = useState(value);
  const [prev, setPrev] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (value === displayed) return;
    setPrev(displayed);
    setDisplayed(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPrev(null), 150);
  }, [value, displayed]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const chars = displayed.split("");
  const prevChars = prev?.split("") ?? [];
  const rolling = prev !== null;

  return (
    <span className={className} aria-label={value} role="text">
      {chars.map((c, i) => {
        const changed = rolling && prevChars[i] !== c;
        return (
          <span
            key={`${i}-${c}`}
            aria-hidden
            className="relative inline-block"
          >
            {changed && prevChars[i] !== undefined && (
              <span
                className="roll-out absolute inset-0"
                style={{ transformOrigin: "center" }}
              >
                {prevChars[i]}
              </span>
            )}
            <span className={changed ? "roll-in" : undefined}>{c}</span>
          </span>
        );
      })}
    </span>
  );
}
