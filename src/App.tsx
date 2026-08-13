import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PasswordResetPage } from "@/components/PasswordResetPage";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { CatalogManifest, Category, Product } from "@/catalog/types";
import {
  getCartItemPricing,
  getCartItemUnits,
  getRemainingStock,
  useCartStore,
} from "@/store/cart";
import { CartView } from "@/components/CartView";
import { CartExpiryGuard } from "@/components/CartExpiryGuard";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { ProfileView } from "@/components/ProfileView";
import { BusinessPage } from "@/components/BusinessPage";
import { MyCouponsPage } from "@/components/MyCouponsPage";
import { AuthWelcome } from "@/components/AuthWelcome";
import { PublicRoutePage } from "@/components/PublicRoutePage";
import { NotificationBell } from "@/components/NotificationBell";
import {
  StoreCreditBar,
  StoreInfoFooter,
  type StoreInfoPageKey,
} from "@/components/StoreFooter";
import { setDocumentMetadata } from "@/lib/seo";
import { WHATSAPP_URL } from "@/lib/whatsapp";
import { getDailyOfferUsage } from "@/lib/offerUsage";
import { useAuth } from "@/auth/AuthProvider";
import {
  getStoreCarouselSlides,
  subscribeToStoreConfig,
  type StoreCarouselSlide,
} from "@/lib/featuredProducts";
import { calculateDiscount, validateDiscountCode } from "@/lib/discountCodes";
import { getActiveCatalog, type Product as DiscountProduct } from "@/lib/products";

type Tab = "home" | "categories" | "search" | "cart" | "profile" | "business" | "coupons" | "info";
type InfoPage = StoreInfoPageKey;
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const carouselImageCache = new Map<string, HTMLImageElement>();

function preloadCarouselImages(slides: StoreCarouselSlide[], desktop: boolean) {
  slides.forEach((slide, index) => {
    const imageUrl = desktop
      ? slide.desktopImageUrl || slide.mobileImageUrl
      : slide.mobileImageUrl || slide.desktopImageUrl;
    if (!imageUrl || carouselImageCache.has(imageUrl)) return;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = index === 0 ? "high" : "auto";
    image.src = imageUrl;
    carouselImageCache.set(imageUrl, image);
  });
}

function ProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div
      className="product-list"
      aria-label="Cargando productos"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card skeleton-card" key={index}>
          <div className="skeleton-block image" />
          <div className="skeleton-lines">
            <i />
            <i />
            <i />
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <Icon name="refresh" />
      <h3>No pudimos cargar</h3>
      <p>{message}</p>
      <button type="button" onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}

function LiveDateTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const day = new Intl.DateTimeFormat("es-AR", { day: "2-digit" }).format(now);
  const month = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(now);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return (
    <time
      className="hero-live-clock"
      dateTime={now.toISOString()}
      aria-label={`${day} de ${month}, ${time}`}
    >
      <strong>{day}</strong>
      <span>{month}</span>
      <small>{time}</small>
    </time>
  );
}

