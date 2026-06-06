"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"button"> & {
  tone?: "primary" | "ghost" | "soft";
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  primary:
    "bg-brand text-white shadow-[0_14px_28px_rgba(69,123,157,0.22)] hover:bg-brand-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  ghost:
    "border border-[rgba(29,53,87,0.14)] bg-white/82 text-foreground hover:bg-[rgba(69,123,157,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  soft:
    "bg-[rgba(69,123,157,0.14)] text-[#1D3557] hover:bg-[rgba(69,123,157,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]",
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
        "inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
