import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/store/cart";
import { Icon } from "./Icons";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function CartView({ onContinue }: { onContinue: () => void }) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const decItem = useCartStore((state) => state.decItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);

  if (!items.length) return <section className="empty-state">
    <div className="empty-icon"><Icon name="cart" /></div>
    <h2>Tu carrito está esperando</h2>
    <p>Agregá tus productos favoritos y los vas a encontrar acá.</p>
    <button type="button" className="primary-action" onClick={onContinue}>Explorar productos</button>
  </section>;

  return <section className="cart-page">
    <div className="section-heading cart-heading"><div><span>Tu compra</span><h2>Carrito</h2></div><button type="button" className="clear-button" onClick={clear}><Icon name="trash" /> Vaciar</button></div>
    <div className="cart-list"><AnimatePresence initial={false}>{items.map((item) => <motion.article layout exit={{ opacity: 0, x: 24 }} key={item.id} className="cart-item">
      <div className="cart-item-copy"><strong>{item.name}</strong><span>{item.label}</span><b>{money.format(item.price * item.qty)}</b></div>
      <div className="cart-item-actions"><div className="stepper compact"><button type="button" onClick={() => decItem(item.id)} aria-label={`Disminuir ${item.name}`}><Icon name="minus" /></button><output>{item.qty}</output><button type="button" onClick={() => addItem({ id: item.id, productId: item.productId, name: item.name, variant: item.variant, label: item.label, price: item.price, unitPriceFinal: item.unitPriceFinal, unitsPerPack: item.unitsPerPack }, 1)} aria-label={`Aumentar ${item.name}`}><Icon name="plus" /></button></div><button className="remove-button" type="button" onClick={() => removeItem(item.id)}>Quitar</button></div>
    </motion.article>)}</AnimatePresence></div>
    <div className="cart-summary"><div><span>Total estimado</span><strong>{money.format(total)}</strong></div><p>En la próxima etapa vas a poder confirmar y enviar este pedido.</p></div>
  </section>;
}
