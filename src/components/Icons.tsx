import type { SVGProps } from "react";

type IconName = "home" | "grid" | "menu" | "store" | "close" | "logout" | "search" | "cart" | "arrow" | "minus" | "plus" | "trash" | "refresh" | "spark" | "user" | "check";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10.8 9-7.2 9 7.2"/><path d="M5 9.8V21h14V9.8M9 21v-7h6v7"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  store: <><path d="M4 10v10h16V10"/><path d="M3 10 5 4h14l2 6"/><path d="M3 10a3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 3-3"/><path d="M9 20v-5h6v5"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  logout: <><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4"/><path d="M9 12h9"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/></>,
  cart: <><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
  arrow: <><path d="m9 18 6-6-6-6"/></>,
  minus: <path d="M5 12h14"/>,
  plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/><path d="M10 11v6M14 11v6"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7.5 7.5 0 1 0-1.8 5"/></>,
  spark: <><path d="m12 3 1.2 4.3L17.5 9l-4.3 1.7L12 15l-1.2-4.3L6.5 9l4.3-1.7L12 3Z"/><path d="m19 15 .6 2.1 2.1.9-2.1.9L19 21l-.6-2.1-2.1-.9 2.1-.9L19 15Z"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.04 3A12.93 12.93 0 0 0 5.11 22.84L3 30l7.35-2.02A12.96 12.96 0 1 0 16.04 3Zm0 23.73c-1.9 0-3.76-.5-5.39-1.45l-.39-.23-4.36 1.2 1.23-4.25-.25-.4A10.73 10.73 0 1 1 16.04 26.73Zm5.89-8.04c-.32-.16-1.91-.94-2.21-1.05-.29-.11-.51-.16-.72.16-.22.32-.83 1.05-1.02 1.27-.19.21-.37.24-.7.08-.32-.16-1.36-.5-2.59-1.6a9.72 9.72 0 0 1-1.79-2.23c-.19-.32-.02-.5.14-.66.15-.14.32-.37.49-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.63-.53-.55-.72-.56h-.62c-.22 0-.57.08-.86.4-.3.33-1.13 1.11-1.13 2.7 0 1.59 1.16 3.13 1.32 3.35.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.78.25 1.48.21 2.04.13.62-.09 1.91-.78 2.18-1.54.27-.75.27-1.4.19-1.54-.08-.13-.3-.21-.62-.37Z" />
    </svg>
  );
}
