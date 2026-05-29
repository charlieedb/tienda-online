"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"button"> & {
  tone?: "primary" | "ghost" | "soft";
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  ghost:
    "bg-transparent text-foreground hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  soft: "bg-brand/10 text-brand hover:bg-brand/15",
};

export function MotionButton({
  className,
  tone = "primary",
  ...props
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 600, damping: 35 }}
      className={[
        "inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