function HeroCarousel({
  slides,
  onCategories,
  onCombos,
  onAction,
}: {
  slides: StoreCarouselSlide[];
  onCategories: () => void;
  onCombos: () => void;
  onAction: (slide: StoreCarouselSlide) => void;
}) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualChange, setManualChange] = useState(0);
  const [showDesktopArrows, setShowDesktopArrows] = useState(false);
  const reduceMotion = useReducedMotion();
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const slideCount = slides.length + 1;

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % slideCount),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [manualChange, paused, slideCount]);

  useEffect(() => {
    if (slide >= slideCount) setSlide(0);
  }, [slide, slideCount]);

  const current = slide === 0 ? null : (slides[slide - 1] ?? null);
  const selectSlide = (nextSlide: number) => {
    setSlide((nextSlide + slideCount) % slideCount);
    setManualChange((value) => value + 1);
  };
  const previousSlide = () => selectSlide(slide - 1);
  const nextSlide = () => selectSlide(slide + 1);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 700px)");
    const preloadForViewport = () =>
      preloadCarouselImages(slides, desktopMedia.matches);
    preloadForViewport();
    desktopMedia.addEventListener("change", preloadForViewport);
    return () => desktopMedia.removeEventListener("change", preloadForViewport);
  }, [slides]);

  useEffect(() => {
    const controlsMedia = window.matchMedia(
      "(min-width: 700px) and (hover: hover) and (pointer: fine)",
    );
    const updateDesktopControls = () =>
      setShowDesktopArrows(controlsMedia.matches);
    updateDesktopControls();
    controlsMedia.addEventListener("change", updateDesktopControls);
    return () =>
      controlsMedia.removeEventListener("change", updateDesktopControls);
  }, []);

  return (
    <section
      className={`hero-card ${current ? "has-custom-slide" : "hero-slide-default"}`}
      aria-roledescription="carrusel"
      aria-label="Novedades de JOMA Express"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button, a, input, select, textarea",
          )
        )
          return;
        const touch = event.changedTouches[0];
        touchOrigin.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const origin = touchOrigin.current;
        touchOrigin.current = null;
        if (!origin || slideCount < 2) return;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - origin.x;
        const deltaY = touch.clientY - origin.y;
        if (
          Math.abs(deltaX) < 42 ||
          Math.abs(deltaX) <= Math.abs(deltaY) * 1.15
        )
          return;
        if (deltaX < 0) nextSlide();
        else previousSlide();
      }}
      onTouchCancel={() => {
        touchOrigin.current = null;
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <AnimatePresence initial={false}>
        {current && (current.mobileImageUrl || current.desktopImageUrl) ? (
          <motion.picture
            className="hero-custom-picture"
            key={`hero-image-${slide}`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <source
              media="(min-width: 700px)"
              srcSet={current.desktopImageUrl || current.mobileImageUrl}
            />
            <img
              src={current.mobileImageUrl || current.desktopImageUrl}
              alt=""
            />
          </motion.picture>
        ) : null}
      </AnimatePresence>
      <div className="hero-carousel-stage">
        <AnimatePresence initial={false}>
          <motion.div
            className="hero-carousel-slide"
            key={slide}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {!current ? (
              <>
                <h1>
                  Tu compra diaria,
                  <br />
                  <em>sin vueltas.</em>
                </h1>
                <div className="hero-actions">
                  <button type="button" onClick={onCategories}>
                    Ver categorías <Icon name="arrow" />
                  </button>
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={onCombos}
                  >
                    Ver combos <Icon name="arrow" />
                  </button>
                </div>
                <LiveDateTime />
              </>
            ) : null}
            {current ? (
              <>
                {current.buttonLabel && current.targetType !== "none" ? (
                  <div className={`hero-actions align-${current.buttonAlign}`}>
                    <button type="button" onClick={() => onAction(current)}>
                      {current.buttonLabel} <Icon name="arrow" />
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="hero-carousel-controls">
        {slideCount > 1 && showDesktopArrows ? (
          <button
            type="button"
            className="hero-carousel-arrow is-previous"
            onClick={previousSlide}
            aria-label="Mostrar placa anterior"
          >
            <Icon name="arrow" />
          </button>
        ) : null}
        {slideCount > 1 ? (
          <div
            className="hero-carousel-dots"
            role="group"
            aria-label="Elegir placa"
          >
            {Array.from({ length: slideCount }, (_, index) => (
              <button
                type="button"
                key={index}
                className={slide === index ? "is-active" : ""}
                onClick={() => selectSlide(index)}
                aria-label={`Mostrar placa ${index + 1}`}
                aria-current={slide === index ? "true" : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="hero-carousel-dots" aria-hidden="true" />
        )}
        {slideCount > 1 && showDesktopArrows ? (
          <button
            type="button"
            className="hero-carousel-arrow"
            onClick={nextSlide}
            aria-label="Mostrar placa siguiente"
          >
            <Icon name="arrow" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function StoreInfoPage({
  page,
  onBack,
}: {
  page: InfoPage;
  onBack: () => void;
}) {
  const content: Record<InfoPage, { title: string; body: React.ReactNode }> = {
    envios: {
      title: "Envíos en Corrientes Capital",
      body: (
        <>
          <p>
            Realizamos entregas programadas dentro de Corrientes Capital. Al
            confirmar tu compra podrás elegir entre las fechas y franjas
            disponibles.
          </p>
          <p>
            La cobertura se valida con la dirección del pedido. Por el momento
            no realizamos entregas en otras localidades.
          </p>
        </>
      ),
    },
    locales: {
      title: "Nuestros locales en Corrientes",
      body: (
        <>
          <h2>Joma Group</h2>
          <p>
            Distribuidora, mayorista y tienda online con atención en Av. Maipú
            7249, Corrientes Capital.
          </p>
          <h2>Jónico</h2>
          <p>
            Jónico Supermercado Mayorista y Minorista es una empresa vinculada,
            con operación y presencia propias junto a Joma Group.
          </p>
        </>
      ),
    },
    nosotros: {
      title: "Joma Group",
      body: (
        <p>
          Somos una empresa de Corrientes dedicada a la distribución y venta
          mayorista y minorista de productos de consumo diario. Nuestra tienda
          online permite consultar el catálogo y preparar pedidos desde
          cualquier dispositivo.
        </p>
      ),
    },
    contacto: {
      title: "Contacto",
      body: (
        <>
          <p>
            <strong>Dirección:</strong> Av. Maipú 7249, Corrientes Capital.
          </p>
          <p>
            <strong>Teléfono:</strong>{" "}
            <a href="tel:+543794390919">0379 439-0919</a>
          </p>
        </>
      ),
    },
    privacidad: {
      title: "Política de privacidad",
      body: (
        <>
          <p>
            Utilizamos los datos que ingresás para gestionar tu cuenta, preparar
            pedidos, coordinar entregas y responder consultas. No vendemos
            información personal a terceros.
          </p>
          <p>
            Podés solicitar la actualización o eliminación de tus datos
            contactando a Joma Group.
          </p>
        </>
      ),
    },
  };
  return (
    <section className="store-info-page">
      <button type="button" className="store-info-back" onClick={onBack}>
        <Icon name="arrow" /> Volver a la tienda
      </button>
      <h1>{content[page].title}</h1>
      {content[page].body}
    </section>
  );
}

function ProductList({
  products,
  eagerCount = 2,
}: {
  products: Product[];
  eagerCount?: number;
}) {
  useEffect(() => {
    products.slice(eagerCount, eagerCount + 3).forEach((product) => {
      if (
        !product.imageUrl ||
        (product.categoryId === "combos" && /^P/i.test(product.id.trim()))
      )
        return;
      const image = new Image();
      image.src = product.imageUrl;
    });
  }, [products, eagerCount]);
  const isOutOfStock = (product: Product) =>
    !product.active ||
    (Number.isFinite(product.stockReal) && Number(product.stockReal) <= 0);
  const firstOutOfStockIndex = products.findIndex(isOutOfStock);

  return (
    <div className="product-list">
      {products.map((product, index) => (
        <Fragment key={product.id}>
          {index === firstOutOfStockIndex ? (
            <div className="product-stock-divider" role="separator">
              <span>Sin stock</span>
            </div>
          ) : null}
          <ProductCard product={product} eager={index < eagerCount} />
        </Fragment>
      ))}
    </div>
  );
}

function CategoryGrid({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
}) {
  return (
    <div className="category-grid">
      {categories.map((category) => (
        <button
          type="button"
          className="category-card"
          onClick={() => onSelect(category)}
          key={category.id}
        >
          <span className="category-copy">
            <strong>{category.name}</strong>
            <em>
              {category.count}{" "}
              {category.count === 1
                ? "producto disponible"
                : "productos disponibles"}
            </em>
          </span>
          <span className="category-arrow">
            <Icon name="arrow" />
          </span>
        </button>
      ))}
    </div>
  );
}

function DesktopCategoryRail({
  categories,
  selectedCategory,
  tab,
  onShowAll,
  onSelect,
}: {
  categories: Category[];
  selectedCategory: Category | null;
  tab: Tab;
  onShowAll: () => void;
  onSelect: (category: Category) => void;
}) {
  return (
    <aside
      className="desktop-rail desktop-category-rail"
      aria-label="Categorías"
    >
      <div className="desktop-rail-panel">
        <header>
          <div>
            <span>Explorar</span>
            <h2>Categorías</h2>
          </div>
        </header>
        <nav>
          <button
            type="button"
            className={
              tab === "categories" && !selectedCategory ? "is-active" : ""
            }
            onClick={onShowAll}
          >
            <span>
              <strong>Todas las categorías</strong>
              <small>Ver el listado completo</small>
            </span>
            <Icon name="arrow" />
          </button>
          {categories.map((category) => (
            <button
              type="button"
              className={
                selectedCategory?.id === category.id ? "is-active" : ""
              }
              onClick={() => onSelect(category)}
              key={category.id}
            >
              <span>
                <strong>{category.name}</strong>
                <small>{category.count} disponibles</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function DesktopCartRail({ onOpenCart }: { onOpenCart: () => void }) {
  const { user } = useAuth();
  const items = useCartStore((state) => state.items);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const appliedCode = useCartStore((state) => state.appliedDiscountCode);
  const setAppliedCode = useCartStore((state) => state.setAppliedDiscountCode);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const total = items.reduce((sum, item) => sum + getCartItemPricing(item).total, 0);
  const finalTotal = Math.max(0, total - Number(appliedCode?.discountAmount || 0));

  useEffect(() => {
    if (!appliedCode || !items.length) return;
    let active = true;
    void getActiveCatalog().then((catalog) => {
      if (!active) return;
      const productsById = new Map<string, DiscountProduct>(catalog.map((product) => [product.id, product]));
      const recalculated = calculateDiscount(appliedCode, items, productsById);
      setAppliedCode(recalculated.eligibleItemIds.length ? recalculated : null);
    });
    return () => { active = false; };
  }, [items, appliedCode?.code, appliedCode?.percentage, setAppliedCode]);

  const applyCoupon = async () => {
    if (!couponInput.trim() || applyingCoupon) return;
    setApplyingCoupon(true);
    setCouponError("");
    try {
      const catalog = await getActiveCatalog();
      const productsById = new Map<string, DiscountProduct>(catalog.map((product) => [product.id, product]));
      setAppliedCode(await validateDiscountCode(couponInput, items, productsById, user?.uid));
      setCouponInput("");
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "No pudimos aplicar el código.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  return (
    <aside className="desktop-rail desktop-cart-rail" aria-label="Carrito">
      <div className="desktop-rail-panel">
        <header>
          <div>
            <span>Tu compra</span>
            <h2>Carrito</h2>
          </div>
          {items.length ? (
            <button
              type="button"
              className="desktop-cart-clear"
              onClick={clear}
            >
              Vaciar
            </button>
          ) : null}
        </header>
        {!items.length ? (
          <div className="desktop-cart-empty">
            <Icon name="cart" />
            <strong>Tu carrito está vacío</strong>
            <span>Los productos que agregues aparecerán acá.</span>
          </div>
        ) : (
          <div className="desktop-cart-items">
            {items.map((item) => {
              const remaining = getRemainingStock(
                items,
                item.productId,
                item.stockLimit,
              );
              const canAdd =
                remaining === undefined ||
                remaining >= getCartItemUnits({ ...item, qty: 1 });
              const pricing = getCartItemPricing(item);
              const eligibleSubtotal = Number(appliedCode?.eligibleSubtotalByItem?.[item.id] || 0);
              const itemDiscount = eligibleSubtotal * Number(appliedCode?.percentage || 0) / 100;
              const itemTotal = Math.max(0, pricing.total - itemDiscount);
              return (
                <article key={item.id} className={itemDiscount > 0 ? "has-coupon" : ""}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.label}</span>
                  </div>
                  <div className="desktop-cart-line-price">
                    {itemDiscount > 0 ? <del>{money.format(pricing.total)}</del> : null}
                    <b>{money.format(itemTotal)}</b>
                    {itemDiscount > 0 ? <small>Cupón {appliedCode?.percentage}%</small> : null}
                  </div>
                  <div className="desktop-cart-actions">
                    <button
                      type="button"
                      onClick={() => setItemQty(item.id, item.qty - 1)}
                      aria-label={`Disminuir ${item.name}`}
                    >
                      <Icon name="minus" />
                    </button>
                    <output>{item.qty}</output>
                    <button
                      type="button"
                      onClick={() => setItemQty(item.id, item.qty + 1)}
                      disabled={!canAdd}
                      aria-label={`Aumentar ${item.name}`}
                    >
                      <Icon name="plus" />
                    </button>
                    <button
                      type="button"
                      className="desktop-cart-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Quitar ${item.name}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <footer>
          {items.length ? <div className={`desktop-cart-coupon ${appliedCode ? "is-valid" : couponError ? "is-invalid" : ""}`}>
            {appliedCode ? <div className="desktop-cart-coupon-applied"><span><b>{appliedCode.code}</b><small>{appliedCode.percentage}% aplicado</small></span><button type="button" onClick={() => { setAppliedCode(null); setCouponError(""); }}>Quitar</button></div> : <><label htmlFor="desktop-cart-coupon-input">Código de descuento</label><div><input id="desktop-cart-coupon-input" value={couponInput} onChange={(event) => { const value = event.target.value.toLocaleUpperCase("es-AR"); setCouponInput(value); if (!value.trim()) setCouponError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void applyCoupon(); }} placeholder="Ingresá tu código" autoCapitalize="characters" maxLength={24}/><button type="button" onClick={() => void applyCoupon()} disabled={applyingCoupon || !couponInput.trim()}>{applyingCoupon ? "..." : "Aplicar"}</button></div>{couponError ? <small className="desktop-cart-coupon-error" role="alert">{couponError}</small> : null}</>}
          </div> : null}
          <div className="desktop-cart-total-row">
            <span>Subtotal</span>
            <strong>{money.format(total)}</strong>
          </div>
          {appliedCode ? <div className="desktop-cart-discount-row"><span>Descuento ({appliedCode.percentage}%)</span><b>− {money.format(appliedCode.discountAmount)}</b></div> : null}
          <div className="desktop-cart-total-row is-final"><span>Total</span><strong>{money.format(finalTotal)}</strong></div>
          <button type="button" onClick={onOpenCart} disabled={!items.length}>
            Revisar y confirmar
          </button>
        </footer>
      </div>
    </aside>
  );
}

function StoreApp({
  catalog,
  initialTab = "home",
  initialInfo = "envios",
  initialCategoryId = "",
  onRequestLogin,
  onRequestBusinessLogin,
  onSessionClosed,
}: {
  catalog: ReturnType<typeof createRemoteCatalog>;
  initialTab?: Tab;
  initialInfo?: InfoPage;
  initialCategoryId?: string;
  onRequestLogin: (mode?: "login" | "signup") => void;
  onRequestBusinessLogin: (mode?: "login" | "signup") => void;
  onSessionClosed: () => void;
}) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [infoPage, setInfoPage] = useState<InfoPage>(initialInfo);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);
  const [carouselSlides, setCarouselSlides] = useState<StoreCarouselSlide[]>(
    [],
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      useCartStore.getState().setDailyOfferUsage({});
      return;
    }
    let active = true;
    let lastForegroundSyncAt = 0;
    const syncOfferUsage = (force = false) => {
      if (force) lastForegroundSyncAt = Date.now();
      void getDailyOfferUsage(user.uid, force).then((usage) => {
        if (active) useCartStore.getState().setDailyOfferUsage(usage);
      }).catch((error) => console.warn("No se pudo actualizar el cupo diario de ofertas", error));
    };
    syncOfferUsage(true);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastForegroundSyncAt > 5_000) syncOfferUsage(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user]);

  useEffect(() => {
    const requestedSearch = new URLSearchParams(window.location.search).get("q")?.trim();
    if (requestedSearch) {
      setQuery(requestedSearch);
      setTab("search");
    }
  }, []);
  const pendingStoreRefresh = useRef(false);
  const activeScreen = useRef(
    `${initialTab}:${initialCategoryId}:${initialInfo}`,
  );
  const categoryGridScroll = useRef(0);
  const pendingCategoryScroll = useRef<number | null>(null);
  const initialCategoryApplied = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const items = useCartStore((state) => state.items);
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items],
  );
  const cartTotal = useMemo(
    () => items.reduce((sum, item) => sum + getCartItemPricing(item).total, 0),
    [items],
  );

  useEffect(() => {
    setDocumentMetadata(
      "Joma Group | Mayorista y tienda online en Corrientes",
      "Mayorista y tienda online de alimentos, bebidas y productos de consumo diario en Corrientes Capital.",
      "/",
      tab === "cart" || tab === "profile" || tab === "search",
    );
  }, [tab]);

  const loadInitial = () => {
    const controller = new AbortController();
    setInitialLoading(true);
    setInitialError("");
    Promise.all([
      catalog.getManifest(controller.signal),
      catalog.getFeaturedProducts(controller.signal),
      catalog.getOfferProducts(controller.signal),
      getStoreCarouselSlides(),
    ])
      .then(
        ([
          nextManifest,
          featuredProducts,
          offerProducts,
          nextCarouselSlides,
        ]) => {
          setManifest(nextManifest);
          setFeatured(featuredProducts);
          setOffers(offerProducts);
          setCarouselSlides(nextCarouselSlides);
        },
      )
      .catch((error) => {
        if (!controller.signal.aborted)
          setInitialError(
            error instanceof Error ? error.message : "Error inesperado.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitialLoading(false);
      });
    return controller;
  };

  useEffect(() => {
    const controller = loadInitial();
    return () => controller.abort();
  }, [catalog, catalogRevision]);

  useEffect(() => {
    if (initialCategoryApplied.current || !initialCategoryId || !manifest) return;
    initialCategoryApplied.current = true;
    const initialCategory = manifest.categories.find((category) => category.id === initialCategoryId);
    if (!initialCategory) return;
    setSelectedCategory(initialCategory);
    setTab("categories");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [initialCategoryId, manifest]);

  useEffect(
    () =>
      subscribeToStoreConfig(() => {
        pendingStoreRefresh.current = true;
      }),
    [],
  );

  useEffect(() => {
    const checkForUpdates = catalog.checkForUpdates;
    if (!checkForUpdates) return;
    let checking = false;
    let lastCheckAt = Date.now();
    const checkCatalogVersion = async () => {
      const now = Date.now();
      if (checking || now - lastCheckAt < 5 * 60 * 1000) return;
      checking = true;
      lastCheckAt = now;
      try {
        if (await checkForUpdates())
          pendingStoreRefresh.current = true;
      } catch {
        /* se conserva el catálogo cacheado */
      } finally {
        checking = false;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkCatalogVersion();
    };
    const timer = window.setInterval(
      () => void checkCatalogVersion(),
      5 * 60 * 1000,
    );
    window.addEventListener("focus", checkCatalogVersion);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkCatalogVersion);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [catalog]);

  useEffect(() => {
    const nextScreen = `${tab}:${selectedCategory?.id ?? ""}:${infoPage}`;
    if (activeScreen.current === nextScreen) return;
    activeScreen.current = nextScreen;
    if (!pendingStoreRefresh.current) return;
    pendingStoreRefresh.current = false;
    setCatalogRevision((current) => current + 1);
  }, [infoPage, selectedCategory?.id, tab]);

  useEffect(() => {
    if (!selectedCategory) {
      setCategoryProducts([]);
      return;
    }
    const controller = new AbortController();
    setCategoryLoading(true);
    setCategoryError("");
    catalog
      .getCategoryProducts(selectedCategory.id, controller.signal)
      .then(setCategoryProducts)
      .catch((error) => {
        if (!controller.signal.aborted)
          setCategoryError(
            error instanceof Error ? error.message : "Error inesperado.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoryLoading(false);
      });
    return () => controller.abort();
  }, [catalog, selectedCategory, catalogRevision]);

  useEffect(() => {
    if (tab !== "search") return;
    window.setTimeout(() => {
      const input = searchRef.current;
      if (!input || document.activeElement === input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }, 80);
  }, [tab]);

  useEffect(() => {
    if (tab === "search") return;
    setQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError("");
  }, [tab]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      catalog
        .searchProducts(value, controller.signal)
        .then(setSearchResults)
        .catch((error) => {
          if (!controller.signal.aborted)
            setSearchError(
              error instanceof Error ? error.message : "Error inesperado.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, query]);

  const restoreCategoryGridScroll = () => {
    pendingCategoryScroll.current = categoryGridScroll.current;
    setSelectedCategory(null);
  };

  useEffect(() => {
    if (
      tab !== "categories" ||
      selectedCategory ||
      pendingCategoryScroll.current === null
    )
      return;
    const scrollTop = pendingCategoryScroll.current;
    pendingCategoryScroll.current = null;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: scrollTop, behavior: "auto" }),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCategory, tab]);

  useEffect(() => {
    const handlePopState = () => {
      setQuery("");
      if (selectedCategory) restoreCategoryGridScroll();
      else if (tab !== "home") {
        setMenuOpen(false);
        setTab("home");
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedCategory, tab]);

  useEffect(() => {
    if (tab === "home") return;
    const handleTouchStart = (event: TouchEvent) => {
      if (document.querySelector(".checkout-sheet, .delivery-map-view")) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      swipeStart.current = touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
    };
    const handleTouchEnd = (event: TouchEvent) => {
      if (document.querySelector(".checkout-sheet, .delivery-map-view")) {
        swipeStart.current = null;
        return;
      }
      const start = swipeStart.current;
      const touch = event.changedTouches[0];
      swipeStart.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (dx < -80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        setQuery("");
        if (selectedCategory) {
          if (window.history.state?.jomaView === "category")
            window.history.back();
          else restoreCategoryGridScroll();
        } else {
          setMenuOpen(false);
          setSelectedCategory(null);
          setTab("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    };
    const app = document.querySelector<HTMLElement>(".store-app");
    app?.addEventListener("touchstart", handleTouchStart, { passive: true });
    app?.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      app?.removeEventListener("touchstart", handleTouchStart);
      app?.removeEventListener("touchend", handleTouchEnd);
    };
  }, [selectedCategory, tab]);

  const goTo = (next: Tab) => {
    setMenuOpen(false);
    setSelectedCategory(null);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openInfo = (page: InfoPage) => {
    window.history.pushState(
      { ...window.history.state, jomaView: "info", infoPage: page },
      "",
      `/?info=${page}`,
    );
    setMenuOpen(false);
    setSelectedCategory(null);
    setInfoPage(page);
    setTab("info");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const closeInfo = () => {
    if (window.history.state?.jomaView === "info") window.history.back();
    else {
      window.history.replaceState(
        { ...window.history.state, jomaView: "home" },
        "",
        "/",
      );
      goTo("home");
    }
  };
  const openCategory = (category: Category) => {
    if (!selectedCategory && tab === "categories")
      categoryGridScroll.current = window.scrollY;
    if (!selectedCategory) {
      window.history.pushState(
        {
          ...window.history.state,
          jomaView: "category",
          categoryId: category.id,
        },
        "",
      );
    } else {
      window.history.replaceState(
        {
          ...window.history.state,
          jomaView: "category",
          categoryId: category.id,
        },
        "",
      );
    }
    setSelectedCategory(category);
    setTab("categories");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navigateBack = () => {
    setQuery("");
    if (selectedCategory) {
      if (window.history.state?.jomaView === "category") window.history.back();
      else restoreCategoryGridScroll();
      return;
    }
    goTo("home");
  };
  const openCombos = () =>
    openCategory(
      manifest?.categories.find((category) => category.id === "combos") ?? {
        id: "combos",
        name: "Combos",
        description: "Promociones de la app",
        color: "#d92822",
        image: "/joma-express-icon.png",
        count: 0,
      },
    );
  const openCarouselDestination = (slide: StoreCarouselSlide) => {
    if (slide.targetType === "categories") return goTo("categories");
    if (slide.targetType === "cart") return goTo("cart");
    if (slide.targetType === "category") {
      const category = manifest?.categories.find(
        (item) => item.id === slide.targetValue,
      );
      if (category) openCategory(category);
      return;
    }
    if (slide.targetType === "search") {
      setQuery(slide.targetValue);
      setSelectedCategory(null);
      setTab("search");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeSession = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    onSessionClosed();
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={`store-app ${tab === "business" ? "is-business-section" : ""}`}>
      <div className="top-shell">
        <header className="app-header">
          <div className="app-header__leading">
            <button type="button" className={`menu-button ${menuOpen ? "is-active" : ""}`} onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menú" aria-expanded={menuOpen}><Icon name="menu" /><span className="header-action-label">Menú</span></button>
            <button type="button" className={`business-header-button ${tab === "business" ? "is-active" : ""}`} onClick={() => goTo("business")} aria-label="Ingresar a JOMA para comercios" title="JOMA para comercios"><Icon name="store" /><span className="header-action-label">Tu Comercio</span></button>
          </div>
          <button
            type="button"
            className="brand-lockup"
            onClick={() => goTo("home")}
            aria-label="JOMA Express. Ir al inicio"
          >
            <img
              src="/joma-express-white.png"
              alt="JOMA Express"
              width="776"
              height="329"
            />
          </button>
          <div className="app-header__actions">
            <a
              className="header-whatsapp"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Consultar por WhatsApp"
              title="Consultar por WhatsApp"
            >
              <WhatsAppIcon />
              <span className="header-action-label">Consultas</span>
            </a>
            <button
              type="button"
              className={`header-cart ${tab === "cart" ? "is-active" : ""}`}
              onClick={() => goTo("cart")}
              aria-label={`Abrir carrito. ${itemCount} productos`}
            >
              <Icon name="cart" />
              <span className="header-action-label">Carrito</span>
              {itemCount ? <b>{itemCount > 99 ? "99+" : itemCount}</b> : null}
            </button>
          </div>
        </header>
        <div className={`search-dock ${tab !== "home" ? "has-back" : ""}`}>
          {tab !== "home" ? (
            <button
              type="button"
              className="search-back-button"
              onClick={navigateBack}
              aria-label={
                selectedCategory
                  ? "Volver a todas las categorías"
                  : "Volver al inicio"
              }
            >
              <Icon name="arrow" />
            </button>
          ) : null}
          <div className="top-search">
            <Icon name="search" />
            <input
              ref={searchRef}
              value={query}
              onFocus={() => {
                if (tab !== "search") goTo("search");
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                if (tab !== "search") setTab("search");
              }}
              placeholder="¿Qué necesitás?"
              aria-label="Buscar productos"
            />
            {query ? <button type="button" className="search-clear-button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSearchResults([]); setSearchError(""); requestAnimationFrame(() => searchRef.current?.focus()); }} aria-label="Borrar búsqueda"><Icon name="close" /></button> : <span className={searchLoading ? "tiny-spinner" : ""} />}
          </div>
          <NotificationBell
            onSearch={(value) => { setQuery(value); goTo("search"); }}
            onOpenCatalog={() => goTo("categories")}
            onOpenCart={() => goTo("cart")}
            onOpenProduct={(productId) => window.location.assign(`/producto/${encodeURIComponent(productId)}`)}
          />
        </div>
        <AnimatePresence>
          {menuOpen ? (
            <>
              <motion.button
                type="button"
                className="drawer-scrim"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.nav
                className="header-menu"
                aria-label="Menú principal"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="drawer-head">
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    <Icon name="close" />
                  </button>
                  <img
                    src="/joma-express-white.png"
                    alt="JOMA Express"
                    width="776"
                    height="329"
                  />
                </div>
                <div className="drawer-content">
                  <button
                    type="button"
                    onClick={() => {
                      if (user) goTo("profile");
                      else {
                        setMenuOpen(false);
                        onRequestLogin();
                      }
                    }}
                  >
                    <Icon name="user" />
                    <span>
                      <strong>{user ? "Perfil" : "Iniciar sesión"}</strong>
                      <small>
                        {user
                          ? "Mis datos y dirección"
                          : "Ingresar a tu cuenta"}
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                  <hr />
                  <button type="button" onClick={() => goTo("categories")}>
                    <Icon name="grid" />
                    <span>
                      <strong>Categorías</strong>
                      <small>Explorar productos</small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                  <button type="button" onClick={() => goTo("business")}>
                    <Icon name="store" />
                    <span>
                      <strong>Registrar tu comercio</strong>
                      <small>Accedé a beneficios para comercios</small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                  <button type="button" onClick={() => goTo("coupons")}>
                    <Icon name="ticket" />
                    <span><strong>Mis cupones</strong><small>Ver beneficios vigentes</small></span>
                    <Icon name="arrow" />
                  </button>
                  <a className="drawer-public-link drawer-whatsapp-link" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="drawer-whatsapp-icon" />
                    <span>
                      <strong>Consultas</strong>
                      <small>Escribinos y te ayudamos</small>
                    </span>
                    <Icon name="arrow" />
                  </a>
                  <button
                    type="button"
                    className={`drawer-logout ${user && !loggingOut ? "is-active" : "is-disabled"} ${loggingOut ? "is-closing" : ""}`}
                    disabled={!user || loggingOut}
                    aria-busy={loggingOut}
                    onClick={() => void closeSession()}
                  >
                    {loggingOut ? (
                      <span
                        className="drawer-action-spinner"
                        aria-hidden="true"
                      />
                    ) : (
                      <Icon name="logout" />
                    )}
                    <span aria-live="polite">
                      <strong>
                        {loggingOut ? "Cerrando…" : "Cerrar sesión"}
                      </strong>
                      <small>
                        {loggingOut
                          ? "Un momento"
                          : user
                            ? "Salir de esta cuenta"
                            : "Sesión cerrada"}
                      </small>
                    </span>
                    {loggingOut ? <span /> : <Icon name="arrow" />}
                  </button>
                </div>
              </motion.nav>
            </>
          ) : null}
        </AnimatePresence>
      </div>

      <div className={`desktop-layout ${tab === "cart" ? "is-cart-view" : ""} ${tab === "business" ? "is-business-view" : ""}`}>
        <DesktopCategoryRail
          categories={manifest?.categories ?? []}
          selectedCategory={selectedCategory}
          tab={tab}
          onShowAll={() => goTo("categories")}
          onSelect={openCategory}
        />
        <main id="main-content" className={itemCount ? "has-mini-cart" : ""}>
          <AnimatePresence mode="popLayout" initial={false}>
            {tab === "home" ? (
              <motion.div
                className="view"
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <HeroCarousel
                  slides={carouselSlides}
                  onCategories={() => goTo("categories")}
                  onCombos={openCombos}
                  onAction={openCarouselDestination}
                />
                <section>
                  <div className="section-heading">
                    <div>
                      <span>Elegidos para vos</span>
                      <h2>Destacados</h2>
                    </div>
                    <button type="button" onClick={() => goTo("categories")}>
                      Ver todo
                    </button>
                  </div>
                  {initialLoading ? (
                    <ProductSkeletons />
                  ) : initialError ? (
                    <ErrorState message={initialError} retry={loadInitial} />
                  ) : (
                    <ProductList
                      products={featured}
                      eagerCount={Math.min(featured.length, 4)}
                    />
                  )}
                </section>
                {initialLoading || offers.length ? (
                  <section className="home-offers-section">
                    <div className="section-heading">
                      <div>
                        <span>Precios especiales</span>
                        <h2>Ofertas</h2>
                      </div>
                    </div>
                    {initialLoading ? (
                      <ProductSkeletons count={2} />
                    ) : (
                      <ProductList products={offers} />
                    )}
                  </section>
                ) : null}
              </motion.div>
            ) : null}

            {tab === "categories" ? (
              <motion.div
                className="view"
                key={`categories-${selectedCategory?.id ?? "grid"}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {selectedCategory ? (
                  <section>
                    <div className="section-heading category-title">
                      <div>
                        <span>{selectedCategory.description}</span>
                        <h1>{selectedCategory.name}</h1>
                      </div>
                      <b>{selectedCategory.count}</b>
                    </div>
                    {categoryLoading ? (
                      <ProductSkeletons />
                    ) : categoryError ? (
                      <ErrorState
                        message={categoryError}
                        retry={() => {
                          const current = selectedCategory;
                          setSelectedCategory(null);
                          requestAnimationFrame(() =>
                            setSelectedCategory(current),
                          );
                        }}
                      />
                    ) : categoryProducts.length ? (
                      <ProductList products={categoryProducts} />
                    ) : (
                      <div className="empty-inline">
                        No hay productos en esta categoría.
                      </div>
                    )}
                  </section>
                ) : (
                  <section>
                    <div className="page-intro">
                      <span>Explorá sin apuro</span>
                      <h1>Categorías</h1>
                      <p>
                        Elegí una sección y descargamos únicamente esos
                        productos.
                      </p>
                    </div>
                    {initialLoading ? (
                      <div className="category-grid">
                        {[1, 2, 3].map((n) => (
                          <div
                            className="category-card skeleton-category"
                            key={n}
                          />
                        ))}
                      </div>
                    ) : initialError ? (
                      <ErrorState message={initialError} retry={loadInitial} />
                    ) : (
                      <CategoryGrid
                        categories={manifest?.categories ?? []}
                        onSelect={openCategory}
                      />
                    )}
                  </section>
                )}
              </motion.div>
            ) : null}

            {tab === "search" ? (
              <motion.div
                className="view"
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <section>
                  {query.length < 2 ? (
                    <div className="search-start">
                      <p>Probá con</p>
                      <div>
                        {["Aceite", "Yerba", "Gaseosa", "Limpieza"].map(
                          (term) => (
                            <button
                              type="button"
                              onClick={() => setQuery(term)}
                              key={term}
                            >
                              {term}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : searchError ? (
                    <ErrorState
                      message={searchError}
                      retry={() => setQuery((value) => `${value} `)}
                    />
                  ) : !searchLoading && !searchResults.length ? (
                    <div className="empty-state compact-empty">
                      <div className="empty-icon">
                        <Icon name="search" />
                      </div>
                      <h2>Sin coincidencias</h2>
                      <p>Probá con otra palabra o revisá cómo está escrito.</p>
                    </div>
                  ) : (
                    <>
                      <div className="result-count">
                        {searchResults.length}{" "}
                        {searchResults.length === 1
                          ? "resultado"
                          : "resultados"}
                      </div>
                      <ProductList products={searchResults} />
                    </>
                  )}
                </section>
              </motion.div>
            ) : null}

            {tab === "cart" ? (
              <motion.div
                className="view"
                key="cart"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <CartView
                  onContinue={() => goTo("home")}
                  onRequireAuth={onRequestLogin}
                />
              </motion.div>
            ) : null}
            {tab === "profile" ? (
              <motion.div
                className="view"
                key="profile"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                {user ? (
                  <ProfileView onOpenBusiness={() => goTo("business")} />
                ) : (
                  <section className="empty-state">
                    <h2>Ingresá para ver tu perfil</h2>
                    <p>Tu cuenta guarda direcciones y pedidos.</p>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => onRequestLogin("login")}
                    >
                      Iniciar sesión
                    </button>
                  </section>
                )}
              </motion.div>
            ) : null}
            {tab === "business" ? (
              <motion.div className="view" key="business" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <BusinessPage onLogin={onRequestBusinessLogin} onBackToStore={() => goTo("home")} />
              </motion.div>
            ) : null}
            {tab === "coupons" ? <motion.div className="view" key="coupons" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><MyCouponsPage onLogin={() => onRequestLogin("login")} onUse={(code) => { window.localStorage.setItem("joma.pendingCoupon", code); window.dispatchEvent(new CustomEvent("joma:coupon-selected", { detail: code })); goTo("cart"); }} /></motion.div> : null}
            {tab === "info" ? (
              <motion.div
                className="view"
                key={`info-${infoPage}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <StoreInfoPage page={infoPage} onBack={closeInfo} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
        {tab !== "cart" && tab !== "business" && tab !== "coupons" ? <DesktopCartRail onOpenCart={() => goTo("cart")} /> : null}
      </div>

      {tab === "home" ? <StoreInfoFooter onSelect={openInfo} /> : null}
      {tab !== "business" ? <StoreCreditBar /> : null}

      {itemCount && tab !== "cart" ? (
        <button
          type="button"
          className="mini-cart"
          onClick={() => goTo("cart")}
          aria-label={`Abrir carrito. Subtotal ${money.format(cartTotal)}`}
        >
          <span>Subtotal</span>
          <strong>{money.format(cartTotal)}</strong>
        </button>
      ) : null}
    </div>
  );
}

export function App() {
  const { user, loading } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const catalog = useMemo(() => createRemoteCatalog(), []);
  const [splashMinimumElapsed, setSplashMinimumElapsed] = useState(false);
  const [location, setLocation] = useState(
    () => `${window.location.pathname}${window.location.search}`,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setSplashMinimumElapsed(true), 520);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const syncLocation = () =>
      setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);
  const currentUrl = new URL(location, window.location.origin);
  const path = currentUrl.pathname.replace(/\/+$/, "") || "/";
  const params = currentUrl.searchParams;
  const infoParam = params.get("info");
  const initialInfo: InfoPage =
    infoParam === "locales" ||
    infoParam === "nosotros" ||
    infoParam === "contacto" ||
    infoParam === "privacidad"
      ? infoParam
      : "envios";
  const loginRequested = params.get("login") === "1";
  const passwordResetCode = params.get("mode") === "resetPassword" ? params.get("oobCode") ?? "" : "";
  const requestLogin = (mode: "login" | "signup" = "login") => {
    const nextLocation = `/?login=1&mode=${mode}`;
    window.history.pushState(
      { ...window.history.state, jomaView: "login" },
      "",
      nextLocation,
    );
    setLocation(nextLocation);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const requestBusinessLogin = (mode: "login" | "signup" = "login") => {
    const nextLocation = `/?login=1&mode=${mode}&return=business`;
    window.history.pushState(
      { ...window.history.state, jomaView: "login" },
      "",
      nextLocation,
    );
    setLocation(nextLocation);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const remainInStoreAfterLogout = () => {
    const storeUrl = new URL(window.location.href);
    storeUrl.searchParams.delete("login");
    const nextLocation = `${storeUrl.pathname}${storeUrl.search}`;
    window.history.replaceState(
      { ...window.history.state, jomaView: "store" },
      "",
      nextLocation,
    );
    setLocation(nextLocation);
  };
  useEffect(() => {
    if (loginRequested)
      setDocumentMetadata(
        "Iniciar sesión | Joma Group",
        "Acceso de clientes de Joma Group.",
        "/",
        true,
      );
  }, [loginRequested]);
  useEffect(() => {
    if (!user || params.get("return") !== "business") return;
    const nextLocation = "/?view=business";
    window.history.replaceState({ ...window.history.state, jomaView: "business" }, "", nextLocation);
    setLocation(nextLocation);
  }, [user, location]);
  const content = passwordResetCode ? (
      <PasswordResetPage code={passwordResetCode} />
    ) : loginRequested && !loading && !user ? (
      <AuthWelcome initialMode={params.get("mode") === "signup" ? "signup" : "login"} />
    ) : path === "/" ? (
      <StoreApp
        catalog={catalog}
        initialTab={
          infoParam
            ? "info"
            : params.get("view") === "cart"
              ? "cart"
              : params.get("view") === "search"
                ? "search"
                : params.get("view") === "profile"
                  ? "profile"
                  : params.get("view") === "business"
                    ? "business"
                  : params.get("view") === "coupons"
                    ? "coupons"
                  : params.get("view") === "categories"
                    ? "categories"
                    : "home"
        }
        initialInfo={initialInfo}
        initialCategoryId={params.get("category") ?? ""}
        onRequestLogin={requestLogin}
        onRequestBusinessLogin={requestBusinessLogin}
        onSessionClosed={remainInStoreAfterLogout}
      />
    ) : (
      <PublicRoutePage catalog={catalog} path={path} />
    );

  return (
    <>
      <CartExpiryGuard allowPrompt={Boolean(user) && !loading} />
      {content}
      <AnimatePresence>
        {!splashMinimumElapsed || loading ? (
          <motion.div
            className="startup-splash"
            role="status"
            aria-label="Cargando Joma Group"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="startup-splash__mark" aria-hidden="true">
              <span className="startup-splash__orbit" />
              <img src="/joma-express-black.png" alt="" width="800" height="329" />
            </div>
            <div className="startup-splash__status">
              <span>Preparando tu tienda</span>
              <span className="startup-splash__track" aria-hidden="true">
                <i />
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
