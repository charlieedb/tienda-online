import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AdminPedidosPage } from "./components/admin/AdminPedidosPage";
import "./styles.css";
import { initAnalytics, trackEvent } from "./lib/analytics";

const isAdminPedidosRoute =
  window.location.pathname.replace(/\/+$/, "") === "/admin/pedidos";

if (!isAdminPedidosRoute) {
  initAnalytics();
  trackEvent("page_view", { page_path: window.location.pathname, page_title: document.title });
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
    </AuthProvider>
  </StrictMode>,
);
