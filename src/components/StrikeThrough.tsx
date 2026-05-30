"use client";

import { motion } from "framer-motion";
import { useId } from "react";

export function StrikeThrough({
  active,
  from = 0,
  to = 100,
  className,
}: {
  active: boolean;
  from?: number;
  to?: number;
  className?: string;
}) {
  const clampedFrom = Math.max(0, Math.min(100, from));
  const clampedTo = Math.max(clampedFrom, Math.min(100, to));
  const rid = useId();
  const clipId = `clip_${rid}`;

  return (
    <motion.svg
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2",
        className ?? "",
      ].join(" ")}
      viewBox="0 0 100 10"
      initial={false}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={clampedFrom} y="0" width={clampedTo - clampedFrom} height="10" />
        </clipPath>
      </defs>
      <motion.path
        d="M 2 5 C 20 2, 40 8, 60 5 S 90 6, 98 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
