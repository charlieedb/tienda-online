"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { MotionButton } from "@/components/MotionButton";
import { fetchMyOrdersPage, formatMoney, type OrderRecord } from "@/lib/orders";

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span aria-hidden="true" className={`app-spinner ${className}`} />;
}

function formatDate(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: OrderRecord["status"]) {
  switch (status) {
    case "preparing":
      return "Preparando";
    case "dispatched":
      return "Enviado";
    case "delivered":
      return "Entregado";
    default:
      return "Nuevo";
  }
}

export function MyOrdersPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async (mode: "initial" | "refresh" | "more") => {
    if (!user?.uid) return;
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode === "more") setLoadingMore(true);
    if (mode !== "more") setError(null);

    try {
      const page = await fetchMyOrdersPage({
        uid: user.uid,
        cursor: mode === "more" ? cursor : null,
      });
      setOrders((prev) => (mode === "more" ? [...prev, ...page.items] : page.items));
      setCursor(page.cursor);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "No se pudo cargar tu historial.");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
      if (mode === "more") setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!user) {
      onBack();
      return;
    }
    void loadOrders("initial");
  }, [user]);

  const totalOrders = useMemo(() => orders.length, [orders]);

  return (
    <motion.section
      className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-8 pt-16 md:px-6 md:pt-[4.5rem]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="app-panel rounded-[28px] p-4 backdrop-blur-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand/75">
                Pedidos
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Historial de pedidos
              </h1>
              <p className="mt-1 text-sm text-foreground/65">
                Vemos tus pedidos de los últimos 30 días, ordenados del más nuevo al más viejo.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <MotionButton type="button" tone="ghost" className="h-11" onClick={onBack}>
                Volver a la listita
              </MotionButton>
              <MotionButton
                type="button"
                tone="ghost"
                className="h-11"
                onClick={() => void loadOrders("refresh")}
                disabled={refreshing || loading}
              >
                {refreshing ? <Spinner /> : null}
                {refreshing ? "Actualizando..." : "Actualizar"}
              </MotionButton>
            </div>
          </div>
        </div>

        <div className="app-panel rounded-[28px] p-4 backdrop-blur-sm md:p-5">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/82 p-4 text-sm text-foreground/70">
              <div className="flex items-center gap-2 font-semibold">
                <Spinner />
                <span>Cargando tus pedidos...</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-[rgba(29,53,87,0.08)] bg-[#F3F6F9] px-4 py-3">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-foreground/55">
                  Resumen
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {totalOrders === 1 ? "1 pedido cargado" : `${totalOrders} pedidos cargados`}
                </div>
              </div>

              {error ? (
                <div className="app-error rounded-2xl p-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}

              {!error && !orders.length ? (
                <div className="rounded-3xl border border-dashed border-border bg-white/82 p-5 text-sm font-semibold text-foreground/65">
                  Todavía no encontramos pedidos tuyos en los últimos 30 días.
                </div>
              ) : null}

              {orders.length ? (
                <div className="flex flex-col gap-3">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-3xl border border-[rgba(29,53,87,0.08)] bg-[#F3F6F9] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/45">
                            Pedido #{order.pedido.id.slice(0, 8)}
                          </div>
                          <h2 className="mt-1 text-base font-black text-foreground">
                            {statusLabel(order.status)}
                          </h2>
                          <p className="mt-1 text-sm text-foreground/65">
                            {formatDate(order.audit.createdAtIso || order.pedido.createdAtIso)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[rgba(29,53,87,0.08)] bg-white px-3 py-2 text-right">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/45">
                            Total
                          </div>
                          <div className="mt-1 text-base font-black text-foreground">
                            {formatMoney(order.totals.total)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[rgba(29,53,87,0.06)] bg-white/88 p-3">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-foreground/45">
                            Entrega
                          </div>
                          <div className="mt-2 text-sm font-semibold text-foreground">
                            {order.cliente.direccion || "Sin dirección"}
                          </div>
                          <div className="mt-1 text-xs text-foreground/65">
                            {order.cliente.telefono || "Sin teléfono"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[rgba(29,53,87,0.06)] bg-white/88 p-3">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-foreground/45">
                            Items
                          </div>
                          <div className="mt-2 text-sm font-semibold text-foreground">
                            {order.items.length} productos · {order.totals.totalQty} unidades
                          </div>
                          <div className="mt-1 text-xs text-foreground/65">
                            {order.items
                              .slice(0, 3)
                              .map((item) => item.nombre)
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </div>

                      {order.cliente.nota ? (
                        <div className="mt-3 rounded-2xl border border-[rgba(29,53,87,0.06)] bg-white/88 p-3 text-sm text-foreground/70">
                          <span className="font-black text-foreground/60">Nota:</span> {order.cliente.nota}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {cursor ? (
                <div className="flex justify-center pt-2">
                  <MotionButton
                    type="button"
                    tone="ghost"
                    className="h-11 min-w-44"
                    onClick={() => void loadOrders("more")}
                    disabled={loadingMore}
                  >
                    {loadingMore ? <Spinner /> : null}
                    {loadingMore ? "Cargando..." : "Ver más"}
                  </MotionButton>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

