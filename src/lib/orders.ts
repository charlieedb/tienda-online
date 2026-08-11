"use client";

import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type OrderStatus = "new" | "preparing" | "dispatched" | "delivered" | "rejected";

export type OrderItem = {
  codigo: string;
  nombre: string;
  precioLista: number;
  descuentoPct: number;
  precioFinal: number;
  cantidadUnidades: number;
  cantidadCajas: number;
  subtotal: number;
  presentacion?: string;
  unidadesPorCaja?: number;
  promoCaja?: {
    unidadesConPromo: number;
    unidadesPrecioLista: number;
    precioUnitarioPromo: number;
    unidadesPorCaja: number;
  } | null;
  precioUnitarioBase?: number;
  variantLabel?: string;
};

export type OrderRecord = {
  id: string;
  pedido: {
    id: string;
    tienda: string;
    source: string;
    clientRequestId: string;
    createdAtIso: string;
  };
  cliente: {
    uid: string | null;
    email: string | null;
    nombre: string;
    telefono: string;
    direccion: string;
    nota: string;
    preventistaReferido: string;
  };
  delivery?: {
    date: string;
    dateLabel: string;
    timeRange: string;
    requestedAtIso?: string;
  };
  items: OrderItem[];
  totals: {
    distinct: number;
    totalQty: number;
    total: number;
    subtotal: number;
    discountTotal: number;
  };
  status: OrderStatus;
  dispatch: {
    remitoNumber: string | null;
    remitidoAtIso: string | null;
    observaciones: string;
  };
  metrics: {
    totalItems: number;
    totalUnits: number;
    totalBoxes: number;
    subtotal: number;
    discountTotal: number;
  };
  history: Array<{
    status: OrderStatus;
    atIso: string;
    actor: string;
    note: string;
  }>;
  audit: {
    createdAt?: Timestamp | null;
    createdAtIso: string;
    updatedAt?: Timestamp | null;
    updatedAtIso: string;
    createdBy: string;
    lastActionBy: string;
  };
  rejection?: {
    reason: string;
    rejectedAtIso: string;
    rejectedBy: string;
  };
  inventory?: {
    status: string;
    restoredAtIso?: string;
  };
  sheets?: {
    status?: string;
    message?: string;
  };
};

export type SearchEvent = {
  id: string;
  query: string;
  category: string;
  matchedCount: number;
  createdAtIso: string;
};

