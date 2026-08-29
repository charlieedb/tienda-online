import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AdminPedidosPage } from "./components/admin/AdminPedidosPage";
import "./styles.css";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { ConsentPreferences } from "./components/ConsentPreferences";

const isAdminPedidosRoute =
  window.location.pathname.replace(/\/+$/, "") === "/admin/pedidos";

if (!isAdminPedidosRoute) {
  initAnalytics();
  trackPageView(`${window.location.pathname}${window.location.search}`);
  window.addEventListener("joma:consent-updated", () => trackPageView(`${window.location.pathname}${window.location.search}`), { once: true });
}

if (isAdminPedidosRoute) {
  document.title = "Administración | Joma Group";
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(document.createElement("meta"));
  robots.setAttribute("name", "robots");
  robots.setAttribute("content", "noindex,nofollow,noarchive");
  await import("./app/globals.css");
  await import("./admin-desktop.css");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      {isAdminPedidosRoute ? <AdminPedidosPage /> : <App />}
      {!isAdminPedidosRoute ? <ConsentPreferences /> : null}
    </AuthProvider>
  </StrictMode>,
);
