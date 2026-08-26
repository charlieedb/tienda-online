"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getAdminProfile, type AdminProfile } from "@/lib/adminAuth";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminStoreConfigPanel } from "@/components/admin/AdminStoreConfigPanel";
import { AdminNotificationsPanel } from "@/components/admin/AdminNotificationsPanel";
import { AdminCarouselPanel } from "@/components/admin/AdminCarouselPanel";
import { AdminCustomersPanel } from "@/components/admin/AdminCustomersPanel";
import { AdminCouponsPanel } from "@/components/admin/AdminCouponsPanel";
import { generateOrderRemitoPdf } from "@/lib/remitoPdf";
import {
  buildMetrics,
  fetchRecentSearchEvents,
  formatMoney,
  orderMoment,
  subscribeOrdersRealtime,
  rejectOrderAndRestoreStock,
  updateOrderWorkflow,
  type OrderStatus,
  type OrderRecord,
  type SearchEvent,
} from "@/lib/orders";

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "new", label: "Nuevo" },
  { value: "preparing", label: "Preparado" },
  { value: "dispatched", label: "Remitado" },
  { value: "delivered", label: "Cobrado" },
  { value: "rejected", label: "Rechazado" },
];

function statusLabel(status: OrderStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function statusPill(status: OrderStatus) {
  switch (status) {
    case "preparing":
      return "bg-[#fff3c9] text-[#7a4b00] border-[#f6d97a]";
    case "dispatched":
      return "bg-[#dff6eb] text-[#0f5c3a] border-[#87d3af]";
    case "delivered":
      return "bg-[#dce9ff] text-[#1a438f] border-[#96b6f7]";
    case "rejected":
      return "bg-[#fee7e7] text-[#8b1e24] border-[#efaaaa]";
    default:
      return "bg-white/85 text-black/75 border-black/10";
  }
}

function formatDateTime(value: string) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function DashboardMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/78 px-4 py-4 shadow-[0_14px_30px_rgba(30,41,59,0.10)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#1d2538]">{value}</div>
      <div className="mt-1 text-sm text-black/55">{hint}</div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 7.75V6.5A2.5 2.5 0 0 0 11.5 4h-4A2.5 2.5 0 0 0 5 6.5v11A2.5 2.5 0 0 0 7.5 20h4a2.5 2.5 0 0 0 2.5-2.5v-1.25" />
      <path d="M10 12h9" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  );
}

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function AdminPedidosPage() {
  const { user, loading, signInUsernameSession, resetAdminPassword, signOut } = useAuth();
  const [adminSessionActive, setAdminSessionActive] = useState(false);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [searches, setSearches] = useState<SearchEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [adminView, setAdminView] = useState<"orders" | "customers" | "users" | "notifications" | "configuration" | "coupons" | "carousel">("orders");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all");
  const [searchText, setSearchText] = useState("");
  const deferredSearch = useDeferredValue(searchText);
  const [dispatchDrafts, setDispatchDrafts] = useState<Record<string, { remito: string; note: string }>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef<HTMLDivElement | null>(null);
  const [todayKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekStartMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdminSessionActive(window.sessionStorage.getItem("adminPedidosSession") === "1");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!user || !adminSessionActive) {
        if (!cancelled) {
          setAdminProfile(null);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);
      try {
        const profile = await getAdminProfile(user.uid);
        if (!cancelled) setAdminProfile(profile && profile.active ? profile : null);
      } catch {
        if (!cancelled) setAdminProfile(null);
      } finally {
        if (!cancelled) setCheckingAdmin(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [user, adminSessionActive]);

  useEffect(() => {
    if (!adminProfile) return;

    let cancelled = false;
    setLoadingData(true);
    const unsub = subscribeOrdersRealtime(
      (items) => {
        if (cancelled) return;
        startTransition(() => {
          setOrders(items);
        });
        setLoadingData(false);
      },
      () => {
        if (!cancelled) setLoadingData(false);
      },
    );

    fetchRecentSearchEvents()
      .then((recentSearches) => {
        if (!cancelled) setSearches(recentSearches);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        unsub?.();
      } catch {
        // La suscripción puede haberse cerrado antes durante el desmontaje.
      }
    };
  }, [adminProfile]);

  useEffect(() => {
    if (!topMenuOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!topMenuRef.current?.contains(event.target as Node)) setTopMenuOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTopMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [topMenuOpen]);

  const filteredOrders = useMemo(() => {
    const tokens = deferredSearch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      const created = orderMoment(order);
      if (dateFilter === "today" && created.slice(0, 10) !== todayKey) return false;
      if (dateFilter === "week") {
        const createdMs = new Date(created).getTime();
        if (Number.isNaN(createdMs) || createdMs < weekStartMs) return false;
      }

      if (!tokens.length) return true;
      const haystack = [
        order.id,
        order.cliente.nombre,
        order.cliente.telefono,
        order.cliente.direccion,
        order.cliente.preventistaReferido,
        ...order.items.flatMap((item) => [item.codigo, item.nombre]),
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return tokens.every((token) => haystack.includes(token));
    });
  }, [orders, deferredSearch, statusFilter, dateFilter, todayKey, weekStartMs]);

  const todayOrders = useMemo(
    () => orders.filter((order) => orderMoment(order).slice(0, 10) === todayKey),
    [orders, todayKey],
  );

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedId) || null,
    [filteredOrders, selectedId],
  );

  const metrics = useMemo(() => buildMetrics(orders, searches), [orders, searches]);
  const filteredStats = useMemo(() => {
    const billable = filteredOrders.filter((order) => order.status !== "rejected");
    const total = billable.reduce((sum, order) => sum + order.totals.total, 0);
    return {
      orders: filteredOrders.length,
      total,
      average: billable.length ? total / billable.length : 0,
      units: billable.reduce((sum, order) => sum + order.metrics.totalUnits, 0),
      boxes: billable.reduce((sum, order) => sum + order.metrics.totalBoxes, 0),
      discounts: billable.reduce((sum, order) => sum + order.totals.discountTotal, 0),
    };
  }, [filteredOrders]);

  const draft = selectedOrder
    ? dispatchDrafts[selectedOrder.id] || {
        remito: selectedOrder.dispatch.remitoNumber || "",
        note: selectedOrder.dispatch.observaciones || "",
      }
    : null;

  async function handleAdminSignOut() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("adminPedidosSession");
    }
    setAdminSessionActive(false);
    await signOut();
  }

  async function handleLogin() {
    setAuthError("");
    try {
      await signInUsernameSession(loginForm.username.trim(), loginForm.password);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("adminPedidosSession", "1");
      }
      setAdminSessionActive(true);
    } catch (error) {
      setAuthError(String((error as Error)?.message || error || "No se pudo iniciar sesion."));
    }
  }

  async function handlePasswordReset() {
    setAuthError("");
    if (!loginForm.username.trim()) {
      setAuthError("Ingresá tu usuario para recuperar la contraseña.");
      return;
    }
    try {
      await resetAdminPassword(loginForm.username.trim());
      setAuthError("Te enviamos un correo para restablecer la contraseña.");
    } catch (error) {
      setAuthError(String((error as Error)?.message || "No se pudo enviar el correo."));
    }
  }

  async function handleStatusChange(order: OrderRecord, status: OrderStatus) {
    if (!user) return;
    const actorName = adminProfile?.name || user.email || user.uid.replace(/^adminop_/, "");
    const draftValue = dispatchDrafts[order.id] || { remito: "", note: "" };
    const nowIso = new Date().toISOString();
    setSavingOrderId(order.id);
    setSavingStatus(status);
    try {
      let remitoNumber = draftValue.remito;
      if (status === "dispatched") {
        remitoNumber = await generateOrderRemitoPdf({
          order,
          actor: user,
          remitoNumber: draftValue.remito,
        });

        setDispatchDrafts((prev) => ({
          ...prev,
          [order.id]: {
            remito: remitoNumber,
            note: prev[order.id]?.note || draftValue.note || "",
          },
        }));
      }

      await updateOrderWorkflow({
        orderId: order.id,
        status,
        actor: actorName,
        remitoNumber,
        observaciones: draftValue.note,
      });

      startTransition(() => {
        setOrders((prev) =>
          prev.map((entry) =>
            entry.id !== order.id
              ? entry
              : {
                  ...entry,
                  status,
                  dispatch: {
                    remitoNumber: remitoNumber || null,
                    observaciones: draftValue.note,
                    remitidoAtIso: status === "dispatched" ? nowIso : entry.dispatch.remitidoAtIso,
                  },
                  audit: {
                    ...entry.audit,
                    updatedAtIso: nowIso,
                    lastActionBy: actorName,
                  },
                  history: entry.history.concat({
                    status,
                    atIso: nowIso,
                    actor: actorName,
                    note:
                      [remitoNumber ? `Remito ${remitoNumber}` : "", draftValue.note]
                        .filter(Boolean)
                        .join(" · ") || `Estado cambiado a ${statusLabel(status)}.`,
                  }),
                },
          ),
        );
      });
    } finally {
      setSavingOrderId(null);
      setSavingStatus(null);
    }
  }

  async function handleOpenRemito(order: OrderRecord) {
    await generateOrderRemitoPdf({
      order,
      actor: user,
      remitoNumber: order.dispatch.remitoNumber || undefined,
    });
  }

  async function handleRejectOrder(order: OrderRecord) {
    if (!user || rejectReason.trim().length < 3) return;
    setSavingOrderId(order.id);
    setActionError("");
    try {
      const token = await user.getIdToken();
      await rejectOrderAndRestoreStock({
        orderId: order.id,
        reason: rejectReason,
        token,
      });
      setRejectingId(null);
      setRejectReason("");
    } catch (error) {
      setActionError(String((error as Error)?.message || "No se pudo rechazar el pedido."));
    } finally {
      setSavingOrderId(null);
    }
  }

  if (loading || checkingAdmin) {
    return (
      <main className="admin-shell">
        <div className="admin-card p-6 text-sm font-medium text-black/65">Verificando acceso...</div>
      </main>
    );
  }

  if (!user || !adminSessionActive) {
    return (
      <main className="admin-shell">
        <section className="admin-card admin-login-card overflow-hidden">
          <div className="admin-card__head">
            <div>
              <div className="admin-kicker">Panel privado</div>
              <h1 className="admin-title">Centro de control de pedidos</h1>
              <p className="admin-subtitle">
                Ingresá con tu usuario interno del administrador de tienda.
              </p>
            </div>
          </div>
          <div className="admin-card__body space-y-4">
            <div className="admin-login-fields">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-black/65">Usuario o email</span>
                <input
                  className="admin-input"
                  type="text"
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Ej: carlos o nombre@email.com"
                  autoComplete="username"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-black/65">Contrasena</span>
                <input
                  className="admin-input"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="******"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleLogin();
                  }}
                />
              </label>
            </div>
            {authError ? <div className="admin-error">{authError}</div> : null}
            <div className="flex justify-end">
              <div className="admin-login-actions">
                <button type="button" className="admin-forgot-password" onClick={() => void handlePasswordReset()}>
                  Olvidé mi contraseña
                </button>
                <button type="button" className="btn primary min-w-40" onClick={() => void handleLogin()}>
                  Ingresar
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!adminProfile) {
    return (
      <main className="admin-shell">
        <section className="admin-card admin-login-card overflow-hidden">
          <div className="admin-card__head">
            <div>
              <div className="admin-kicker">Acceso denegado</div>
              <h1 className="admin-title">Tu usuario no esta habilitado</h1>
              <p className="admin-subtitle">
                Este panel solo admite admins cargados manualmente en la allowlist `adminUsers`.
              </p>
            </div>
          </div>
          <div className="admin-card__body flex justify-end">
            <button type="button" className="btn ghost" onClick={() => void handleAdminSignOut()}>
              Cerrar sesion
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar-menu" ref={topMenuRef}>
          <button
            type="button"
            className="admin-topbar__icon"
            aria-label="Abrir menú"
            aria-expanded={topMenuOpen}
            aria-controls="admin-main-menu"
            onClick={() => setTopMenuOpen((current) => !current)}
          >
            <MenuIcon />
          </button>
          {topMenuOpen ? (
            <nav id="admin-main-menu" className="admin-main-menu" aria-label="Menú del administrador">
              <button type="button" className={adminView === "orders" ? "is-active" : ""} onClick={() => { setAdminView("orders"); setTopMenuOpen(false); }}>Pedidos</button>
              <button type="button" className={adminView === "customers" ? "is-active" : ""} onClick={() => { setAdminView("customers"); setTopMenuOpen(false); }}>Clientes</button>
              <button type="button" className={adminView === "users" ? "is-active" : ""} onClick={() => { setAdminView("users"); setTopMenuOpen(false); }}>Usuarios</button>
              <button type="button" className={adminView === "notifications" ? "is-active" : ""} onClick={() => { setAdminView("notifications"); setTopMenuOpen(false); }}>Notificaciones</button>
              <button type="button" className={adminView === "configuration" ? "is-active" : ""} onClick={() => { setAdminView("configuration"); setTopMenuOpen(false); }}>Configuración</button>
              <button type="button" className={adminView === "coupons" ? "is-active" : ""} onClick={() => { setAdminView("coupons"); setTopMenuOpen(false); }}>Cupones</button>
              <button type="button" className={adminView === "carousel" ? "is-active" : ""} onClick={() => { setAdminView("carousel"); setTopMenuOpen(false); }}>Editar carrusel</button>
              <button type="button" disabled>Reportes <small>Próximamente</small></button>
              <div className="admin-main-menu__separator" />
              <button
                type="button"
                className="admin-main-menu__logout"
                onClick={() => void handleAdminSignOut()}
              >
                <LogoutIcon />
                <span>Salir</span>
              </button>
            </nav>
          ) : null}
        </div>
        <button type="button" className="admin-topbar__center" onClick={() => setAdminView("orders")}>
          <img src="/joma-express-white.png" alt="JOMA Express" width="776" height="329" />
          <span>Admin</span>
        </button>
        <div className="admin-topbar__spacer" aria-hidden="true" />
      </div>

      <aside className="admin-sidebar" aria-label="Navegación del administrador">
        <button type="button" className="admin-sidebar__brand" onClick={() => setAdminView("orders")}>
          <span>JOMA</span>
          <small>Panel de tienda</small>
        </button>
        <nav className="admin-sidebar__nav">
          <button type="button" className={adminView === "customers" ? "is-active" : ""} onClick={() => setAdminView("customers")}><span aria-hidden="true">●</span><div><strong>Clientes</strong><small>Consumidores y comercios</small></div></button>
          <button type="button" className={adminView === "orders" ? "is-active" : ""} onClick={() => setAdminView("orders")}><span aria-hidden="true">▦</span><div><strong>Pedidos</strong><small>Gestión y estados</small></div></button>
          <button type="button" className={adminView === "users" ? "is-active" : ""} onClick={() => setAdminView("users")}><span aria-hidden="true">◎</span><div><strong>Usuarios</strong><small>Accesos internos</small></div></button>
          <button type="button" className={adminView === "notifications" ? "is-active" : ""} onClick={() => setAdminView("notifications")}><span aria-hidden="true">◉</span><div><strong>Notificaciones</strong><small>Campañas e historial</small></div></button>
          <button type="button" className={adminView === "configuration" ? "is-active" : ""} onClick={() => setAdminView("configuration")}><span aria-hidden="true">⚙</span><div><strong>Configuración</strong><small>Compra, entrega y destacados</small></div></button>
          <button type="button" className={adminView === "coupons" ? "is-active" : ""} onClick={() => setAdminView("coupons")}><span aria-hidden="true">◇</span><div><strong>Cupones</strong><small>Descuentos y destinatarios</small></div></button>
          <button type="button" className={adminView === "carousel" ? "is-active" : ""} onClick={() => setAdminView("carousel")}><span aria-hidden="true">▤</span><div><strong>Carrusel</strong><small>Imágenes destacadas</small></div></button>
          <button type="button" disabled><span aria-hidden="true">↗</span><div><strong>Reportes</strong><small>Próximamente</small></div></button>
        </nav>
        <div className="admin-sidebar__footer">
          <div><strong>{adminProfile.name}</strong><span>{user.email || "Administrador"}</span></div>
          <button type="button" onClick={() => void handleAdminSignOut()} aria-label="Cerrar sesión"><LogoutIcon /></button>
        </div>
      </aside>

      <div className="admin-content">
      {adminView === "customers" ? <AdminCustomersPanel /> : adminView === "users" ? <AdminUsersPanel /> : adminView === "notifications" && user ? <AdminNotificationsPanel user={user} /> : adminView === "configuration" && user ? <AdminStoreConfigPanel user={user} /> : adminView === "coupons" && user ? <AdminCouponsPanel user={user} /> : adminView === "carousel" && user ? <AdminCarouselPanel user={user} /> : <>
      <section className="admin-card admin-overview overflow-hidden">
        <div className="admin-card__head">
          <div className="admin-headline">
            <h1 className="admin-title">Todos los pedidos</h1>
          </div>
          <div className="text-sm font-semibold text-white/65">{loadingData ? "Sincronizando..." : "En vivo"}</div>
        </div>
        <div className="admin-card__body">
          <div className="grid gap-3 md:grid-cols-3">
            <DashboardMetric
              label="Total de pedidos"
              value={String(orders.length)}
              hint="Todos los pedidos disponibles."
            />
            <DashboardMetric
              label="Nuevos"
              value={String(todayOrders.filter((order) => order.status === "new").length)}
              hint="Pendientes de tomar."
            />
            <DashboardMetric
              label="A preparar"
              value={String(todayOrders.filter((order) => order.status === "new" || order.status === "preparing").length)}
              hint="Pedidos que todavía requieren acción."
            />
          </div>
        </div>
      </section>

      <section className="admin-card admin-workspace overflow-hidden">
        <div className="admin-card__head">
          <div>
            <h2 className="admin-section-title">Bandeja de pedidos</h2>
          </div>
          <div className="admin-filters">
            <input
              className="admin-input md:min-w-64"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar cliente, codigo o producto"
            />
            <select
              className="admin-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
            >
              <option value="all">Todos los estados</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="admin-input"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as "all" | "today" | "week")}
            >
              <option value="today">Hoy</option>
              <option value="week">Ultimos 7 dias</option>
              <option value="all">Todo el historial</option>
            </select>
          </div>
        </div>

        <div className="admin-card__body">
          <div className={`admin-orders-layout ${selectedOrder ? "has-open-detail" : ""}`}>
            <div className="admin-list-column">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={selectedOrder?.id === order.id ? "is-active" : ""}
                      onClick={() => setSelectedId(order.id)}
                    >
                      <td className="admin-order-row__date" data-label="Fecha">{formatDateTime(orderMoment(order))}</td>
                      <td className="admin-order-row__client" data-label="Cliente">{order.cliente.nombre || "Sin nombre"}</td>
                      <td className="admin-order-row__status" data-label="Estado">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="admin-order-row__total" data-label="Total">{formatMoney(order.totals.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredOrders.length ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-white/60 p-5 text-sm text-black/55">
                  No hay pedidos para los filtros actuales.
                </div>
              ) : null}
            </div>

            <section className="admin-list-stats" aria-label="Estadísticas de los pedidos filtrados">
              <div className="admin-list-stats__head">
                <div>
                  <h3>Resumen del listado</h3>
                  <p>Calculado con los filtros seleccionados.</p>
                </div>
              </div>
              <div className="admin-list-stats__grid">
                <div>
                  <span>Pedidos</span>
                  <strong>{filteredStats.orders}</strong>
                </div>
                <div>
                  <span>Facturación</span>
                  <strong>{formatMoney(filteredStats.total)}</strong>
                </div>
                <div>
                  <span>Ticket promedio</span>
                  <strong>{formatMoney(filteredStats.average)}</strong>
                </div>
                <div>
                  <span>Unidades</span>
                  <strong>{filteredStats.units}</strong>
                </div>
                <div>
                  <span>Cajas</span>
                  <strong>{filteredStats.boxes}</strong>
                </div>
                <div>
                  <span>Descuentos</span>
                  <strong>{formatMoney(filteredStats.discounts)}</strong>
                </div>
              </div>
            </section>
            </div>

            {selectedOrder ? (
            <>
              <button
                type="button"
                className="admin-detail-backdrop"
                aria-label="Cerrar detalle"
                onClick={() => setSelectedId(null)}
              />
            <div className="admin-detail-panel">
              <div className="admin-order-detail">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="admin-detail-label">Detalle del pedido</div>
                    <h3 className="text-xl font-semibold text-[#1d2538]">
                      {selectedOrder ? selectedOrder.cliente.nombre || "Pedido sin nombre" : "Selecciona un pedido"}
                    </h3>
                    <p className="mt-1 text-sm text-black/55">
                      {selectedOrder
                        ? `${selectedOrder.cliente.telefono || "Sin teléfono"} · ${selectedOrder.cliente.direccion || "Sin dirección"}`
                        : "El panel lateral muestra articulos, remito y acciones."}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#394761]">
                      {selectedOrder.cliente.preventistaReferido
                        ? `Preventista: ${selectedOrder.cliente.preventistaReferido}`
                        : "Venta orgánica"}
                    </p>
                  </div>
                  {selectedOrder ? (
                    <div className="admin-detail-head-actions">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(selectedOrder.status)}`}
                      >
                        {statusLabel(selectedOrder.status)}
                      </span>
                      <button
                        type="button"
                        className="admin-detail-close"
                        aria-label="Cerrar detalle"
                        onClick={() => setSelectedId(null)}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedOrder ? (
                  <>
                    {selectedOrder.delivery?.date && selectedOrder.delivery.timeRange ? (
                      <div className="admin-delivery-summary">
                        <span>Entrega solicitada</span>
                        <strong>
                          {selectedOrder.delivery.dateLabel || selectedOrder.delivery.date}
                          {" · "}
                          {selectedOrder.delivery.timeRange}
                        </strong>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={`${selectedOrder.id}-${item.codigo}`}
                          className="admin-detail-product"
                        >
                          <div className="admin-detail-product__name">
                            <strong>{item.nombre}</strong>
                            <span>{item.codigo}</span>
                          </div>
                          <div className="admin-detail-product__facts">
                            <div>
                              <span>Unidades</span>
                              <strong>{item.cantidadUnidades}</strong>
                            </div>
                            <div>
                              <span>Descuento</span>
                              <strong>{item.descuentoPct ? `${item.descuentoPct}%` : "0%"}</strong>
                            </div>
                            <div>
                              <span>Subtotal</span>
                              <strong>{formatMoney(item.subtotal)}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-black/65">Numero de remito</span>
                        <input
                          className="admin-input"
                          value={draft?.remito || ""}
                          onChange={(event) =>
                            setDispatchDrafts((prev) => ({
                              ...prev,
                              [selectedOrder.id]: {
                                remito: event.target.value,
                                note: prev[selectedOrder.id]?.note || "",
                              },
                            }))
                          }
                          placeholder={`REM-${selectedOrder.id.slice(0, 6).toUpperCase()}`}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-black/65">Observaciones</span>
                        <input
                          className="admin-input"
                          value={draft?.note || ""}
                          onChange={(event) =>
                            setDispatchDrafts((prev) => ({
                              ...prev,
                              [selectedOrder.id]: {
                                remito: prev[selectedOrder.id]?.remito || "",
                                note: event.target.value,
                              },
                            }))
                          }
                          placeholder="Preparado por mostrador, retirar 14hs..."
                        />
                      </label>
                    </div>

                    {selectedOrder.rejection?.reason ? (
                      <div className="admin-rejection-note">
                        <strong>Pedido rechazado</strong>
                        <span>{selectedOrder.rejection.reason}</span>
                        <small>{selectedOrder.inventory?.status === "restored" ? "Stock restituido correctamente" : "Revisar restitución de stock"}</small>
                      </div>
                    ) : null}

                    <div className="admin-primary-actions">
                      {selectedOrder.status === "rejected" ? (
                        <div className="admin-actions-closed">Pedido rechazado</div>
                      ) : selectedOrder.status === "dispatched" || selectedOrder.status === "delivered" ? (
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => void handleOpenRemito(selectedOrder)}
                          disabled={savingOrderId === selectedOrder.id}
                        >
                          Reimprimir remito
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => void handleStatusChange(selectedOrder, "dispatched")}
                          disabled={savingOrderId === selectedOrder.id}
                        >
                          {savingOrderId === selectedOrder.id && savingStatus === "dispatched" ? (
                            <span className="inline-flex items-center gap-2">
                              <ButtonSpinner />
                              Generando...
                            </span>
                          ) : (
                            "Remitar"
                          )}
                        </button>
                      )}
                      {selectedOrder.status !== "rejected" ? (
                        <button
                          type="button"
                          className="btn admin-danger"
                          onClick={() => {
                            setRejectingId(selectedOrder.id);
                            setRejectReason("");
                            setActionError("");
                          }}
                          disabled={savingOrderId === selectedOrder.id}
                        >
                          Rechazar
                        </button>
                      ) : null}
                      {selectedOrder.status !== "rejected" && selectedOrder.status !== "delivered" ? (
                        <button
                          type="button"
                          className="btn success"
                          onClick={() => void handleStatusChange(selectedOrder, "delivered")}
                          disabled={savingOrderId === selectedOrder.id}
                        >
                          {savingOrderId === selectedOrder.id && savingStatus === "delivered" ? "Guardando..." : "Pagado"}
                        </button>
                      ) : null}
                    </div>

                    {rejectingId === selectedOrder.id ? (
                      <div className="admin-reject-box" role="region" aria-label="Rechazar pedido">
                        <div>
                          <strong>Rechazar y devolver stock</strong>
                          <p>Indicá el motivo. Las unidades reservadas volverán al catálogo una sola vez.</p>
                        </div>
                        <textarea
                          className="admin-input"
                          rows={3}
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          placeholder="Ej: el cliente canceló el pedido"
                          autoFocus
                        />
                        {actionError ? <div className="admin-error">{actionError}</div> : null}
                        <div className="admin-reject-actions">
                          <button type="button" className="btn ghost" onClick={() => setRejectingId(null)}>
                            Mantener pedido
                          </button>
                          <button
                            type="button"
                            className="btn admin-danger"
                            onClick={() => void handleRejectOrder(selectedOrder)}
                            disabled={rejectReason.trim().length < 3 || savingOrderId === selectedOrder.id}
                          >
                            {savingOrderId === selectedOrder.id ? "Devolviendo stock..." : "Confirmar rechazo"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 rounded-[24px] border border-black/8 bg-[#f7f2eb] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#20283b]">Historial</div>
                        {selectedOrder.dispatch.remitoNumber ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#8b1e24] underline-offset-4 hover:underline"
                            onClick={() => void handleOpenRemito(selectedOrder)}
                          >
                            Abrir remito {selectedOrder.dispatch.remitoNumber}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-3">
                        {selectedOrder.history.slice().reverse().map((entry, index) => (
                          <div
                            key={`${entry.status}-${entry.atIso}-${index}`}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <div>
                              <div className="font-semibold text-[#20283b]">
                                {statusLabel(entry.status)}
                              </div>
                              <div className="text-black/55">{entry.note || "Sin nota operativa."}</div>
                              {entry.status === "dispatched" && selectedOrder.dispatch.remitoNumber ? (
                                <button
                                  type="button"
                                  className="mt-1 text-xs font-semibold text-[#8b1e24] underline-offset-4 hover:underline"
                                  onClick={() => void handleOpenRemito(selectedOrder)}
                                >
                                  Ver remito {selectedOrder.dispatch.remitoNumber}
                                </button>
                              ) : null}
                            </div>
                            <div className="text-right text-black/45">
                              <div>{entry.actor || "Sistema"}</div>
                              <div>{formatDateTime(entry.atIso)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="admin-card__head">
          <div>
            <div className="admin-kicker">Resumen</div>
            <h2 className="admin-section-title">Promedios y rendimiento</h2>
          </div>
        </div>
        <div className="admin-card__body">
          <div className="grid gap-3 md:grid-cols-4">
            <DashboardMetric
              label="Ticket promedio"
              value={formatMoney(metrics.ticketPromedio)}
              hint="Promedio sobre todos los pedidos cargados."
            />
            <DashboardMetric
              label="Facturacion"
              value={formatMoney(metrics.totalRevenue)}
              hint="Total acumulado del lote visible."
            />
            <DashboardMetric
              label="Despacho medio"
              value={metrics.averageDispatchMinutes ? `${Math.round(metrics.averageDispatchMinutes)} min` : "Sin datos"}
              hint="Tiempo promedio de nuevo a remitado."
            />
            <DashboardMetric
              label="Pedidos cargados"
              value={String(orders.length)}
              hint="Base usada para el resumen actual."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-white/60 bg-white/78 p-5 shadow-[0_14px_30px_rgba(30,41,59,0.10)]">
              <div className="admin-kicker">Mas vendidos</div>
              <div className="mt-3 space-y-3">
                {metrics.topProducts.map((product) => (
                  <div key={product.codigo} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-semibold text-[#20283b]">{product.nombre}</div>
                      <div className="text-black/48">
                        {product.codigo} · {product.unidades} unid. · {product.cajas} cajas
                      </div>
                    </div>
                    <div className="font-semibold text-[#20283b]">{formatMoney(product.total)}</div>
                  </div>
                ))}
                {!metrics.topProducts.length ? (
                  <div className="text-sm text-black/48">Todavia no hay ventas suficientes.</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/60 bg-white/78 p-5 shadow-[0_14px_30px_rgba(30,41,59,0.10)]">
              <div className="admin-kicker">Mas buscados</div>
              <div className="mt-3 space-y-3">
                {metrics.topSearches.map((entry) => (
                  <div key={entry.query} className="flex items-center justify-between gap-3 text-sm">
                    <div className="font-semibold text-[#20283b]">{entry.query}</div>
                    <div className="text-black/55">{entry.count} busquedas</div>
                  </div>
                ))}
                {!metrics.topSearches.length ? (
                  <div className="text-sm text-black/48">Aun no hay busquedas registradas.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      </>}
      </div>
    </main>
  );
}


