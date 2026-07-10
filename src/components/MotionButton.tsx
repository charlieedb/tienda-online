"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"button"> & {
  tone?: "primary" | "ghost" | "soft";
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  primary:
    "bg-[#d62828] text-white shadow-[0_18px_38px_rgba(214,40,40,0.22)] hover:bg-[#b91c1c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d62828]",
  ghost:
    "border border-[rgba(31,41,55,0.12)] bg-white/84 text-foreground hover:bg-[rgba(31,41,55,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d62828]",
  soft:
    "bg-[rgba(214,40,40,0.10)] text-[#7f1d1d] hover:bg-[rgba(214,40,40,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d62828]",
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
        "app-button",
        `app-button--${tone}`,
        "inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
