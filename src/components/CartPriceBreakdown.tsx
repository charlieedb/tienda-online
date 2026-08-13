import type { CartItem, getCartItemPricing } from "@/store/cart";

type Pricing = ReturnType<typeof getCartItemPricing>;

export function CartPriceBreakdown({
  item,
  pricing,
  couponPercentage = 0,
  couponEligibleSubtotal = 0,
  formatMoney,
}: {
  item: CartItem;
  pricing: Pricing;
  couponPercentage?: number;
  couponEligibleSubtotal?: number;
  formatMoney: (value: number) => string;
}) {
  const couponDiscount = couponEligibleSubtotal * Math.max(0, couponPercentage) / 100;
  const finalSubtotal = Math.max(0, pricing.total - couponDiscount);
  const exhausted = Number(item.offerMaxUnits || 0) > 0
    && Number(item.offerUsedUnits || 0) >= Number(item.offerMaxUnits || 0);

  return (
    <div className="cart-price-breakdown">
      {pricing.promoUnits > 0 ? (
        <div className="cart-price-line cart-price-line--offer">
          <div>
            <strong>Con oferta</strong>
            <span>{pricing.promoUnits} unid. × {formatMoney(pricing.promoSubtotal / pricing.promoUnits)}</span>
          </div>
          <b>{formatMoney(pricing.promoSubtotal)}</b>
        </div>
      ) : null}

      {pricing.regularUnits > 0 ? (
        <div className="cart-price-line cart-price-line--regular">
          <div>
            <strong>Precio normal</strong>
            <span>{pricing.regularUnits} unid. × {formatMoney(pricing.regularSubtotal / pricing.regularUnits)}</span>
          </div>
          <b>{formatMoney(pricing.regularSubtotal)}</b>
        </div>
      ) : null}

      {couponDiscount > 0 ? (
        <div className="cart-price-line cart-price-line--coupon">
          <div>
            <strong>Cupón {couponPercentage}%</strong>
            <span>Aplicado sobre {formatMoney(couponEligibleSubtotal)}</span>
          </div>
          <b>− {formatMoney(couponDiscount)}</b>
        </div>
      ) : null}

      {exhausted ? (
        <p className="cart-price-quota-note">Ya usaste el cupo de esta oferta hoy. Estas unidades se cobran a precio normal.</p>
      ) : null}

      <div className="cart-price-subtotal">
        <span>Subtotal del producto</span>
        <strong>{formatMoney(finalSubtotal)}</strong>
      </div>
    </div>
  );
}
