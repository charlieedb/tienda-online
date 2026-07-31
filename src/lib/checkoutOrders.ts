"use client";

import type { User } from "firebase/auth";
import type { CartItem } from "@/store/cart";
import type { Product } from "@/catalog/types";
import type { TelegramOrderPayload } from "@/lib/telegramOrders";
import type { DeliverySelection } from "@/lib/deliverySchedule";

type CheckoutCustomer = {
  nombre: string;
  telefono: string;
  direccion: string;
  nota?: string;
  ubicacion?: { lat: number; lng: number } | null;
};

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function asActor(user: User | null, customer: CheckoutCustomer) {
  return user?.email || user?.uid || customer.nombre || "checkout";
}

const CONFIRM_INVENTORY_URL =
  "https://us-central1-app-presu.cloudfunctions.net/confirmTiendaOrder";

async function createOrderAndReserveInventory(user: User, orderId: string, order: object) {
  const token = await user.getIdToken();
  const response = await fetch(CONFIRM_INVENTORY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, order }),
  });
  const data = await response.json().catch(() => null) as {
    ok?: boolean;
    error?: string;
    stockCode?: string | null;
    available?: number | null;
  } | null;
  if (response.ok && data?.ok === true) return;
  if (response.status === 409) {
    const detail = data?.stockCode
      ? `El artículo ${data.stockCode} ya no tiene stock suficiente${Number.isFinite(data.available) ? ` (quedan ${data.available})` : ""}.`
      : data?.error || "Uno de los artículos ya no tiene stock suficiente.";
    throw new Error(`${detail} Actualizá el carrito e intentá nuevamente.`);
  }
  throw new Error("No pudimos registrar el pedido y reservar el stock. Intentá nuevamente.");
}

export async function submitCheckoutOrder(params: {
  user: User | null;
  customer: CheckoutCustomer;
  cartItems: CartItem[];
  productsById: Map<string, Product>;
  requestId: string;
  delivery: DeliverySelection;
  onProgress?: (progress: number, label: string) => void;
}) {
  if (!params.user) throw new Error("Necesitás iniciar sesión para confirmar la compra.");

  const nowIso = new Date().toISOString();
  const orderId = params.requestId;
  const actor = asActor(params.user, params.customer);

  const items = params.cartItems.map((item) => {
    const product = params.productsById.get(item.productId);
    const unitPrice = Number(product?.unit?.price || item.unitPriceFinal || (item.variant === "unit" ? item.price : 0) || 0);
    const packPrice = Number(product?.pack?.price || (item.variant === "pack" ? item.price : 0) || 0);
    const unidadesPorCaja = Number(product?.pack?.qty || item.unitsPerPack || 0);
    const descuentoPct = Number(item.discountPct || (product?.offer ? product.offerDiscount : 0) || 0);
    const qty = Number(item.qty || 0);
    const cantidadCajas = item.variant === "pack" ? qty : 0;
    const cantidadUnidades =
      item.variant === "pack"
        ? qty * Math.max(1, unidadesPorCaja || 1)
        : qty;
    const precioListaCaja = Number(item.listPrice || (item.variant === "pack" ? packPrice : unitPrice) || item.price);
    const precioFinalCaja = Number(item.price || 0);
    const divisor = item.variant === "pack" ? Math.max(1, unidadesPorCaja || 1) : 1;
    const precioLista = roundMoney(precioListaCaja / divisor);
    const precioFinal = roundMoney(precioFinalCaja / divisor);
    const subtotal = roundMoney(precioFinal * cantidadUnidades);

    return {
      codigo: String(product?.id || item.productId || "").trim(),
      nombre: String(product?.name || item.name || "").trim(),
      precioLista,
      descuentoPct,
      precioFinal,
      cantidadUnidades,
      cantidadCajas,
      subtotal,
      presentacion:
        item.variant === "pack"
          ? String(product?.pack?.label || `Caja x${unidadesPorCaja || 1}`).trim()
          : String(product?.unit?.label || "Unidad").trim(),
      unidadesPorCaja: item.variant === "pack" ? unidadesPorCaja || 0 : 0,
      precioUnitarioBase: roundMoney(unitPrice || precioLista || precioFinal),
      variantLabel: item.variant === "pack" ? "Caja" : "Unidad",
    };
  });

  const metrics = items.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalUnits += item.cantidadUnidades;
      acc.totalBoxes += item.cantidadCajas;
      acc.subtotal = roundMoney(acc.subtotal + item.subtotal);
      const qtyBase = Math.max(1, item.cantidadUnidades || 0);
      const discount = (item.precioLista - item.precioFinal) * qtyBase;
      acc.discountTotal = roundMoney(acc.discountTotal + Math.max(0, discount));
      return acc;
    },
    { totalItems: 0, totalUnits: 0, totalBoxes: 0, subtotal: 0, discountTotal: 0 },
  );

  const payload = {
    pedido: {
      id: orderId,
      tienda: "tienda-online-next",
      source: "tienda-online-next",
      clientRequestId: orderId,
      createdAtIso: nowIso,
    },
    cliente: {
      uid: params.user?.uid || null,
      email: params.user?.email || null,
      nombre: params.customer.nombre.trim(),
      telefono: params.customer.telefono.trim(),
      direccion: params.customer.direccion.trim(),
      nota: String(params.customer.nota || "").trim(),
      ubicacion: params.customer.ubicacion ?? null,
    },
    delivery: {
      date: params.delivery.date,
      dateLabel: params.delivery.dateLabel,
      timeRange: params.delivery.timeRange,
      requestedAtIso: nowIso,
    },
    items,
    totals: {
      distinct: items.length,
      totalQty: metrics.totalUnits + metrics.totalBoxes,
      total: metrics.subtotal,
      subtotal: metrics.subtotal,
      discountTotal: metrics.discountTotal,
    },
    status: "new",
    dispatch: {
      remitoNumber: null,
      remitidoAtIso: null,
      observaciones: "",
    },
    metrics,
    history: [
      {
        status: "new",
        atIso: nowIso,
        actor,
        note: "Pedido confirmado desde Tienda Online.",
      },
    ],
    audit: {
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      createdBy: actor,
      lastActionBy: actor,
    },
    sheets: {
      status: "skipped",
      message: "Google Sheets desactivado en esta versión.",
    },
  };

  params.onProgress?.(35, "Registrando pedido y reservando stock");
  await createOrderAndReserveInventory(params.user, orderId, payload);
  params.onProgress?.(78, "Stock reservado");

  const telegramPayload: TelegramOrderPayload = {
    pedido: {
      id: orderId,
      createdAtIso: nowIso,
      source: "tienda-online-next",
    },
    cliente: {
      nombre: payload.cliente.nombre,
      telefono: payload.cliente.telefono,
      direccion: payload.cliente.direccion,
      nota: payload.cliente.nota,
      ubicacion: payload.cliente.ubicacion,
    },
    delivery: {
      date: payload.delivery.date,
      dateLabel: payload.delivery.dateLabel,
      timeRange: payload.delivery.timeRange,
    },
    items: items.map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      descuentoPct: item.descuentoPct,
      cantidadUnidades: item.cantidadUnidades,
      cantidadCajas: item.cantidadCajas,
      unidadesPorCaja: item.unidadesPorCaja,
    })),
    totals: {
      distinct: payload.totals.distinct,
      totalQty: payload.totals.totalQty,
      total: payload.totals.total,
      subtotal: payload.totals.subtotal,
      discountTotal: payload.totals.discountTotal,
    },
  };

  return { id: orderId, telegramPayload };
}
