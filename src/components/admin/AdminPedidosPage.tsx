"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getAdminProfile, type AdminProfile } from "@/lib/adminAuth";
import {
  buildMetrics,
  fetchRecentSearchEvents,
  formatMoney,
  orderMoment,
  subscribeOrdersRealtime,
  updateOrderWorkflow,
  type OrderStatus,
  type OrderRecord,
  type SearchEvent,
} from "@/lib/orders";

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "new", label: "Nuevo" },
  { value: "preparing", label: "En preparacion" },
  { value: "dispatched", label: "Remitado" },
  { value: "delivered", label: "Entregado" },
];

function statusPill(status: OrderStatus) {
  switch (status) {
    case "preparing":
      return "bg-[#fff3c9] text-[#7a4b00] border-[#f6d97a]";
    case "dispatched":
      return "bg-[#dff6eb] text-[#0f5c3a] border-[#87d3af]";
    case "delivered":
      return "bg-[#dce9ff] text-[#1a438f] border-[#96b6f7]";
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

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
      <path d="M4.75 20.25a7.75 7.75 0 0 1 14.5 0" />
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

export function AdminPedidosPage() {
  const { user, loading, signInEmail, signOut } = useAuth();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [searches, setSearches] = useState<SearchEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("today");
  const [searchText, setSearchText] = useState("");
  const deferredSearch = useDeferredValue(searchText);
  const [dispatchDrafts, setDispatchDrafts] = useState<Record<string, { remito: string; note: string }>>({});
  const [todayKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekStartMs] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!user) {
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
  }, [user]);

  useEffect(() => {
    if (!adminProfile) return;

    let cancelled = false;
    setLoadingData(true);
    const unsub = subscribeOrdersRealtime(
      (items) => {
        if (cancelled) return;
        startTransition(() => {
          setOrders(items);
          setSelectedId((current) => current || items[0]?.id || null);
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
      } catch {}
    };
  }, [adminProfile]);

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
    () => filteredOrders.find((order) => order.id === selectedId) || filteredOrders[0] || null,
    [filteredOrders, selectedId],
  );

  const metrics = useMemo(() => buildMetrics(orders, searches), [orders, searches]);

  const draft = selectedOrder
    ? dispatchDrafts[selectedOrder.id] || {
        remito: selectedOrder.dispatch.remitoNumber || "",
        note: selectedOrder.dispatch.observaciones || "",
      }
    : null;

  async function handleLogin() {
    setAuthError("");
    try {
      await signInEmail(loginForm.email.trim(), loginForm.password);
    } catch (error) {
      setAuthError(String((error as Error)?.message || error || "No se pudo iniciar sesion."));
    }
  }

  async function handleStatusChange(order: OrderRecord, status: OrderStatus) {
    if (!user) return;
    const draftValue = dispatchDrafts[order.id] || { remito: "", note: "" };
    const nowIso = new Date().toISOString();
    setSavingOrderId(order.id);
    try {
      await updateOrderWorkflow({
        orderId: order.id,
        status,
        actor: user.email || user.uid,
        remitoNumber: draftValue.remito,
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
                    remitoNumber: draftValue.remito || null,
                    observaciones: draftValue.note,
                    remitidoAtIso: status === "dispatched" ? nowIso : entry.dispatch.remitidoAtIso,
                  },
                  audit: {
                    ...entry.audit,
                    updatedAtIso: nowIso,
                    lastActionBy: user.email || user.uid,
                  },
                  history: entry.history.concat({
                    status,
                    atIso: nowIso,
                    actor: user.email || user.uid,
                    note:
                      [draftValue.remito ? `Remito ${draftValue.remito}` : "", draftValue.note]
                        .filter(Boolean)
                        .join(" · ") || `Estado cambiado a ${status}.`,
                  }),
                },
          ),
        );
      });
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

  if (!user) {
    return (
      <main className="admin-shell">
        <section className="admin-card mx-auto max-w-xl overflow-hidden">
          <div className="admin-card__head">
            <div>
              <div className="admin-kicker">Panel privado</div>
              <h1 className="admin-title">Centro de control de pedidos</h1>
              <p className="admin-subtitle">
                Solo admins habilitados por email y contrasena. No hay registro publico.
              </p>
            </div>
          </div>
          <div className="admin-card__body space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-black/65">Email</span>
                <input
                  className="admin-input"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="admin@tuempresa.com"
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
              <button type="button" className="btn primary min-w-40" onClick={() => void handleLogin()}>
                Ingresar
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!adminProfile) {
    return (
      <main className="admin-shell">
        <section className="admin-card mx-auto max-w-xl overflow-hidden">
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
            <button type="button" className="btn ghost" onClick={() => void signOut()}>
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
        <button type="button" className="admin-topbar__icon" aria-label="Perfil">
          <ProfileIcon />
        </button>
        <div className="admin-topbar__center">
          <div className="admin-kicker admin-kicker--light">Admin pedidos</div>
          <div className="admin-topbar__title">Centro de control</div>
        </div>
        <button type="button" className="admin-topbar__icon" aria-label="Salir" onClick={() => void signOut()}>
          <LogoutIcon />
        </button>
      </div>

      <section className="admin-card overflow-hidden">
        <div className="admin-card__head">
          <div className="admin-headline">
            <h1 className="admin-title">Pedidos del dia</h1>
          </div>
          <div className="text-sm font-semibold text-white/65">{loadingData ? "Sincronizando..." : "En vivo"}</div>
        </div>
        <div className="admin-card__body">
          <div className="grid gap-3 md:grid-cols-3">
            <DashboardMetric
              label="Pedidos hoy"
              value={String(todayOrders.length)}
              hint="Confirmados durante la jornada actual."
            />
            <DashboardMetric
              label="Nuevos"
              value={String(todayOrders.filter((order) => order.status === "new").length)}
              hint="Pendientes de tomar."
            />
            <DashboardMetric
              label="Remitados hoy"
              value={String(todayOrders.filter((order) => order.status === "dispatched").length)}
              hint="Listos para salir o ya despachados."
            />
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="admin-card__head">
          <div>
            <div className="admin-kicker">Pedidos</div>
            <h2 className="admin-section-title">Listado operativo</h2>
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
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Telefono</th>
                    <th>Direccion</th>
                    <th>Fecha</th>
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
                      <td>
                        <div className="font-semibold text-[#20283b]">#{order.id.slice(0, 8)}</div>
                        <div className="text-xs text-black/45">{order.items.length} items</div>
                      </td>
                      <td>{order.cliente.nombre || "Sin nombre"}</td>
                      <td>{order.cliente.telefono || "Sin telefono"}</td>
                      <td>{order.cliente.direccion || "Sin direccion"}</td>
                      <td>{formatDateTime(orderMoment(order))}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(order.status)}`}
                        >
                          {STATUS_OPTIONS.find((option) => option.value === order.status)?.label || order.status}
                        </span>
                      </td>
                      <td>{formatMoney(order.totals.total)}</td>
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

            <div className="space-y-4">
              <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_18px_42px_rgba(30,41,59,0.12)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="admin-kicker">Detalle</div>
                    <h3 className="text-xl font-semibold text-[#1d2538]">
                      {selectedOrder ? selectedOrder.cliente.nombre || "Pedido sin nombre" : "Selecciona un pedido"}
                    </h3>
                    <p className="mt-1 text-sm text-black/55">
                      {selectedOrder
                        ? `${selectedOrder.cliente.telefono || "Sin telefono"} · ${selectedOrder.cliente.direccion || "Sin direccion"}`
                        : "El panel lateral muestra articulos, remito y acciones."}
                    </p>
                  </div>
                  {selectedOrder ? (
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(selectedOrder.status)}`}
                    >
                      {STATUS_OPTIONS.find((option) => option.value === selectedOrder.status)?.label || selectedOrder.status}
                    </span>
                  ) : null}
                </div>

                {selectedOrder ? (
                  <>
                    <div className="mt-4 space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={`${selectedOrder.id}-${item.codigo}`}
                          className="rounded-[22px] border border-black/8 bg-[#fffdf8] px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[#20283b]">{item.nombre}</div>
                              <div className="text-xs uppercase tracking-[0.18em] text-black/40">{item.codigo}</div>
                            </div>
                            <div className="text-right text-sm font-semibold text-[#20283b]">
                              {formatMoney(item.subtotal)}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-sm text-black/58 md:grid-cols-2">
                            <div>Lista: {formatMoney(item.precioLista)}</div>
                            <div>Final: {formatMoney(item.precioFinal)}</div>
                            <div>Desc.: {item.descuentoPct ? `${item.descuentoPct}%` : "Sin descuento"}</div>
                            <div>
                              Unid.: {item.cantidadUnidades} · Cajas: {item.cantidadCajas}
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

                    <div className="mt-4 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`btn ${option.value === "delivered" ? "success" : option.value === "new" ? "ghost" : "primary"}`}
                          onClick={() => void handleStatusChange(selectedOrder, option.value)}
                          disabled={savingOrderId === selectedOrder.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 rounded-[24px] border border-black/8 bg-[#f7f2eb] p-4">
                      <div className="text-sm font-semibold text-[#20283b]">Historial</div>
                      <div className="mt-3 space-y-3">
                        {selectedOrder.history.slice().reverse().map((entry, index) => (
                          <div
                            key={`${entry.status}-${entry.atIso}-${index}`}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <div>
                              <div className="font-semibold text-[#20283b]">
                                {STATUS_OPTIONS.find((option) => option.value === entry.status)?.label || entry.status}
                              </div>
                              <div className="text-black/55">{entry.note || "Sin nota operativa."}</div>
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
    </main>
  );
}
