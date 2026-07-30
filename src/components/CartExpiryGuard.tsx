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
  const observedActiveTimer = useRef(false);
  const extendButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => useCartStore.persist.onFinishHydration(() => setHydrated(true)),
    [],
  );

  useEffect(() => {
    if (!hydrated || !itemCount || !expiresAt) {
      observedActiveTimer.current = false;
      setGraceDeadline(null);
      return;
    }

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      if (!observedActiveTimer.current || !allowPrompt || Date.now() >= expiresAt + RESPONSE_GRACE_MS) {
        clear();
      } else {
        setNow(Date.now());
        setGraceDeadline(expiresAt + RESPONSE_GRACE_MS);
      }
      return;
    }

    observedActiveTimer.current = true;
    const timer = window.setTimeout(() => {
      if (!allowPrompt) {
        clear();
        return;
      }
      setNow(Date.now());
      setGraceDeadline(expiresAt + RESPONSE_GRACE_MS);
    }, remaining);

    return () => window.clearTimeout(timer);
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
    extendExpiry();
    setGraceDeadline(null);
  };

  const handleClear = () => {
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
