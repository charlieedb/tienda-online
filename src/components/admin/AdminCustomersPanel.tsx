import { useDeferredValue, useMemo, useState } from "react";
import { deleteRegisteredCustomer, fetchRegisteredCustomers, type AdminCustomer } from "@/lib/adminCustomers";
import { useAuth } from "@/auth/AuthProvider";

export function AdminCustomersPanel() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "consumer" | "business">("all");
  const [deletingUid, setDeletingUid] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const load = async () => {
    setLoading(true);
    setError("");
    try { setCustomers(await fetchRegisteredCustomers()); setLoaded(true); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar los clientes."); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => customers.filter((customer) => {
    if (type !== "all" && customer.accountType !== type) return false;
    if (!deferredSearch) return true;
    return [customer.name, customer.email, customer.username, customer.phone, customer.businessName, customer.city]
      .join(" ").toLowerCase().includes(deferredSearch);
  }), [customers, deferredSearch, type]);
  const businesses = customers.filter((customer) => customer.accountType === "business").length;

  const removeCustomer = async (customer: AdminCustomer) => {
    const label = customer.email || customer.name;
    if (!window.confirm(`¿Eliminar definitivamente a ${label}?\n\nSe borrarán su acceso, perfil y dispositivos de notificaciones. Esta acción no se puede deshacer.`)) return;
    setDeletingUid(customer.uid);
    setError("");
    try {
      await deleteRegisteredCustomer(customer.uid);
      setCustomers((current) => current.filter((item) => item.uid !== customer.uid));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "No se pudo eliminar el usuario."); }
    finally { setDeletingUid(""); }
  };

  return <div className="admin-content-box admin-customers">
    <section className="admin-card">
      <div className="admin-card__head admin-customers__head">
        <div className="admin-headline"><h1 className="admin-title">Clientes registrados</h1><p>Consultá los perfiles de la tienda y distinguí consumidores de comercios.</p></div>
        <button type="button" className="btn primary" onClick={() => void load()} disabled={loading}>{loading ? "Cargando..." : loaded ? "Recargar clientes" : "Cargar clientes"}</button>
      </div>
    </section>

    {loaded ? <section className="admin-card">
      <div className="admin-card__body">
        <div className="admin-customers__metrics">
          <div><span>Total registrados</span><strong>{customers.length}</strong></div>
          <div><span>Consumidores</span><strong>{customers.length - businesses}</strong></div>
          <div><span>Comercios</span><strong>{businesses}</strong></div>
        </div>
        <div className="admin-customers__filters">
          <input className="admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, email, teléfono o comercio" />
          <select className="admin-input" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="all">Todos los clientes</option><option value="consumer">Consumidores</option><option value="business">Comercios</option></select>
        </div>
        <div className="ofertas-list-wrap">
          <table className="productos-table ofertas-table admin-customers__table"><thead><tr><th>Cliente</th><th>Tipo de cuenta</th><th>Contacto</th><th>Comercio</th><th>Localidad</th><th>Acciones</th></tr></thead><tbody>
            {filtered.map((customer) => { const isCurrentAdmin = customer.uid === user?.uid; return <tr key={customer.uid}><td><strong>{customer.name}</strong><small>@{customer.username || "sin usuario"}</small>{isCurrentAdmin ? <span className="admin-protected-badge">Administrador</span> : null}</td><td><span className={`admin-customer-type is-${customer.accountType}`}>{customer.accountType === "business" ? "Comercio" : "Consumidor"}</span></td><td><span>{customer.email || "Sin email"}</span><small>{customer.phone || "Sin teléfono"}</small></td><td>{customer.accountType === "business" ? <><strong>{customer.businessName}</strong><small>{customer.businessType}</small></> : <span className="admin-customers__muted">No corresponde</span>}</td><td>{customer.city || "Sin localidad"}</td><td>{isCurrentAdmin ? <span className="admin-protected-copy">Cuenta protegida</span> : <button type="button" className="btn ofertas-danger admin-customer-delete" disabled={Boolean(deletingUid)} onClick={() => void removeCustomer(customer)}>{deletingUid === customer.uid ? "Eliminando..." : "Eliminar"}</button>}</td></tr>; })}
            {!filtered.length ? <tr><td colSpan={6} className="admin-customers__empty">No hay clientes que coincidan con los filtros.</td></tr> : null}
          </tbody></table>
        </div>
      </div>
    </section> : <section className="admin-card"><div className="admin-card__body admin-customers__initial"><strong>Base de clientes</strong><p>La información no se carga automáticamente para evitar lecturas innecesarias de Firestore.</p><button type="button" className="btn primary" onClick={() => void load()} disabled={loading}>{loading ? "Cargando..." : "Cargar clientes"}</button></div></section>}
    {error ? <div className="admin-users-message" role="alert">{error}</div> : null}
  </div>;
}
