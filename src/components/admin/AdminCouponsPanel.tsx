import { Fragment, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { fetchRegisteredCustomers, type AdminCustomer } from "@/lib/adminCustomers";
import { getDiscountCodes, getDiscountCodeUsages, normalizeDiscountCode, saveDiscountCodes, type DiscountCode, type DiscountCodeUsage } from "@/lib/discountCodes";

type CouponAudience = "all" | "business" | "customer";

function formatUsageDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date) : "Sin fecha";
}

function searchable(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function AdminCouponsPanel({ user }: { user: User }) {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [discountUsages, setDiscountUsages] = useState<DiscountCodeUsage[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPercentage, setNewPercentage] = useState(5);
  const [newValidFrom, setNewValidFrom] = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");
  const [newUsageLimit, setNewUsageLimit] = useState(0);
  const [newAudience, setNewAudience] = useState<CouponAudience>("all");
  const [selectedCustomerUid, setSelectedCustomerUid] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [expandedCode, setExpandedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadData = async (announce = false) => {
    setLoading(true);
    setMessage("");
    try {
      const [codes, usages, registeredCustomers] = await Promise.all([
        getDiscountCodes(),
        getDiscountCodeUsages().catch(() => []),
        fetchRegisteredCustomers(500),
      ]);
      setDiscountCodes(codes);
      setDiscountUsages(usages);
      setCustomers(registeredCustomers);
      if (announce) setMessage("Listado actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los cupones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const selectedCustomer = customers.find((customer) => customer.uid === selectedCustomerUid);
  const customerResults = useMemo(() => {
    const query = searchable(customerSearch);
    if (!query) return customers.slice(0, 12);
    return customers.filter((customer) => searchable([customer.name, customer.username, customer.email, customer.phone, customer.businessName].join(" ")).includes(query)).slice(0, 20);
  }, [customerSearch, customers]);

  const addDiscountCode = () => {
    const code = normalizeDiscountCode(newCode);
    setMessage("");
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return setMessage("Usá entre 3 y 24 letras, números, guion o guion bajo.");
    if (discountCodes.some((item) => item.code === code)) return setMessage("Ese código ya existe.");
    if (!Number.isFinite(newPercentage) || newPercentage <= 0 || newPercentage > 100) return setMessage("El porcentaje debe ser mayor a 0 y no superar el 100%.");
    if (newValidFrom && newValidUntil && newValidUntil < newValidFrom) return setMessage("La fecha de finalización no puede ser anterior al inicio.");
    if (newAudience === "customer" && !selectedCustomer) return setMessage("Elegí el cliente que podrá usar este cupón.");

    setDiscountCodes((current) => [...current, {
      code,
      percentage: Math.round(newPercentage * 100) / 100,
      active: true,
      validFrom: newValidFrom,
      validUntil: newValidUntil,
      usageLimit: Math.max(0, Math.trunc(newUsageLimit || 0)),
      usageCount: 0,
      audience: newAudience === "business" ? "business" : "all",
      ownerUid: selectedCustomer?.uid || "",
      ownerUsername: selectedCustomer?.username || selectedCustomer?.name || "",
      ownerEmail: selectedCustomer?.email || "",
      perUserLimit: newAudience === "customer" ? 1 : 0,
      source: "manual",
    }]);
    setNewCode("");
    setNewPercentage(5);
    setNewValidFrom("");
    setNewValidUntil("");
    setNewUsageLimit(0);
    setNewAudience("all");
    setSelectedCustomerUid("");
    setCustomerSearch("");
    setMessage("Cupón agregado. Guardá los cambios para publicarlo.");
  };

  const persistDiscountCodes = async () => {
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveDiscountCodes(discountCodes, user.email || user.uid);
      setDiscountCodes(saved);
      setMessage("Cupones guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cupones.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="admin-content-box admin-store-config admin-coupons-panel">
    <section className="admin-card admin-discount-config">
      <div className="admin-card__head">
        <div className="admin-headline"><h1 className="admin-title">Cupones</h1><p>Creá descuentos generales, para comercios o exclusivos para un cliente registrado.</p></div>
        <button type="button" className="btn ghost" onClick={() => void loadData(true)} disabled={loading}>{loading ? "Actualizando..." : "Actualizar listado"}</button>
      </div>
      <div className="admin-card__body">
        <div className="admin-discount-create">
          <label><span>Código</span><input className="admin-input" value={newCode} onChange={(event) => setNewCode(normalizeDiscountCode(event.target.value))} maxLength={24} placeholder="EJ: CLIENTE10"/></label>
          <label><span>Porcentaje</span><div className="admin-discount-number"><input className="admin-input" type="number" min="0.01" max="100" step="0.01" value={newPercentage} onChange={(event) => setNewPercentage(Number(event.target.value))}/><b>%</b></div></label>
          <label><span>Válido desde <em>Opcional</em></span><input className="admin-input" type="date" value={newValidFrom} onChange={(event) => setNewValidFrom(event.target.value)}/></label>
          <label><span>Válido hasta <em>Opcional</em></span><input className="admin-input" type="date" value={newValidUntil} min={newValidFrom || undefined} onChange={(event) => setNewValidUntil(event.target.value)}/></label>
          <label><span>Límite de usos <em>0 = ilimitado</em></span><input className="admin-input" type="number" min="0" step="1" value={newUsageLimit} onChange={(event) => setNewUsageLimit(Math.max(0, Number(event.target.value)))}/></label>
          <label><span>Disponible para</span><select className="admin-input" value={newAudience} onChange={(event) => { const value = event.target.value as CouponAudience; setNewAudience(value); if (value !== "customer") { setSelectedCustomerUid(""); setCustomerSearch(""); } }}><option value="all">Todos los clientes</option><option value="business">Solo comercios</option><option value="customer">Un cliente particular</option></select></label>
          {newAudience === "customer" ? <div className="admin-coupon-customer-picker"><label><span>Cliente registrado</span><input className="admin-input" value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setSelectedCustomerUid(""); }} placeholder="Buscar por nombre, usuario o email" autoComplete="off"/></label>{selectedCustomer ? <div className="admin-coupon-selected-customer"><span><strong>{selectedCustomer.name}</strong><small>{selectedCustomer.email || selectedCustomer.username}</small></span><button type="button" className="btn ghost" onClick={() => { setSelectedCustomerUid(""); setCustomerSearch(""); }}>Cambiar</button></div> : <ul className="dropdown sugerencias admin-coupon-customer-results">{customerResults.map((customer) => <li key={customer.uid}><button type="button" onClick={() => { setSelectedCustomerUid(customer.uid); setCustomerSearch(customer.name); }}><strong>{customer.name}</strong><small>{customer.email || customer.username || customer.phone}</small></button></li>)}{!customerResults.length ? <li className="admin-coupon-no-results">No encontramos clientes.</li> : null}</ul>}</div> : null}
          <button type="button" className="btn primary" onClick={addDiscountCode}>+ Crear cupón</button>
        </div>
        <div className="admin-discount-list-wrap">
          <table className="admin-discount-table"><thead><tr><th>Código</th><th>Origen</th><th>Descuento</th><th>Destinatario</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{discountCodes.map((item) => {
            const usages = discountUsages.filter((usage) => usage.code === item.code);
            const exhausted = item.usageLimit > 0 && item.usageCount >= item.usageLimit;
            return <Fragment key={item.code}><tr><td><strong>{item.code}</strong></td><td><span className={`admin-discount-origin ${item.source === "notification" ? "is-notification" : ""}`}>{item.source === "notification" ? "Notificación" : item.source === "business_welcome" ? "Registro comercio" : "Manual"}</span></td><td>{item.percentage}%</td><td>{item.ownerUid ? <><strong>{item.ownerUsername || "Cliente"}</strong><small>{item.ownerEmail || item.ownerUid}</small></> : <>{item.audience === "business" ? "Solo comercios" : "Todos los clientes"}</>}</td><td><span>{item.validFrom || "Sin inicio"}</span><small>hasta {item.validUntil || "sin vencimiento"}</small></td><td><button type="button" className="admin-discount-usage-button" onClick={() => setExpandedCode((current) => current === item.code ? "" : item.code)}>{item.usageCount}{item.usageLimit > 0 ? ` / ${item.usageLimit}` : " / ∞"}<small>Ver clientes</small></button></td><td><span className={`admin-discount-status ${item.active && !exhausted ? "is-active" : "is-inactive"}`}>{exhausted ? "Agotado" : item.active ? "Activo" : "Inactivo"}</span></td><td><div className="admin-discount-row-actions"><button type="button" className="btn ghost" onClick={() => setDiscountCodes((current) => current.map((code) => code.code === item.code ? { ...code, active: !code.active } : code))}>{item.active ? "Desactivar" : "Activar"}</button><button type="button" className="btn ofertas-danger" onClick={() => setDiscountCodes((current) => current.filter((code) => code.code !== item.code))}>Eliminar</button></div></td></tr>{expandedCode === item.code ? <tr className="admin-discount-usage-row"><td colSpan={8}>{usages.length ? <div className="admin-discount-usages">{usages.map((usage) => <article key={usage.id}><div><strong>{usage.customerName || "Cliente sin nombre"}</strong><span>{usage.customerEmail || usage.customerPhone || usage.customerUid}</span></div><div><span>{formatUsageDate(usage.usedAtIso)}</span><small>Pedido {usage.orderId}</small></div><b>−{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(usage.discountAmount)}</b></article>)}</div> : <p className="admin-discount-empty">Todavía no hay usos registrados para este cupón.</p>}</td></tr> : null}</Fragment>;
          })}</tbody></table>
          {!loading && !discountCodes.length ? <p className="admin-discount-empty">Todavía no creaste cupones.</p> : null}
        </div>
        <div className="admin-discount-actions"><button type="button" className="btn success" onClick={() => void persistDiscountCodes()} disabled={saving || loading}>{saving ? "Guardando..." : "Guardar cupones"}</button></div>
        {message ? <div className="admin-users-message" role="status">{message}</div> : null}
      </div>
    </section>
  </div>;
}