export type OrdersPage = {
  items: OrderRecord[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
};

export type MyOrdersPage = {
  items: OrderRecord[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
};

const PAGE_SIZE = 40;
const REALTIME_LIMIT = 80;
const MY_ORDERS_PAGE_SIZE = 12;
const MY_ORDERS_LOOKBACK_DAYS = 30;
const REJECT_ORDER_URL =
  "https://us-central1-app-presu.cloudfunctions.net/rejectTiendaOrder";

function statusHistoryLabel(status: OrderStatus) {
  switch (status) {
    case "preparing":
      return "Preparado";
    case "dispatched":
      return "Remitado";
    case "delivered":
      return "Cobrado";
    case "rejected":
      return "Rechazado";
    default:
      return "Nuevo";
  }
}

function asNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toStatus(value: unknown): OrderStatus {
  const raw = asString(value);
  if (raw === "preparing" || raw === "dispatched" || raw === "delivered" || raw === "rejected") return raw;
  return "new";
}

function mapOrder(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentData,
  id?: string,
): OrderRecord {
  const data = "data" in snap ? (snap.data() as DocumentData) : snap;
  const orderId = id || ("id" in snap ? snap.id : "");

  return {
    id: orderId,
    pedido: {
      id: asString(data?.pedido?.id) || orderId,
      tienda: asString(data?.pedido?.tienda) || "tiendaonline.html",
      source: asString(data?.pedido?.source) || "tiendaonline",
      clientRequestId: asString(data?.pedido?.clientRequestId) || orderId,
      createdAtIso: asString(data?.pedido?.createdAtIso) || asString(data?.audit?.createdAtIso),
    },
    cliente: {
      uid: asString(data?.cliente?.uid) || null,
      email: asString(data?.cliente?.email) || null,
      nombre: asString(data?.cliente?.nombre),
      telefono: asString(data?.cliente?.telefono),
      direccion: asString(data?.cliente?.direccion),
      nota: asString(data?.cliente?.nota),
      preventistaReferido: asString(data?.cliente?.preventistaReferido),
    },
    delivery: data?.delivery
      ? {
          date: asString(data.delivery.date),
          dateLabel: asString(data.delivery.dateLabel),
          timeRange: asString(data.delivery.timeRange) || asString(data.delivery.time),
          requestedAtIso: asString(data.delivery.requestedAtIso),
        }
      : undefined,
    items: Array.isArray(data?.items)
        ? data.items.map((item: DocumentData) => ({
          codigo: asString(item?.codigo),
          nombre: asString(item?.nombre),
          precioLista: asNumber(item?.precioLista),
          descuentoPct: asNumber(item?.descuentoPct),
          precioFinal: asNumber(item?.precioFinal),
          cantidadUnidades: asNumber(item?.cantidadUnidades),
          cantidadCajas: asNumber(item?.cantidadCajas),
          subtotal: asNumber(item?.subtotal),
          presentacion: asString(item?.presentacion),
          unidadesPorCaja: asNumber(item?.unidadesPorCaja),
          promoCaja: item?.promoCaja && typeof item.promoCaja === "object" ? {
            unidadesConPromo: asNumber(item.promoCaja.unidadesConPromo),
            unidadesPrecioLista: asNumber(item.promoCaja.unidadesPrecioLista),
            precioUnitarioPromo: asNumber(item.promoCaja.precioUnitarioPromo),
            unidadesPorCaja: asNumber(item.promoCaja.unidadesPorCaja),
          } : null,
          precioUnitarioBase: asNumber(item?.precioUnitarioBase),
          variantLabel: asString(item?.variantLabel),
        }))
      : [],
    totals: {
      distinct: asNumber(data?.totals?.distinct),
      totalQty: asNumber(data?.totals?.totalQty),
      total: asNumber(data?.totals?.total),
      subtotal: asNumber(data?.totals?.subtotal),
      discountTotal: asNumber(data?.totals?.discountTotal),
    },
    status: toStatus(data?.status),
    dispatch: {
      remitoNumber: asString(data?.dispatch?.remitoNumber) || null,
      remitidoAtIso: asString(data?.dispatch?.remitidoAtIso) || null,
      observaciones: asString(data?.dispatch?.observaciones),
    },
    metrics: {
      totalItems: asNumber(data?.metrics?.totalItems),
      totalUnits: asNumber(data?.metrics?.totalUnits),
      totalBoxes: asNumber(data?.metrics?.totalBoxes),
      subtotal: asNumber(data?.metrics?.subtotal),
      discountTotal: asNumber(data?.metrics?.discountTotal),
    },
    history: Array.isArray(data?.history)
      ? data.history.map((entry: DocumentData) => ({
          status: toStatus(entry?.status),
          atIso: asString(entry?.atIso),
          actor: asString(entry?.actor),
          note: asString(entry?.note),
        }))
      : [],
    audit: {
      createdAt: data?.audit?.createdAt instanceof Timestamp ? data.audit.createdAt : null,
      createdAtIso: asString(data?.audit?.createdAtIso) || asString(data?.pedido?.createdAtIso),
      updatedAt: data?.audit?.updatedAt instanceof Timestamp ? data.audit.updatedAt : null,
      updatedAtIso: asString(data?.audit?.updatedAtIso) || asString(data?.pedido?.createdAtIso),
      createdBy: asString(data?.audit?.createdBy),
      lastActionBy: asString(data?.audit?.lastActionBy),
    },
    rejection: data?.rejection ? {
      reason: asString(data.rejection.reason),
      rejectedAtIso: asString(data.rejection.rejectedAtIso),
      rejectedBy: asString(data.rejection.rejectedBy),
    } : undefined,
    inventory: data?.inventory ? {
      status: asString(data.inventory.status),
      restoredAtIso: asString(data.inventory.restoredAtIso),
    } : undefined,
    sheets: data?.sheets
      ? {
          status: asString(data?.sheets?.status),
          message: asString(data?.sheets?.message),
        }
      : undefined,
  };
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function orderMoment(order: OrderRecord) {
  return order.audit.createdAtIso || order.pedido.createdAtIso || "";
}

export async function fetchOrdersPage(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<OrdersPage> {
  const db = getDb();
  if (!db) return { items: [], cursor: null };

  const base = query(
    collection(db, "orders"),
    orderBy("audit.createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(PAGE_SIZE),
  );

  const snap = await getDocs(base);
  return {
    items: snap.docs.map((docSnap) => mapOrder(docSnap)),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function fetchRecentSearchEvents(limitCount = 120): Promise<SearchEvent[]> {
  const db = getDb();
  if (!db) return [];

  const snap = await getDocs(
    query(collection(db, "searchEvents"), orderBy("createdAt", "desc"), limit(limitCount)),
  );

  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      query: asString(data?.query),
      category: asString(data?.category),
      matchedCount: asNumber(data?.matchedCount),
      createdAtIso: asString(data?.createdAtIso),
    };
  });
}

export async function fetchMyOrdersPage(params: {
  uid: string;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  limitCount?: number;
  lookbackDays?: number;
}): Promise<MyOrdersPage> {
  const db = getDb();
  if (!db) return { items: [], cursor: null };

  const uid = asString(params.uid);
  if (!uid) return { items: [], cursor: null };

  const limitCount = Math.max(1, Math.min(30, Math.trunc(params.limitCount || MY_ORDERS_PAGE_SIZE)));
  const lookbackDays = Math.max(1, Math.min(365, Math.trunc(params.lookbackDays || MY_ORDERS_LOOKBACK_DAYS)));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const base = query(
    collection(db, "orders"),
    where("cliente.uid", "==", uid),
    where("audit.createdAt", ">=", Timestamp.fromDate(since)),
    orderBy("audit.createdAt", "desc"),
    ...(params.cursor ? [startAfter(params.cursor)] : []),
    limit(limitCount),
  );

  const snap = await getDocs(base);
  return {
    items: snap.docs.map((docSnap) => mapOrder(docSnap)),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

export function subscribeOrdersRealtime(
  onItems: (items: OrderRecord[]) => void,
  onError?: () => void,
) {
  const db = getDb();
  if (!db) {
    onItems([]);
    return () => {};
  }

  const liveQuery = query(
    collection(db, "orders"),
    orderBy("audit.createdAt", "desc"),
    limit(REALTIME_LIMIT),
  );

  return onSnapshot(
    liveQuery,
    (snap) => {
      onItems(snap.docs.map((docSnap) => mapOrder(docSnap)));
    },
    () => {
      onError?.();
    },
  );
}

export async function updateOrderWorkflow(params: {
  orderId: string;
  status: OrderStatus;
  actor: string;
  remitoNumber?: string;
  observaciones?: string;
}) {
  const db = getDb();
  if (!db) throw new Error("Firebase no esta configurado.");

  const nowIso = new Date().toISOString();
  const noteParts = [
    params.remitoNumber ? `Remito ${params.remitoNumber}` : "",
    params.observaciones || "",
  ].filter(Boolean);

  await updateDoc(doc(db, "orders", params.orderId), {
    status: params.status,
    "dispatch.remitoNumber": params.remitoNumber || null,
    "dispatch.observaciones": params.observaciones || "",
    "dispatch.remitidoAtIso": params.status === "dispatched" ? nowIso : null,
    "audit.updatedAt": Timestamp.now(),
    "audit.updatedAtIso": nowIso,
    "audit.lastActionBy": params.actor,
    history: arrayUnion({
      status: params.status,
      atIso: nowIso,
      actor: params.actor,
      note: noteParts.join(" · ") || `Estado cambiado a ${statusHistoryLabel(params.status)}.`,
    }),
  });
}

export async function rejectOrderAndRestoreStock(params: {
  orderId: string;
  reason: string;
  token: string;
}) {
  const response = await fetch(REJECT_ORDER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: params.orderId,
      reason: params.reason.trim(),
    }),
  });
  const data = await response.json().catch(() => null) as {
    ok?: boolean;
    alreadyRestored?: boolean;
    error?: string;
  } | null;
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || "No se pudo rechazar el pedido.");
  }
  return data;
}

export function buildMetrics(orders: OrderRecord[], searches: SearchEvent[]) {
  const activeOrders = orders.filter((order) => order.status !== "rejected");
  const totalRevenue = activeOrders.reduce((acc, order) => acc + order.totals.total, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const pedidosHoy = orders.filter((order) => orderMoment(order).slice(0, 10) === todayKey).length;

  const topProductsMap = new Map<
    string,
    { nombre: string; unidades: number; cajas: number; total: number; pedidos: number }
  >();
  for (const order of activeOrders) {
    for (const item of order.items) {
      const key = item.codigo || item.nombre;
      const current = topProductsMap.get(key) || {
        nombre: item.nombre,
        unidades: 0,
        cajas: 0,
        total: 0,
        pedidos: 0,
      };
      current.unidades += item.cantidadUnidades;
      current.cajas += item.cantidadCajas;
      current.total += item.subtotal;
      current.pedidos += 1;
      topProductsMap.set(key, current);
    }
  }

  const topSearchesMap = new Map<string, number>();
  for (const search of searches) {
    const key = search.query || "(sin termino)";
    topSearchesMap.set(key, (topSearchesMap.get(key) || 0) + 1);
  }

  const statusDurations: number[] = [];
  for (const order of orders) {
    const created = order.history.find((entry) => entry.status === "new")?.atIso || orderMoment(order);
    const dispatched =
      order.history.find((entry) => entry.status === "dispatched")?.atIso ||
      order.dispatch.remitidoAtIso;
    if (!created || !dispatched) continue;
    const diff = new Date(dispatched).getTime() - new Date(created).getTime();
    if (diff > 0) statusDurations.push(diff / 60000);
  }

  return {
    pedidosHoy,
    ticketPromedio: activeOrders.length ? totalRevenue / activeOrders.length : 0,
    totalRevenue,
    averageDispatchMinutes: statusDurations.length
      ? statusDurations.reduce((acc, value) => acc + value, 0) / statusDurations.length
      : 0,
    topProducts: Array.from(topProductsMap.entries())
      .map(([codigo, value]) => ({ codigo, ...value }))
      .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
      .slice(0, 5),
    topSearches: Array.from(topSearchesMap.entries())
      .map(([queryValue, count]) => ({ query: queryValue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
