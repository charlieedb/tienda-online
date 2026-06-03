"use client";

import { doc, runTransaction } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";
import type { OrderRecord } from "@/lib/orders";

type JsPdfModule = typeof import("jspdf");
type AutoTableModule = typeof import("jspdf-autotable");

const LOGO_SRC = "/jonico-logo.png";
let logoDataUrlPromise: Promise<string | null> | null = null;

function fmtMoneyAR(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function fmtFecha(value: string) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toTitleCase(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

async function loadLogoDataUrl() {
  if (logoDataUrlPromise) return logoDataUrlPromise;
  logoDataUrlPromise = (async () => {
    try {
      const res = await fetch(LOGO_SRC);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();
  return logoDataUrlPromise;
}

async function generarNumeroRemito() {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");

  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const prefijo = `0${mes}${anio}`;

  const ref = doc(db, "contadores", "remitos");
  const numero = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const ultimo = snap.exists() ? Number(snap.data()?.ultimo || 0) : 0;
    const next = ultimo + 1;
    tx.set(ref, { ultimo: next }, { merge: true });
    return next;
  });

  return `${prefijo}-${String(numero).padStart(5, "0")}`;
}

export async function generateOrderRemitoPdf(params: {
  order: OrderRecord;
  actor: User | null;
  remitoNumber?: string;
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf") as Promise<JsPdfModule>,
    import("jspdf-autotable") as Promise<AutoTableModule>,
  ]);

  const autoTable = autoTableModule.default;
  const docPdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const remitoNumber = params.remitoNumber?.trim() || (await generarNumeroRemito());
  const logoDataUrl = await loadLogoDataUrl();

  const MARGIN_X = 15;
  const HEADER_Y = 10;
  const HEADER_W = 267;
  const HEADER_H = 43;
  const GAP = 0;
  const CLIENT_BOX_H = 20;
  const pageHeight = docPdf.internal.pageSize.height;
  const pageWidth = docPdf.internal.pageSize.width;

  const rawAddress = String(params.order.cliente.direccion || "").trim();
  const actorLabel = params.actor?.email || params.actor?.uid || "Admin";
  const notas = [params.order.cliente.nota, params.order.dispatch.observaciones]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const productos = params.order.items.map((item) => {
    const precioDesc = Number(item.precioFinal || 0);
    return [
      item.cantidadCajas || 0,
      item.cantidadUnidades || 0,
      item.nombre || "",
      fmtMoneyAR(item.precioLista),
      `${Number(item.descuentoPct || 0)}%`,
      fmtMoneyAR(precioDesc),
      fmtMoneyAR(item.subtotal),
    ];
  });

  const drawHeader = (copia: string) => {
    docPdf.rect(MARGIN_X, HEADER_Y, HEADER_W, HEADER_H);

    const xBoxW = 22;
    const xBoxH = 22;
    const xBoxX = MARGIN_X + HEADER_W / 2 - xBoxW / 2;
    const xBoxY = HEADER_Y;

    if (logoDataUrl) {
      const logoW = 54;
      const logoX = MARGIN_X + 18;
      const logoY = HEADER_Y + 7;
      docPdf.addImage(logoDataUrl, "PNG", logoX, logoY, logoW, 0);
    }

    docPdf.rect(xBoxX, xBoxY, xBoxW, xBoxH);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(30);
    docPdf.text("X", xBoxX + xBoxW / 2, xBoxY + 14, { align: "center" });
    docPdf.setFontSize(9.5);
    docPdf.text(copia.toUpperCase(), xBoxX + xBoxW / 2, xBoxY + xBoxH - 3, { align: "center" });

    const rightBlockCenterX = MARGIN_X + HEADER_W - 40;
    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(11);
    docPdf.text(`Remito Nº: ${remitoNumber}`, rightBlockCenterX, HEADER_Y + 15, { align: "center" });
    docPdf.text(`Fecha: ${fmtFecha(params.order.audit.createdAtIso)}`, rightBlockCenterX, HEADER_Y + 25, {
      align: "center",
    });
  };

  const drawClientBox = () => {
    const clientBoxY = HEADER_Y + HEADER_H + GAP;
    docPdf.rect(MARGIN_X, clientBoxY, HEADER_W, CLIENT_BOX_H);

    docPdf.line(MARGIN_X + HEADER_W / 2, clientBoxY, MARGIN_X + HEADER_W / 2, clientBoxY + CLIENT_BOX_H);
    docPdf.line(MARGIN_X, clientBoxY + CLIENT_BOX_H / 2, MARGIN_X + HEADER_W, clientBoxY + CLIENT_BOX_H / 2);

    const vCliente = toTitleCase(params.order.cliente.nombre || "-");
    const vDom = toTitleCase(rawAddress || "-");
    const vHorario = "A coordinar";
    const vVendedor = toTitleCase(actorLabel || "-");

    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Cliente:", MARGIN_X + 3, clientBoxY + 7);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(vCliente, MARGIN_X + 28, clientBoxY + 7);

    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Domicilio:", MARGIN_X + HEADER_W / 2 + 3, clientBoxY + 7);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(vDom, MARGIN_X + HEADER_W / 2 + 30, clientBoxY + 7);

    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Horario:", MARGIN_X + 3, clientBoxY + CLIENT_BOX_H / 2 + 7);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(vHorario, MARGIN_X + 28, clientBoxY + CLIENT_BOX_H / 2 + 7);

    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Vendedor:", MARGIN_X + HEADER_W / 2 + 3, clientBoxY + CLIENT_BOX_H / 2 + 7);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(vVendedor, MARGIN_X + HEADER_W / 2 + 30, clientBoxY + CLIENT_BOX_H / 2 + 7);

    return clientBoxY + CLIENT_BOX_H + GAP;
  };

  const drawFooter = (mostrarTotal: boolean) => {
    const footBoxH = 12;
    const footBoxY = pageHeight - footBoxH - 45;

    docPdf.rect(MARGIN_X, footBoxY, HEADER_W, footBoxH);
    docPdf.line(MARGIN_X + HEADER_W - 60, footBoxY, MARGIN_X + HEADER_W - 60, footBoxY + footBoxH);

    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    docPdf.text(`Notas: ${notas.length ? notas.join(" - ") : "-"}`, MARGIN_X + 3, footBoxY + 8);

    if (mostrarTotal) {
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(11);
      docPdf.text(`Total: ${fmtMoneyAR(params.order.totals.total)}`, MARGIN_X + HEADER_W - 55, footBoxY + 8);
    }

    const leyendaY = footBoxY + footBoxH + 12;
    const texto1 = "Si abona con transferencia, el alias es: ";
    const texto2 = "JOMA.SRL";
    const texto3 = " a nombre de Jonico SRL. ";
    const texto4 = "*NO TRANSFERIR A OTRA CUENTA";

    let cursorX =
      pageWidth / 2 - docPdf.getTextWidth(texto1 + texto2 + texto3 + texto4) / 2;

    docPdf.setFontSize(9.5);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(texto1, cursorX, leyendaY);
    cursorX += docPdf.getTextWidth(texto1);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(texto2, cursorX, leyendaY);
    cursorX += docPdf.getTextWidth(texto2);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(texto3, cursorX, leyendaY);
    cursorX += docPdf.getTextWidth(texto3);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(texto4, cursorX, leyendaY);

    const firmaY = leyendaY + 20;
    const lineaLargo = 70;
    const espacioEntre = 80;
    const centroX = pageWidth / 2;
    const firmaX = centroX - lineaLargo - espacioEntre / 2;
    const aclaracionX = centroX + espacioEntre / 2;

    docPdf.setLineWidth(0.2);
    docPdf.setDrawColor(0);
    docPdf.setLineDashPattern([1, 2], 0);
    docPdf.line(firmaX, firmaY, firmaX + lineaLargo, firmaY);
    docPdf.setLineDashPattern([], 0);
    docPdf.text("Firma", firmaX + lineaLargo / 2, firmaY + 6, { align: "center" });
    docPdf.setLineDashPattern([1, 2], 0);
    docPdf.line(aclaracionX, firmaY, aclaracionX + lineaLargo, firmaY);
    docPdf.setLineDashPattern([], 0);
    docPdf.text("Aclaración", aclaracionX + lineaLargo / 2, firmaY + 6, { align: "center" });
  };

  const drawPage = (copia: string) => {
    drawHeader(copia);
    let startY = drawClientBox();
    const filasPorPagina = 9;
    const totalPaginas = Math.ceil(productos.length / filasPorPagina) || 1;
    let currentPage = 1;

    const renderTabla = (rows: Array<Array<string | number>>, pageNum: number) => {
      autoTable(docPdf, {
        startY,
        head: [["Cajas", "Unid.", "Descripción", "Pr. Unit.", "Desc.", "Pr. Desc.", "Sub Total"]],
        body: rows,
        styles: { fontSize: 10, halign: "center", textColor: [0, 0, 0], lineWidth: 0.15 },
        columnStyles: {
          2: { halign: "left" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
        headStyles: { fillColor: [210, 210, 210], textColor: 0, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { left: 15, right: 15 },
        tableWidth: 267,
        didDrawPage: (data) => {
          startY = data.cursor?.y || startY;
          docPdf.setFont("helvetica", "italic");
          docPdf.setFontSize(9);
          docPdf.text(`Página ${pageNum} de ${totalPaginas}`, pageWidth / 2, pageHeight - 8, {
            align: "center",
          });
        },
      });
    };

    if (productos.length === 0) {
      renderTabla([], 1);
      drawFooter(true);
      return;
    }

    for (let i = 0; i < productos.length; i += filasPorPagina) {
      const chunk = productos.slice(i, i + filasPorPagina);
      const esUltimaPagina = i + filasPorPagina >= productos.length;

      renderTabla(chunk, currentPage);
      drawFooter(esUltimaPagina);

      if (!esUltimaPagina) {
        docPdf.addPage();
        currentPage += 1;
        drawHeader(copia);
        startY = drawClientBox();
      }
    }
  };

  drawPage("ORIGINAL");
  docPdf.addPage();
  drawPage("DUPLICADO");
  docPdf.save(`remito-${remitoNumber}.pdf`);

  return remitoNumber;
}
