import { collection, getDocs, limit, query } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { getAuthClient } from "@/lib/firebase";

const DELETE_CUSTOMER_URL = "https://us-central1-app-presu.cloudfunctions.net/deleteTiendaCustomer";

export type AdminCustomer = {
  uid: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  accountType: "consumer" | "business";
  businessName: string;
  businessType: string;
  city: string;
};

export async function fetchRegisteredCustomers(maxResults = 250): Promise<AdminCustomer[]> {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const snapshot = await getDocs(query(collection(db, "users"), limit(Math.max(1, Math.min(500, maxResults)))));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Record<string, any>;
    const business = data.business && typeof data.business === "object" ? data.business : {};
    const addresses = Array.isArray(data.direcciones) ? data.direcciones : [];
    const firstAddress = addresses[0] && typeof addresses[0] === "object" ? addresses[0] : {};
    const accountType: AdminCustomer["accountType"] = data.accountType === "business" ? "business" : "consumer";
    return {
      uid: entry.id,
      name: String(data.displayName || `${data.nombre || ""} ${data.apellido || ""}`.trim() || data.username || "Sin nombre"),
      email: String(data.email || ""),
      username: String(data.username || ""),
      phone: String(data.telefono || business.phone || ""),
      accountType,
      businessName: accountType === "business" ? String(business.fantasyName || "Comercio sin nombre") : "",
      businessType: accountType === "business" ? String(business.businessType || "Sin categoría") : "",
      city: String(business.city || firstAddress.localidad || ""),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function deleteRegisteredCustomer(uid: string) {
  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user) throw new Error("La sesión de administrador venció.");
  const response = await fetch(DELETE_CUSTOMER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ uid }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload.error || "No se pudo eliminar el usuario."));
}
