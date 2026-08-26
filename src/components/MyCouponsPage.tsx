import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getMyDiscountCodes, type DiscountCode } from "@/lib/discountCodes";
import { Icon } from "@/components/Icons";

export function MyCouponsPage({ onLogin, onUse }: { onLogin: () => void; onUse: (code: string) => void }) {
  const { user } = useAuth();
  const previewEmpty = import.meta.env.DEV && new URLSearchParams(window.location.search).get("previewEmptyCoupons") === "1";
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    getMyDiscountCodes(user.uid, true).then((codes) => {
      if (active) setItems(previewEmpty ? [] : codes.filter((code) => code.ownerUid === user.uid && code.active && (!code.usageLimit || code.usageCount < code.usageLimit)));
    }).catch(() => { if (active) setError("No pudimos cargar tus cupones."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewEmpty, user]);
  return <section className="my-coupons">
    <div className="page-intro"><span>Beneficios de tu cuenta</span><h1>Mis cupones</h1><p>Acá encontrás los descuentos vigentes asignados exclusivamente a tu usuario.</p></div>
    {!user ? <div className="empty-state"><Icon name="ticket"/><h2>Ingresá para ver tus cupones</h2><p>Los beneficios están asociados a tu cuenta.</p><button className="primary-action" onClick={onLogin}>Iniciar sesión</button></div>
      : loading ? <div className="coupons-loading"><span/><p>Cargando tus beneficios…</p></div>
      : error ? <div className="empty-state"><h2>No pudimos cargarlos</h2><p>{error}</p></div>
      : items.length ? <div className="coupon-list">{items.map((coupon) => <article className="coupon-card" key={coupon.code}><div className="coupon-card__value"><strong>{coupon.percentage}%</strong><span>OFF</span></div><div className="coupon-card__copy"><span>Cupón personal</span><h2>{coupon.code}</h2><p>Un solo uso · Sin vencimiento</p></div><button type="button" onClick={() => onUse(coupon.code)}>Usar cupón <Icon name="arrow"/></button></article>)}</div>
      : <div className="empty-state"><div className="coupon-empty-icon" aria-hidden="true"><Icon name="ticket"/></div><h2>No tenés cupones vigentes</h2><p>Cuando recibas un beneficio personal, va a aparecer acá.</p></div>}
  </section>;
}
