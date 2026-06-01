"use client";

import { AnimatePresence, motion } from "framer-motion";

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
}: {
  userLabel: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onGoHome: () => void;
  categories: Category[];
  onSelectCategory: (cat: Category) => void;
  onCloseMenu: () => void;
}) {
  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#E10600] text-white shadow-md">
        <div className="flex h-12 w-full items-center px-3">
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="Menú"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            <Icon name="hamburger" />
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="mx-auto rounded-xl px-3 py-1 font-black italic tracking-tight hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            JONICO
          </button>

          <div className="min-w-[72px] text-right text-[11px] font-semibold text-white/90">
            {userLabel ?? ""}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              aria-label="Cerrar menú"
              className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMenu}
            />

            <motion.aside
              className="fixed left-0 top-0 z-[60] h-dvh w-[min(340px,88vw)] bg-white shadow-2xl"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 44 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-black/10 bg-[#E10600] px-4 py-3 text-white">
                <div className="text-sm font-black italic tracking-tight">JONICO</div>
                <div className="text-[11px] font-semibold text-white/85">Categorías</div>
              </div>

              <div className="no-scrollbar h-[calc(100%-56px)] overflow-auto p-3">
                <div className="flex flex-col gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.token}
                      type="button"
                      onClick={() => onSelectCategory(c)}
                      className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-3 py-3 text-left shadow-sm hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/30"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-black/80">
                        <Icon name={c.icon} />
                      </span>
                      <span className="text-sm font-semibold text-black">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

