"use client";

import { useEffect, useState } from "react";

const DIGITS = "0123456789";

/**
 * Signature move: a value rendered as split-flap cells. On mount every cell
 * cycles through random digits and settles left to right. The server markup
 * already holds the final text, so nothing is hidden before hydration.
 */
export function FlapNumber({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const [settled, setSettled] = useState(value.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...value];
    let tick = 0;
    const id = window.setInterval(() => {
      tick++;
      // one more cell settles every 3 ticks
      const done = Math.min(chars.length, Math.floor(tick / 3));
      setSettled(done);
      setShown(
        chars
          .map((c, i) =>
            i < done || !DIGITS.includes(c)
              ? c
              : DIGITS[Math.floor(Math.random() * 10)],
          )
          .join(""),
      );
      if (done >= chars.length) {
        window.clearInterval(id);
        setShown(value);
      }
    }, 55);
    return () => window.clearInterval(id);
  }, [value]);

  return (
    <span
      className={`inline-flex items-center gap-[0.12em] font-board font-semibold leading-none ${className}`}
      aria-label={value}
      role="text"
    >
      {[...shown].map((c, i) =>
        c === " " ? (
          <span key={i} className="w-[0.3em]" aria-hidden />
        ) : !DIGITS.includes(c) ? (
          <span key={i} className="px-[0.02em] text-muted-foreground" aria-hidden>
            {c}
          </span>
        ) : (
          <span
            key={i}
            className="flap text-center"
            data-turning={i >= settled - 1 && settled < value.length}
            aria-hidden
          >
            {c}
          </span>
        ),
      )}
    </span>
  );
}
