"use client";

import { useEffect, useRef, useState } from "react";
import { useCartStore } from "../store/cart";

const RESPONSE_GRACE_MS = 60 * 1000;

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CartExpiryCountdown() {
  const itemCount = useCartStore((state) => state.items.length);
  const expiresAt = useCartStore((state) => state.expiresAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!itemCount || !expiresAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, itemCount]);

  if (!itemCount || !expiresAt) return null;

  return (
    <p className="cart-expiry-countdown" aria-live="polite">
      Se vacía en {formatRemaining(expiresAt - now)}
    </p>
  );
}

type CartExpiryGuardProps = {
  allowPrompt: boolean;
};

export function CartExpiryGuard({ allowPrompt }: CartExpiryGuardProps) {
  const itemCount = useCartStore((state) => state.items.length);
  const expiresAt = useCartStore((state) => state.expiresAt);
  const clear = useCartStore((state) => state.clear);
  const extendExpiry = useCartStore((state) => state.extendExpiry);
  const [hydrated, setHydrated] = useState(useCartStore.persist.hasHydrated());
  const [graceDeadline, setGraceDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const armedExpiry = useRef<number | null>(null);
  const promptOpen = useRef(false);
  const hiddenSince = useRef<number | null>(
    typeof document !== "undefined" && document.visibilityState === "hidden"
      ? Date.now()
      : null,
  );
  const extendButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => useCartStore.persist.onFinishHydration(() => setHydrated(true)),
    [],
  );

  useEffect(() => {
    if (!hydrated || !itemCount || !expiresAt) {
      armedExpiry.current = null;
      promptOpen.current = false;
      setGraceDeadline(null);
      return;
    }

    const evaluateExpiry = () => {
      const currentTime = Date.now();
      if (currentTime < expiresAt) {
        armedExpiry.current = expiresAt;
        return;
      }
      if (promptOpen.current) return;

      const expiredWhileHidden = Boolean(
        hiddenSince.current && hiddenSince.current < expiresAt,
      );
      const wasRunningInThisSession = armedExpiry.current === expiresAt;
      const userIsPresent =
        allowPrompt &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        !expiredWhileHidden;

      if (!wasRunningInThisSession || !userIsPresent) {
        clear();
        return;
      }

      setNow(currentTime);
      promptOpen.current = true;
      setGraceDeadline(currentTime + RESPONSE_GRACE_MS);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        if (promptOpen.current) clear();
      } else {
        evaluateExpiry();
        hiddenSince.current = null;
      }
    };

    evaluateExpiry();
    const timer = window.setInterval(evaluateExpiry, 1000);
    window.addEventListener("focus", evaluateExpiry);
    window.addEventListener("pageshow", evaluateExpiry);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", evaluateExpiry);
      window.removeEventListener("pageshow", evaluateExpiry);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [allowPrompt, clear, expiresAt, hydrated, itemCount]);

  useEffect(() => {
    if (!graceDeadline) return;
    document.body.classList.add("cart-expiry-open");
    extendButtonRef.current?.focus();
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= graceDeadline) clear();
    }, 1000);
    return () => {
      document.body.classList.remove("cart-expiry-open");
      window.clearInterval(timer);
    };
  }, [clear, graceDeadline]);

  if (!graceDeadline || !itemCount) return null;

  const handleExtend = () => {
    promptOpen.current = false;
    extendExpiry();
    setGraceDeadline(null);
  };

  const handleClear = () => {
    promptOpen.current = false;
    clear();
    setGraceDeadline(null);
  };

  return (
    <div className="cart-expiry-backdrop" role="presentation">
      <section
        className="cart-expiry-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cart-expiry-title"
        aria-describedby="cart-expiry-description"
      >
        <span className="cart-expiry-eyebrow">Carrito pausado</span>
        <h2 id="cart-expiry-title">Tiempo expirado del carrito</h2>
        <p id="cart-expiry-description">
          Para evitar conservar productos desactualizados, extendé el tiempo si todavía estás comprando.
        </p>
        <p className="cart-expiry-grace">
          Se vaciará automáticamente en {formatRemaining(graceDeadline - now)}
        </p>
        <div className="cart-expiry-actions">
          <button className="btn ghost" type="button" onClick={handleClear}>
            Vaciar carrito
          </button>
          <button
            ref={extendButtonRef}
            className="btn primary"
            type="button"
            onClick={handleExtend}
          >
            Extender 10 minutos
          </button>
        </div>
      </section>
    </div>
  );
}
