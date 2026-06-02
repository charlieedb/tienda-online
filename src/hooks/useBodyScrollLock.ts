"use client";

import { useEffect } from "react";

let lockCount = 0;
let scrollY = 0;
let prevBodyStyle: {
  overflow: string;
  position: string;
  top: string;
  width: string;
} | null = null;

function lockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount === 0) {
    const { body } = document;
    scrollY = window.scrollY;
    prevBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;

  const { body } = document;
  body.style.overflow = prevBodyStyle?.overflow ?? "";
  body.style.position = prevBodyStyle?.position ?? "";
  body.style.top = prevBodyStyle?.top ?? "";
  body.style.width = prevBodyStyle?.width ?? "";
  window.scrollTo(0, scrollY);
  prevBodyStyle = null;
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
