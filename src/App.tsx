import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { CatalogManifest, Category, Product } from "@/catalog/types";
import { getCartItemUnits, getRemainingStock, useCartStore } from "@/store/cart";
import { CartView } from "@/components/CartView";
import { Icon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { ProfileView } from "@/components/ProfileView";
import { AuthLoading, AuthWelcome } from "@/components/AuthWelcome";
import { useAuth } from "@/auth/AuthProvider";
import { getStoreCarouselSlides, type StoreCarouselSlide } from "@/lib/featuredProducts";

type Tab = "home" | "categories" | "search" | "cart" | "profile";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
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
  return <div className="product-list" aria-label="Cargando productos" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="product-card skeleton-card" key={index}><div className="skeleton-block image"/><div className="skeleton-lines"><i/><i/><i/><div/></div></div>)}</div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-state" role="alert"><Icon name="refresh"/><h3>No pudimos cargar</h3><p>{message}</p><button type="button" onClick={retry}>Reintentar</button></div>;
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
  return <time className="hero-live-clock" dateTime={now.toISOString()} aria-label={`${day} de ${month}, ${time}`}>
    <strong>{day}</strong>
    <span>{month}</span>
    <small>{time}</small>
  </time>;
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
  const slideCount = slides.length + 1;

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slideCount), 5000);
    return () => window.clearInterval(timer);
  }, [paused, slideCount]);

  useEffect(() => {
    if (slide >= slideCount) setSlide(0);
  }, [slide, slideCount]);

  const current = slide === 0 ? null : slides[slide - 1] ?? null;

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 700px)");
    const preloadForViewport = () => preloadCarouselImages(slides, desktopMedia.matches);
    preloadForViewport();
    desktopMedia.addEventListener("change", preloadForViewport);
    return () => desktopMedia.removeEventListener("change", preloadForViewport);
  }, [slides]);

  return <section
    className={`hero-card ${current ? "has-custom-slide" : "hero-slide-default"}`}
    aria-roledescription="carrusel"
    aria-label="Novedades de JOMA Express"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)}
    onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
    }}
  >
    <AnimatePresence initial={false}>
      {current && (current.mobileImageUrl || current.desktopImageUrl) ? <motion.picture
        className="hero-custom-picture"
        key={`hero-image-${slide}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: .35, ease: [0.22, 1, 0.36, 1] }}
      >
        <source media="(min-width: 700px)" srcSet={current.desktopImageUrl || current.mobileImageUrl}/>
        <img src={current.mobileImageUrl || current.desktopImageUrl} alt=""/>
      </motion.picture> : null}
    </AnimatePresence>
    <div className="hero-carousel-stage">
      <AnimatePresence initial={false}>
        <motion.div
          className="hero-carousel-slide"
          key={slide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: .35, ease: [0.22, 1, 0.36, 1] }}
        >
          {!current ? <>
            <h1>Tu compra diaria,<br/><em>sin vueltas.</em></h1>
            <div className="hero-actions"><button type="button" onClick={onCategories}>Ver categorías <Icon name="arrow"/></button><button type="button" className="is-secondary" onClick={onCombos}>Ver combos <Icon name="arrow"/></button></div>
            <LiveDateTime/>
          </> : null}
          {current ? <>
            {current.buttonLabel && current.targetType !== "none" ? <div className={`hero-actions align-${current.buttonAlign}`}><button type="button" onClick={() => onAction(current)}>{current.buttonLabel} <Icon name="arrow"/></button></div> : null}
          </> : null}
        </motion.div>
      </AnimatePresence>
    </div>
    {slideCount > 1 ? <div className="hero-carousel-dots" role="group" aria-label="Elegir placa">
      {Array.from({ length: slideCount }, (_, index) => <button type="button" key={index} className={slide === index ? "is-active" : ""} onClick={() => setSlide(index)} aria-label={`Mostrar placa ${index + 1}`} aria-current={slide === index ? "true" : undefined}/>)}
    </div> : <div className="hero-carousel-dots" aria-hidden="true"/>}
  </section>;
}

function ProductList({ products, eagerCount = 0 }: { products: Product[]; eagerCount?: number }) {
  useEffect(() => {
    products.slice(eagerCount, eagerCount + 3).forEach((product) => {
      if (!product.imageUrl || (product.categoryId === "combos" && /^P/i.test(product.id.trim()))) return;
      const image = new Image();
      image.src = product.imageUrl;
    });
  }, [products, eagerCount]);
  const isOutOfStock = (product: Product) =>
    !product.active || (Number.isFinite(product.stockReal) && Number(product.stockReal) <= 0);
  const firstOutOfStockIndex = products.findIndex(isOutOfStock);

  return <div className="product-list">{products.map((product, index) => <Fragment key={product.id}>
    {index === firstOutOfStockIndex ? <div className="product-stock-divider" role="separator"><span>Sin stock</span></div> : null}
    <ProductCard product={product} eager={index < eagerCount}/>
  </Fragment>)}</div>;
}

function CategoryGrid({ categories, onSelect }: { categories: Category[]; onSelect: (category: Category) => void }) {
  return <div className="category-grid">{categories.map((category) => <button type="button" className="category-card" onClick={() => onSelect(category)} key={category.id}>
    <span className="category-copy"><strong>{category.name}</strong><em>{category.count} {category.count === 1 ? "producto disponible" : "productos disponibles"}</em></span>
    <span className="category-arrow"><Icon name="arrow"/></span>
  </button>)}</div>;
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
  return <aside className="desktop-rail desktop-category-rail" aria-label="Categorías">
    <div className="desktop-rail-panel">
      <header><div><span>Explorar</span><h2>Categorías</h2></div></header>
      <nav>
        <button type="button" className={tab === "categories" && !selectedCategory ? "is-active" : ""} onClick={onShowAll}>
          <span><strong>Todas las categorías</strong><small>Ver el listado completo</small></span><Icon name="arrow"/>
        </button>
        {categories.map((category) => <button type="button" className={selectedCategory?.id === category.id ? "is-active" : ""} onClick={() => onSelect(category)} key={category.id}>
          <span><strong>{category.name}</strong><small>{category.count} disponibles</small></span><Icon name="arrow"/>
        </button>)}
      </nav>
    </div>
  </aside>;
}

function DesktopCartRail({ onOpenCart }: { onOpenCart: () => void }) {
  const items = useCartStore((state) => state.items);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return <aside className="desktop-rail desktop-cart-rail" aria-label="Carrito">
    <div className="desktop-rail-panel">
      <header><div><span>Tu compra</span><h2>Carrito</h2></div>{items.length ? <button type="button" className="desktop-cart-clear" onClick={clear}>Vaciar</button> : null}</header>
      {!items.length ? <div className="desktop-cart-empty"><Icon name="cart"/><strong>Tu carrito está vacío</strong><span>Los productos que agregues aparecerán acá.</span></div> :
        <div className="desktop-cart-items">{items.map((item) => {
          const remaining = getRemainingStock(items, item.productId, item.stockLimit);
          const canAdd = remaining === undefined || remaining >= getCartItemUnits({ ...item, qty: 1 });
          return <article key={item.id}>
            <div><strong>{item.name}</strong><span>{item.label}</span></div>
            <b>{money.format(item.price * item.qty)}</b>
            <div className="desktop-cart-actions">
              <button type="button" onClick={() => setItemQty(item.id, item.qty - 1)} aria-label={`Disminuir ${item.name}`}><Icon name="minus"/></button>
              <output>{item.qty}</output>
              <button type="button" onClick={() => setItemQty(item.id, item.qty + 1)} disabled={!canAdd} aria-label={`Aumentar ${item.name}`}><Icon name="plus"/></button>
              <button type="button" className="desktop-cart-remove" onClick={() => removeItem(item.id)} aria-label={`Quitar ${item.name}`}><Icon name="trash"/></button>
            </div>
          </article>;
        })}</div>}
      <footer><div><span>Subtotal</span><strong>{money.format(total)}</strong></div><button type="button" onClick={onOpenCart} disabled={!items.length}>Revisar y confirmar</button></footer>
    </div>
  </aside>;
}

function StoreApp({ catalog }: { catalog: ReturnType<typeof createRemoteCatalog> }) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);
  const [carouselSlides, setCarouselSlides] = useState<StoreCarouselSlide[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const items = useCartStore((state) => state.items);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.qty * item.price, 0), [items]);

  const loadInitial = () => {
    const controller = new AbortController();
    setInitialLoading(true); setInitialError("");
    Promise.all([catalog.getManifest(controller.signal), catalog.getFeaturedProducts(controller.signal), catalog.getOfferProducts(controller.signal), getStoreCarouselSlides()])
      .then(([nextManifest, featuredProducts, offerProducts, nextCarouselSlides]) => { setManifest(nextManifest); setFeatured(featuredProducts); setOffers(offerProducts); setCarouselSlides(nextCarouselSlides); })
      .catch((error) => { if (!controller.signal.aborted) setInitialError(error instanceof Error ? error.message : "Error inesperado."); })
      .finally(() => { if (!controller.signal.aborted) setInitialLoading(false); });
    return controller;
  };

  useEffect(() => { const controller = loadInitial(); return () => controller.abort(); }, [catalog]);

  useEffect(() => {
    if (!selectedCategory) { setCategoryProducts([]); return; }
    const controller = new AbortController();
    setCategoryLoading(true); setCategoryError("");
    catalog.getCategoryProducts(selectedCategory.id, controller.signal)
      .then(setCategoryProducts)
      .catch((error) => { if (!controller.signal.aborted) setCategoryError(error instanceof Error ? error.message : "Error inesperado."); })
      .finally(() => { if (!controller.signal.aborted) setCategoryLoading(false); });
    return () => controller.abort();
  }, [catalog, selectedCategory]);

  useEffect(() => {
    if (tab === "search") window.setTimeout(() => searchRef.current?.focus(), 80);
  }, [tab]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setSearchResults([]); setSearchLoading(false); setSearchError(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true); setSearchError("");
      catalog.searchProducts(value, controller.signal)
        .then(setSearchResults)
        .catch((error) => { if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Error inesperado."); })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 260);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [catalog, query]);

  const goTo = (next: Tab) => { setMenuOpen(false); setSelectedCategory(null); setTab(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openCategory = (category: Category) => { setSelectedCategory(category); setTab("categories"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openCombos = () => openCategory(manifest?.categories.find((category) => category.id === "combos") ?? { id: "combos", name: "Combos", description: "Promociones de la app", color: "#d92822", image: "/joma-express.png", count: 0 });
  const openCarouselDestination = (slide: StoreCarouselSlide) => {
    if (slide.targetType === "categories") return goTo("categories");
    if (slide.targetType === "cart") return goTo("cart");
    if (slide.targetType === "category") {
      const category = manifest?.categories.find((item) => item.id === slide.targetValue);
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

  return <div className="store-app">
    <div className="top-shell">
      <header className="app-header">
        <button type="button" className={`menu-button ${menuOpen ? "is-active" : ""}`} onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menú" aria-expanded={menuOpen}><Icon name="menu"/></button>
        <button type="button" className="brand-lockup" onClick={() => goTo("home")} aria-label="JOMA Express. Ir al inicio"><img src="/joma-express.png" alt="JOMA Express" width="561" height="257"/></button>
        <button type="button" className={`header-cart ${tab === "cart" ? "is-active" : ""}`} onClick={() => goTo("cart")} aria-label={`Abrir carrito. ${itemCount} productos`}><Icon name="cart"/>{itemCount ? <b>{itemCount > 99 ? "99+" : itemCount}</b> : null}</button>
      </header>
      <div className="search-dock"><label className="top-search"><Icon name="search"/><input ref={searchRef} value={query} onFocus={() => { if (tab !== "search") goTo("search"); }} onChange={(event) => { setQuery(event.target.value); if (tab !== "search") setTab("search"); }} placeholder="¿Qué necesitás?" aria-label="Buscar productos"/><span className={searchLoading ? "tiny-spinner" : ""}/></label></div>
      <AnimatePresence>{menuOpen ? <><motion.button type="button" className="drawer-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.nav className="header-menu" aria-label="Menú principal" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: .24, ease: [0.22, 1, 0.36, 1] }}><div className="drawer-head"><button type="button" className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><Icon name="close"/></button><img src="/joma-express.png" alt="JOMA Express" width="561" height="257"/></div><div className="drawer-content"><button type="button" onClick={() => goTo("profile")}><Icon name="user"/><span><strong>Perfil</strong><small>Mis datos y dirección</small></span><Icon name="arrow"/></button><hr/><button type="button" onClick={() => goTo("categories")}><Icon name="grid"/><span><strong>Categorías</strong><small>Explorar productos</small></span><Icon name="arrow"/></button><button type="button" className="drawer-logout" onClick={() => { setMenuOpen(false); void signOut(); }}><Icon name="logout"/><span><strong>Cerrar sesión</strong><small>Salir de esta cuenta</small></span><Icon name="arrow"/></button></div></motion.nav></> : null}</AnimatePresence>
    </div>

    <div className="desktop-layout">
      <DesktopCategoryRail categories={manifest?.categories ?? []} selectedCategory={selectedCategory} tab={tab} onShowAll={() => goTo("categories")} onSelect={openCategory}/>
      <main id="main-content" className={itemCount ? "has-mini-cart" : ""}>
      <AnimatePresence mode="wait" initial={false}>
        {tab === "home" ? <motion.div className="view" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <HeroCarousel slides={carouselSlides} onCategories={() => goTo("categories")} onCombos={openCombos} onAction={openCarouselDestination}/>
          <section><div className="section-heading"><div><span>Elegidos para vos</span><h2>Destacados</h2></div><button type="button" onClick={() => goTo("categories")}>Ver todo</button></div>
            {initialLoading ? <ProductSkeletons/> : initialError ? <ErrorState message={initialError} retry={loadInitial}/> : <ProductList products={featured} eagerCount={3}/>}</section>
          {initialLoading || offers.length ? <section className="home-offers-section"><div className="section-heading"><div><span>Precios especiales</span><h2>Ofertas</h2></div></div>
            {initialLoading ? <ProductSkeletons count={2}/> : <ProductList products={offers}/>}</section> : null}
        </motion.div> : null}

        {tab === "categories" ? <motion.div className="view" key={`categories-${selectedCategory?.id ?? "grid"}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
          {selectedCategory ? <section><button className="back-button category-back-button" type="button" onClick={() => setSelectedCategory(null)}><span className="back-button-icon"><Icon name="arrow"/></span> Todas las categorías</button><div className="section-heading category-title"><div><span>{selectedCategory.description}</span><h1>{selectedCategory.name}</h1></div><b>{selectedCategory.count}</b></div>{categoryLoading ? <ProductSkeletons/> : categoryError ? <ErrorState message={categoryError} retry={() => { const current = selectedCategory; setSelectedCategory(null); requestAnimationFrame(() => setSelectedCategory(current)); }}/> : categoryProducts.length ? <ProductList products={categoryProducts}/> : <div className="empty-inline">No hay productos en esta categoría.</div>}</section> : <section><div className="page-intro"><span>Explorá sin apuro</span><h1>Categorías</h1><p>Elegí una sección y descargamos únicamente esos productos.</p></div>{initialLoading ? <div className="category-grid">{[1,2,3].map((n) => <div className="category-card skeleton-category" key={n}/>)}</div> : initialError ? <ErrorState message={initialError} retry={loadInitial}/> : <CategoryGrid categories={manifest?.categories ?? []} onSelect={openCategory}/>}</section>}
        </motion.div> : null}

        {tab === "search" ? <motion.div className="view" key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <section><button className="back-button search-home-button" type="button" onClick={() => goTo("home")}><Icon name="arrow"/> Volver al inicio</button>
          {query.length < 2 ? <div className="search-start"><p>Probá con</p><div>{["Aceite","Yerba","Gaseosa","Limpieza"].map((term) => <button type="button" onClick={() => setQuery(term)} key={term}>{term}</button>)}</div></div> : searchError ? <ErrorState message={searchError} retry={() => setQuery((value) => `${value} `)}/> : !searchLoading && !searchResults.length ? <div className="empty-state compact-empty"><div className="empty-icon"><Icon name="search"/></div><h2>Sin coincidencias</h2><p>Probá con otra palabra o revisá cómo está escrito.</p></div> : <><div className="result-count">{searchResults.length} {searchResults.length === 1 ? "resultado" : "resultados"}</div><ProductList products={searchResults}/></>}</section>
        </motion.div> : null}

        {tab === "cart" ? <motion.div className="view" key="cart" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><CartView onContinue={() => goTo("home")}/></motion.div> : null}
        {tab === "profile" ? <motion.div className="view" key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><ProfileView/></motion.div> : null}
      </AnimatePresence>
      </main>
      <DesktopCartRail onOpenCart={() => goTo("cart")}/>
    </div>

    {itemCount && tab !== "cart" ? <button type="button" className="mini-cart" onClick={() => goTo("cart")} aria-label={`Abrir carrito. Subtotal ${money.format(cartTotal)}`}><span>Subtotal</span><strong>{money.format(cartTotal)}</strong></button> : null}

  </div>;
}

export function App() {
  const { user, loading } = useAuth();
  const catalog = useMemo(() => user ? createRemoteCatalog() : null, [user]);
  if (loading) return <AuthLoading/>;
  if (!user) return <AuthWelcome/>;
  if (!catalog) return <AuthLoading/>;
  return <StoreApp catalog={catalog}/>;
}
