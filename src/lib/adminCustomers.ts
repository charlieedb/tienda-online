import { getAuthClient } from "@/lib/firebase";

const DELETE_CUSTOMER_URL = "https://us-central1-app-presu.cloudfunctions.net/deleteTiendaCustomer";
const GET_CUSTOMERS_URL = "https://us-central1-app-presu.cloudfunctions.net/getTiendaCustomers";

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
  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user) throw new Error("La sesión de administrador venció.");
  const response = await fetch(`${GET_CUSTOMERS_URL}?limit=${Math.max(1, Math.min(500, maxResults))}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; customers?: AdminCustomer[] };
  if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los clientes.");
  return Array.isArray(payload.customers) ? payload.customers : [];
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
