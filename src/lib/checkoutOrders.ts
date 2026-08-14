"use client";

import type { User } from "firebase/auth";
import { getCartPricingMap, type CartItem, useCartStore } from "@/store/cart";
import type { Product } from "@/lib/products";
import type { TelegramOrderPayload } from "@/lib/telegramOrders";
import type { DeliverySelection } from "@/lib/deliverySchedule";
import { calculateDiscount, type AppliedDiscountCode } from "@/lib/discountCodes";
import { clearDailyOfferUsageCache, getDailyOfferUsage } from "@/lib/offerUsage";
import type { CheckoutSettingsConfig } from "@/lib/featuredProducts";

type CheckoutCustomer = {
  nombre: string;
  telefono: string;
  direccion: string;
  nota?: string;
  preventistaReferido?: string;
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
  if ((response.status === 400 || response.status === 422) && data?.error) {
    throw new Error(data.error);
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
  paymentMethod?: "cash" | "transfer";
  checkoutSettings?: CheckoutSettingsConfig;
  discountCode?: AppliedDiscountCode | null;
  onProgress?: (progress: number, label: string) => void;
}) {
  if (!params.user) throw new Error("Necesitás iniciar sesión para confirmar la compra.");

  const nowIso = new Date().toISOString();
  const orderId = params.requestId;
  const actor = asActor(params.user, params.customer);
  const dailyUsage = await getDailyOfferUsage(params.user.uid, true);
  const effectiveCartItems = params.cartItems.map((item) => ({
    ...item,
    offerUsedUnits: Math.max(0, Math.trunc(Number(dailyUsage[item.productId] ?? dailyUsage[item.productId.toUpperCase()]) || 0)),
  }));
  const effectiveDiscountCode = params.discountCode
    ? calculateDiscount(params.discountCode, effectiveCartItems, params.productsById)
    : null;
  const pricingByItem = getCartPricingMap(effectiveCartItems);

  const items = effectiveCartItems.flatMap((item) => {
    const product = params.productsById.get(item.productId);
    const unitPrice = Number(product?.unit?.price || item.unitPriceFinal || (item.variant === "unit" ? item.price : 0) || 0);
    const packPrice = Number(product?.pack?.price || (item.variant === "pack" ? item.price : 0) || 0);
    const unidadesPorCaja = Number(product?.pack?.qty || item.unitsPerPack || 0);
    const descuentoPct = Number(item.discountPct || (product?.offer ? product.offerDiscount : 0) || 0);
    const precioListaCaja = Number(item.listPrice || (item.variant === "pack" ? packPrice : unitPrice) || item.price);
    const divisor = item.variant === "pack" ? Math.max(1, unidadesPorCaja || 1) : 1;
    const precioLista = roundMoney(precioListaCaja / divisor);
    const mixedPricing = pricingByItem.get(item.id)!;
    const couponEligibleSubtotal = Math.min(mixedPricing.regularSubtotal, Math.max(0, Number(effectiveDiscountCode?.eligibleSubtotalByItem?.[item.id]) || 0));
    const couponPercentage = couponEligibleSubtotal > 0 ? Number(effectiveDiscountCode?.percentage || 0) : 0;
    const couponDiscountAmount = roundMoney(couponEligibleSubtotal * couponPercentage / 100);
    const base = {
      codigo: String(product?.id || item.productId || "").trim(),
      nombre: String(product?.name || item.name || "").trim(),
      precioLista,
      unidadesPorCaja: unidadesPorCaja || Number(item.promoPackQty || 0) || 0,
      precioUnitarioBase: precioLista,
      variantLabel: item.variant === "pack" ? "Caja" : "Unidad",
    };
    const lines = [];
    if (mixedPricing.promoUnits > 0) {
      const promoUnitPrice = roundMoney(mixedPricing.promoSubtotal / mixedPricing.promoUnits);
      const productDiscount = precioLista > 0 ? Math.max(0, roundMoney((1 - promoUnitPrice / precioLista) * 100)) : descuentoPct;
      lines.push({
        ...base,
        descuentoPct: productDiscount,
        descuentoProductoPct: productDiscount,
        descuentoCodigoPct: 0,
        descuentoCodigoMonto: 0,
        precioFinal: promoUnitPrice,
        cantidadUnidades: mixedPricing.promoUnits,
        cantidadCajas: item.variant === "pack" ? mixedPricing.promoUnits / Math.max(1, unidadesPorCaja) : 0,
        subtotal: roundMoney(mixedPricing.promoSubtotal),
        presentacion: `${item.variant === "pack" ? product?.pack?.label || item.label : product?.unit?.label || item.label} · Con oferta`,
        pricingGroup: "offer" as const,
        promoCaja: {
          unidadesConPromo: mixedPricing.promoUnits,
          unidadesPrecioLista: 0,
          precioUnitarioPromo: promoUnitPrice,
          unidadesPorCaja: unidadesPorCaja || Number(item.promoPackQty || 1),
        },
      });
    }
    if (mixedPricing.regularUnits > 0) {
      const regularSubtotal = roundMoney(mixedPricing.regularSubtotal - couponDiscountAmount);
      const regularUnitPrice = roundMoney(regularSubtotal / mixedPricing.regularUnits);
      lines.push({
        ...base,
        descuentoPct: couponPercentage,
        descuentoProductoPct: 0,
        descuentoCodigoPct: couponPercentage,
        descuentoCodigoMonto: couponDiscountAmount,
        precioFinal: regularUnitPrice,
        cantidadUnidades: mixedPricing.regularUnits,
        cantidadCajas: item.variant === "pack" ? mixedPricing.regularUnits / Math.max(1, unidadesPorCaja) : 0,
        subtotal: regularSubtotal,
        presentacion: `${item.variant === "pack" ? product?.pack?.label || item.label : product?.unit?.label || item.label} · Precio normal${couponPercentage ? " + cupón" : ""}`,
        pricingGroup: "regular" as const,
        promoCaja: null,
      });
    }
    return lines;
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
  const minimumOrder = Math.max(0, Number(params.checkoutSettings?.minimumOrder ?? 10_000));
  const shippingCost = Math.max(0, Number(params.checkoutSettings?.shippingCost ?? 500));
  const freeShipping = params.checkoutSettings?.freeShipping !== false;
  const shippingCharge = freeShipping ? 0 : shippingCost;
  if (metrics.subtotal < minimumOrder) {
    throw new Error(`El mínimo de compra es de ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(minimumOrder)}.`);
  }

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
      preventistaReferido: String(params.customer.preventistaReferido || "").trim(),
      ubicacion: params.customer.ubicacion ?? null,
    },
    delivery: {
      date: params.delivery.date,
      dateLabel: params.delivery.dateLabel,
      timeRange: params.delivery.timeRange,
      requestedAtIso: nowIso,
    },
    payment: params.paymentMethod ? {
      method: params.paymentMethod,
      label: params.paymentMethod === "cash" ? "Efectivo" : "Transferencia",
      timing: "on_delivery" as const,
      note: "Abonará al momento de recibir la mercadería.",
    } : null,
    shipping: {
      referenceCost: shippingCost,
      chargedAmount: shippingCharge,
      free: freeShipping,
    },
    items,
    totals: {
      distinct: items.length,
      totalQty: metrics.totalUnits + metrics.totalBoxes,
      total: roundMoney(metrics.subtotal + shippingCharge),
      subtotal: metrics.subtotal,
      discountTotal: metrics.discountTotal,
      discountCode: effectiveDiscountCode ? {
        code: effectiveDiscountCode.code,
        percentage: effectiveDiscountCode.percentage,
        amount: effectiveDiscountCode.discountAmount,
        eligibleSubtotal: effectiveDiscountCode.eligibleSubtotal,
      } : null,
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

  const nextDailyUsage = { ...dailyUsage };
  effectiveCartItems.forEach((item) => {
    const promoUnits = pricingByItem.get(item.id)?.promoUnits || 0;
    if (promoUnits > 0) nextDailyUsage[item.productId] = (nextDailyUsage[item.productId] || 0) + promoUnits;
  });
  useCartStore.getState().setDailyOfferUsage(nextDailyUsage);

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
      preventistaReferido: payload.cliente.preventistaReferido,
      ubicacion: payload.cliente.ubicacion,
    },
    delivery: {
      date: payload.delivery.date,
      dateLabel: payload.delivery.dateLabel,
      timeRange: payload.delivery.timeRange,
    },
    payment: payload.payment,
    items: items.map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      descuentoPct: item.descuentoPct,
      descuentoProductoPct: item.descuentoProductoPct,
      descuentoCodigoPct: item.descuentoCodigoPct,
      descuentoCodigoMonto: item.descuentoCodigoMonto,
      precioLista: item.precioLista,
      precioFinal: item.precioFinal,
      subtotal: item.subtotal,
      cantidadUnidades: item.cantidadUnidades,
      cantidadCajas: item.cantidadCajas,
      unidadesPorCaja: item.unidadesPorCaja,
      pricingGroup: item.pricingGroup,
      promoCaja: item.promoCaja ? {
        unidadesConPromo: item.promoCaja.unidadesConPromo,
        unidadesPrecioLista: item.promoCaja.unidadesPrecioLista,
        precioUnitarioPromo: Number(item.promoCaja.precioUnitarioPromo || 0),
        unidadesPorCaja: Number(item.promoCaja.unidadesPorCaja || 1),
      } : null,
    })),
    totals: {
      distinct: payload.totals.distinct,
      totalQty: payload.totals.totalQty,
      total: payload.totals.total,
      subtotal: payload.totals.subtotal,
      discountTotal: payload.totals.discountTotal,
      discountCode: payload.totals.discountCode
        ? { code: payload.totals.discountCode.code, percentage: payload.totals.discountCode.percentage }
        : null,
    },
  };

  clearDailyOfferUsageCache();
  return { id: orderId, telegramPayload };
}
