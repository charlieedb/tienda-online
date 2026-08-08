"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type Category = {
  token: string;
  label: string;
  icon:
    | "hamburger"
    | "sparkles"
    | "tag"
    | "wine"
    | "beer"
    | "milk"
    | "bread"
    | "drink"
    | "clean"
    | "meat";
};

function Icon({ name }: { name: Category["icon"] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "hamburger":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    case "sparkles":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M12 2l1.2 4.4L18 8l-4.4 1.2L12 14l-1.2-4.8L6 8l4.8-1.6L12 2z" />
          <path d="M19 11l.7 2.7L22 15l-2.3.6L19 18l-.6-2.4L16 15l2.4-.7L19 11z" />
        </svg>
      );
    case "wine":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M8 3h8v5a4 4 0 0 1-8 0V3z" />
          <path d="M12 12v7" />
          <path d="M8 22h8" />
        </svg>
      );
    case "beer":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M7 6h9v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z" />
          <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
          <path d="M7 6c0-2 1.5-3 3-3h3c1.5 0 3 1 3 3" />
        </svg>
      );
    case "milk":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M9 3h6l1 3-2 2v13H10V8L8 6l1-3z" />
          <path d="M10 8h4" />
        </svg>
      );
    case "bread":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M4 11c0-4 4-7 8-7s8 3 8 7v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
          <path d="M8 11v10" />
          <path d="M16 11v10" />
        </svg>
      );
    case "drink":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M7 3h10l-1 18H8L7 3z" />
          <path d="M9 8h6" />
        </svg>
      );
    case "clean":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M5 12l5 5L20 7" />
          <path d="M4 5l4 4" />
          <path d="M20 19l-4-4" />
        </svg>
      );
    case "meat":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M8 16c2 2 6 2 8 0 2-2 2-6 0-8-2-2-6-2-8 0-2 2-2 6 0 8z" />
          <path d="M7 17l-2 2a2 2 0 0 1-3-3l2-2" />
        </svg>
      );
    case "tag":
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" {...common}>
          <path d="M20 13l-7 7-11-11V2h7l11 11z" />
          <path d="M7.5 7.5h.01" />
        </svg>
      );
  }
}

export function TopBar({
  userLabel,
  menuOpen,
  onToggleMenu,
  onGoHome,
  categories,
  onSelectCategory,
  onCloseMenu,
  onOpenSettings,
  onOpenOrders,
  onSignOut,
}: {
  userLabel: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onGoHome: () => void;
  categories: Category[];
  onSelectCategory: (cat: Category) => void;
  onCloseMenu: () => void;
  onOpenSettings: () => void;
  onOpenOrders: () => void;
  onSignOut: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: Event) => {
      const el = userMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    setUserMenuOpen(false);
  }, [menuOpen]);

  return (
    <>
      <header className="app-topbar fixed left-0 right-0 top-0 z-50 w-full border-b border-white/12 bg-[#FF0000] text-[#F8F9FA] shadow-[0_4px_12px_rgba(15,23,42,0.12)]">
        <div className="app-topbar__inner relative mx-auto flex h-12 w-full max-w-6xl items-center px-3 md:h-16 md:px-6">
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="Menú"
            className="app-topbar__toggle inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 md:h-11 md:w-11"
          >
            <Icon name="hamburger" />
          </button>

          <button
            type="button"
            onClick={onGoHome}
            aria-label="Ir al inicio"
            className="app-topbar__brand absolute left-1/2 -translate-x-1/2 rounded-xl px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <Image
              src="/joma-express-white.png"
              alt="JOMA Express"
              width={776}
              height={329}
              priority
              className="h-7 w-auto max-w-[160px] select-none object-contain sm:h-8 sm:max-w-[200px] md:h-10 md:max-w-[220px]"
              sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 220px"
            />
          </button>

          <div className="app-topbar__user-wrap ml-auto flex min-w-[72px] justify-end md:min-w-[88px]">
            {userLabel ? (
              <div ref={userMenuRef} className="app-topbar__user-shell relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="app-topbar__user inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 md:h-11 md:w-11"
                  aria-label="Abrir menú de usuario"
                  title={userLabel ?? "Cuenta"}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
                </button>

              </div>
            ) : (
              <div className="text-right text-[10px] font-semibold text-white/60 sm:text-[11px]" />
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              aria-label="Cerrar menú"
              className="modal-backdrop-lite fixed inset-0 z-[55]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMenu}
            />

            <motion.aside
              className="app-panel app-topbar__drawer fixed left-0 top-0 z-[60] h-dvh w-[min(340px,88vw)] bg-white shadow-2xl"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 44 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-white/10 bg-[#FF0000] px-4 py-3 text-[#F8F9FA]">
                <div className="text-sm font-black italic tracking-tight">JOMA Express</div>
                <div className="text-[11px] font-semibold text-white/85">Categorías</div>
              </div>

              <div className="no-scrollbar h-[calc(100%-56px)] overflow-auto p-3">
                <div className="flex flex-col gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.token}
                      type="button"
                      onClick={() => onSelectCategory(c)}
                      className="flex items-center gap-3 rounded-2xl border border-[rgba(29,53,87,0.12)] bg-white px-3 py-3 text-left shadow-sm hover:bg-[rgba(69,123,157,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(69,123,157,0.12)] text-[#1D3557]">
                        <Icon name={c.icon} />
                      </span>
                      <span className="text-sm font-semibold text-foreground">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {userMenuOpen ? (
          <>
            <motion.button
              aria-label="Cerrar menú de usuario"
              className="modal-backdrop-lite fixed inset-0 z-[55]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserMenuOpen(false)}
            />

            <motion.aside
              className="app-panel app-topbar__drawer app-topbar__drawer--right fixed right-0 top-0 z-[60] h-dvh w-[min(340px,88vw)] bg-white shadow-2xl"
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 44 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-white/10 bg-[#FF0000] px-4 py-3 text-[#F8F9FA]">
                <div className="text-sm font-black italic tracking-tight">JOMA Express</div>
                <div className="text-[11px] font-semibold text-white/85">
                  {userLabel ?? "Cuenta"}
                </div>
              </div>

              <div className="no-scrollbar h-[calc(100%-56px)] overflow-auto p-3">
                <div className="flex flex-col gap-2" role="menu">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[rgba(29,53,87,0.12)] bg-white px-4 py-3 text-left text-sm font-semibold text-foreground shadow-sm hover:bg-[rgba(69,123,157,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    role="menuitem"
                  >
                    Configuración
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[rgba(29,53,87,0.12)] bg-white px-4 py-3 text-left text-sm font-semibold text-foreground shadow-sm hover:bg-[rgba(69,123,157,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenOrders();
                    }}
                    role="menuitem"
                  >
                    Historial de pedidos
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[rgba(230,57,70,0.14)] bg-white px-4 py-3 text-left text-sm font-semibold text-[#C1121F] shadow-sm hover:bg-[rgba(230,57,70,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1121F]"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onSignOut();
                    }}
                    role="menuitem"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}


