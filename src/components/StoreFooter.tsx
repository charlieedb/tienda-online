import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { navigateInStore } from "@/lib/seo";
import { PrivacyPreferencesButton } from "@/components/ConsentPreferences";

export type StoreInfoPageKey = "envios" | "locales" | "nosotros" | "contacto" | "privacidad";

const INFO_LINKS: Array<{ page: StoreInfoPageKey; label: string }> = [
  { page: "envios", label: "Envíos" },
  { page: "locales", label: "Locales" },
  { page: "nosotros", label: "Nosotros" },
  { page: "contacto", label: "Contacto" },
  { page: "privacidad", label: "Privacidad" },
];

export function StoreInfoFooter({ onSelect }: { onSelect?: (page: StoreInfoPageKey) => void }) {
  return <footer className="store-info-footer">
    <div><strong>Joma Group</strong><p>Mayorista y tienda online con entregas programadas en Corrientes Capital.</p></div>
    <nav aria-label="Información de Joma Group">
      {INFO_LINKS.map(({ page, label }) => <a href={`/?info=${page}`} onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (onSelect) onSelect(page);
        else navigateInStore(`/?info=${page}`);
      }} key={page}>{label}</a>)}
      <PrivacyPreferencesButton />
    </nav>
  </footer>;
}

export function StoreCreditBar() {
  const reduceMotion = useReducedMotion();
  const shellRef = useRef<HTMLElement>(null);
  const isVisible = useInView(shellRef, { once: true, amount: .7 });
  return <footer className="store-credit-shell" ref={shellRef}>
    <motion.div
      className="store-credit-bar"
      initial={false}
      animate={{ x: reduceMotion || isVisible ? 0 : "100%" }}
      transition={{ duration: reduceMotion ? 0 : .75, ease: [0.22, 1, 0.36, 1] }}
    >
      <span>Create by</span>
      <a href="https://www.instagram.com/charlieedb" target="_blank" rel="noreferrer">/charlieedb</a>
    </motion.div>
  </footer>;
}
