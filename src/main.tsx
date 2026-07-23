import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { AdminPedidosPage } from "./components/admin/AdminPedidosPage";
import "./styles.css";
import "./app/globals.css";

const isAdminPedidosRoute =
  window.location.pathname.replace(/\/+$/, "") === "/admin/pedidos";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      {isAdminPedidosRoute ? <AdminPedidosPage /> : <App />}
    </AuthProvider>
  </StrictMode>,
);
