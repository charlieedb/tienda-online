"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MotionButton } from "@/components/MotionButton";

type NavKey = "home" | "builder" | "catalog";

type Props = {
  experience: "mobile" | "desktop";
  active: NavKey;
  centerBrand?: boolean;
  userLabel: string | null;
  onGoHome: () => void;
  onOpenBuilder: () => void;
  onOpenCatalog: () => void;
  onOpenSettings: () => void;
  onOpenOrders: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
};

export function StoreShellHeader({
  experience,
  active,
  centerBrand = false,
  userLabel,
  onGoHome,
  onOpenBuilder,
  onOpenCatalog,
  onOpenSettings,
  onOpenOrders,
  onSignOut,
  onOpenAuth,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <header className={`store-header ${centerBrand ? "store-header--center-brand" : ""}`}>
      <div className="store-header__inner">
        <div className="store-header__left-rail" aria-hidden="true">
          {centerBrand ? <div className="store-header__ghost" /> : null}
        </div>

        <button type="button" className="store-header__brand" onClick={onGoHome} aria-label="Ir al inicio">
          <Image
            src={centerBrand ? "/joma-express-white.png" : "/joma-express-black.png"}
            alt="JOMA Express"
            width={centerBrand ? 776 : 800}
            height={329}
            priority
            className={`store-header__logo ${centerBrand ? "store-header__logo--inverted" : ""}`}
            sizes="(max-width: 768px) 148px, 220px"
          />
          <span className="store-header__brand-copy">
            <strong>JOMA Express</strong>
            <small>{experience === "desktop" ? "Mostrador digital" : "Compra rápida"}</small>
          </span>
        </button>

        <nav className="store-header__nav" aria-label="Navegación principal">
          <HeaderNavButton active={active === "home"} onClick={onGoHome}>
            Inicio
          </HeaderNavButton>
          <HeaderNavButton active={active === "builder"} onClick={onOpenBuilder}>
            Arma tu lista
          </HeaderNavButton>
          <HeaderNavButton active={active === "catalog"} onClick={onOpenCatalog}>
            Tienda Online
          </HeaderNavButton>
        </nav>

        <div ref={menuRef} className="store-header__account">
          {userLabel ? (
            <>
              <MotionButton
                type="button"
                tone="ghost"
                className="store-header__account-btn"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span className="store-header__account-label">{userLabel}</span>
                <span aria-hidden="true">▾</span>
              </MotionButton>

              <AnimatePresence>
                {menuOpen ? (
                  <motion.div
                    className="store-header__menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <button
                      type="button"
                      className="store-header__menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenSettings();
                      }}
                    >
                      Configuración
                    </button>
                    <button
                      type="button"
                      className="store-header__menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenOrders();
                      }}
                    >
                      Historial de pedidos
                    </button>
                    <button
                      type="button"
                      className="store-header__menu-item store-header__menu-item--danger"
                      onClick={() => {
                        setMenuOpen(false);
                        onSignOut();
                      }}
                    >
                      Cerrar sesión
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          ) : (
            <MotionButton type="button" className="store-header__auth-btn" onClick={onOpenAuth}>
              Iniciar sesión
            </MotionButton>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderNavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`store-header__nav-btn ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}
