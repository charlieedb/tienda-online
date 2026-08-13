import type { ImgHTMLAttributes, SVGProps } from "react";

type IconName = "home" | "grid" | "menu" | "store" | "ticket" | "close" | "logout" | "search" | "bell" | "cart" | "arrow" | "minus" | "plus" | "trash" | "refresh" | "spark" | "user" | "check";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10.8 9-7.2 9 7.2"/><path d="M5 9.8V21h14V9.8M9 21v-7h6v7"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  store: <><path d="M4 10v10h16V10"/><path d="M3 10 5 4h14l2 6"/><path d="M3 10a3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 3-3"/><path d="M9 20v-5h6v5"/></>,
  ticket: <><path d="M3 8.5A2.5 2.5 0 0 0 5.5 6H21v4a2 2 0 0 0 0 4v4H5.5A2.5 2.5 0 0 0 3 15.5v-7Z"/><path d="M14 9.5h.01M10 14.5h.01M9.5 15l5-6"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  logout: <><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4"/><path d="M9 12h9"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
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

export function WhatsAppIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src="/whatsapp-logo.png" alt="" aria-hidden="true" width="36" height="36" {...props} />;
}
