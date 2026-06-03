"use client";

import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";
import type { CartItem } from "@/store/cart";
import type { Product } from "@/lib/products";

type CheckoutCustomer = {
  nombre: string;
  telefono: string;
  direccion: string;
  nota?: string;
};

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function asActor(user: User | null, customer: CheckoutCustomer) {
  return user?.email || user?.uid || customer.nombre || "checkout";
}

export async function submitCheckoutOrder(params: {
  user: User | null;
  customer: CheckoutCustomer;
  cartItems: CartItem[];
  productsById: Map<string, Product>;
}) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");

  const nowIso = new Date().toISOString();
  const orderRef = doc(collection(db, "orders"));
  const actor = asActor(params.user, params.customer);

  const items = params.cartItems.map((item) => {
    const product = params.productsById.get(item.productId);
    const unitPrice = Number(product?.unit?.price || 0);
    const packPrice = Number(product?.pack?.price || 0);
    const unidadesPorCaja = Number(product?.pack?.qty || 0);
    const descuentoPct = product?.offer ? Number(product.offerDiscount || 0) : 0;
    const precioLista = item.variant === "pack" ? packPrice || item.price : unitPrice || item.price;
    const precioFinal = Number(item.price || 0);
    const cantidadUnidades = item.variant === "unit" ? Number(item.qty || 0) : 0;
    const cantidadCajas = item.variant === "pack" ? Number(item.qty || 0) : 0;
    const subtotal = roundMoney(precioFinal * Number(item.qty || 0));

    return {
      codigo: String(product?.id || item.productId || "").trim(),
      nombre: String(product?.name || item.name || "").trim(),
      precioLista: roundMoney(precioLista),
      descuentoPct,
      precioFinal: roundMoney(precioFinal),
      cantidadUnidades,
      cantidadCajas,
      subtotal,
      presentacion:
        item.variant === "pack"
          ? String(product?.pack?.label || `Caja x${unidadesPorCaja || 1}`).trim()
          : String(product?.unit?.label || "Unidad").trim(),
      unidadesPorCaja: item.variant === "pack" ? unidadesPorCaja || 0 : 0,
      precioUnitarioBase: roundMoney(unitPrice || precioFinal),
      variantLabel: item.variant === "pack" ? "Caja" : "Unidad",
    };
  });

  const metrics = items.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalUnits += item.cantidadUnidades;
      acc.totalBoxes += item.cantidadCajas;
      acc.subtotal = roundMoney(acc.subtotal + item.subtotal);
      const qtyBase = Math.max(1, item.cantidadUnidades || item.cantidadCajas || 0);
      const discount = (item.precioLista - item.precioFinal) * qtyBase;
      acc.discountTotal = roundMoney(acc.discountTotal + Math.max(0, discount));
      return acc;
    },
    { totalItems: 0, totalUnits: 0, totalBoxes: 0, subtotal: 0, discountTotal: 0 },
  );

  const payload = {
    pedido: {
      id: orderRef.id,
      tienda: "tienda-online-next",
      source: "tienda-online-next",
      clientRequestId: orderRef.id,
      createdAtIso: nowIso,
    },
    cliente: {
      uid: params.user?.uid || null,
      email: params.user?.email || null,
      nombre: params.customer.nombre.trim(),
      telefono: params.customer.telefono.trim(),
      direccion: params.customer.direccion.trim(),
      nota: String(params.customer.nota || "").trim(),
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
      createdAt: serverTimestamp(),
      createdAtIso: nowIso,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso,
      createdBy: actor,
      lastActionBy: actor,
    },
    sheets: {
      status: "skipped",
      message: "Google Sheets desactivado en esta versión.",
    },
  };

  await setDoc(orderRef, payload, { merge: true });
  return { id: orderRef.id };
}
