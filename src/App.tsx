import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { CatalogManifest, Category, Product } from "@/catalog/types";
import { useCartStore } from "@/store/cart";
import { CartView } from "@/components/CartView";
import { Icon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { ProfileView } from "@/components/ProfileView";
import { AuthLoading, AuthWelcome } from "@/components/AuthWelcome";
import { useAuth } from "@/auth/AuthProvider";

type Tab = "home" | "categories" | "search" | "cart" | "profile";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function ProductSkeletons({ count = 4 }: { count?: number }) {
  return <div className="product-list" aria-label="Cargando productos" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="product-card skeleton-card" key={index}><div className="skeleton-block image"/><div className="skeleton-lines"><i/><i/><i/><div/></div></div>)}</div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-state" role="alert"><Icon name="refresh"/><h3>No pudimos cargar</h3><p>{message}</p><button type="button" onClick={retry}>Reintentar</button></div>;
}

function ProductList({ products, eagerCount = 0 }: { products: Product[]; eagerCount?: number }) {
  useEffect(() => {
    products.slice(eagerCount, eagerCount + 3).forEach((product) => {
      if (!product.imageUrl) return;
      const image = new Image();
      image.src = product.imageUrl;
    });
  }, [products, eagerCount]);
  return <div className="product-list">{products.map((product, index) => <ProductCard product={product} eager={index < eagerCount} key={product.id}/>)}</div>;
}

function CategoryGrid({ categories, onSelect }: { categories: Category[]; onSelect: (category: Category) => void }) {
  return <div className="category-grid">{categories.map((category) => <button type="button" className="category-card" style={{ "--category-color": category.color } as React.CSSProperties} onClick={() => onSelect(category)} key={category.id}>
    <span className="category-art"><img src={category.image} alt="" width="104" height="104" loading="lazy"/></span>
    <span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small><em>{category.count} productos</em></span>
    <span className="category-arrow"><Icon name="arrow"/></span>
  </button>)}</div>;
}

function StoreApp({ catalog }: { catalog: ReturnType<typeof createRemoteCatalog> }) {
  const [tab, setTab] = useState<Tab>("home");
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [featured, setFeatured] = useState<Product[]>([]);
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
    Promise.all([catalog.getManifest(controller.signal), catalog.getFeaturedProducts(controller.signal)])
      .then(([nextManifest, products]) => { setManifest(nextManifest); setFeatured(products); })
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

  const goTo = (next: Tab) => { setTab(next); if (next !== "categories") setSelectedCategory(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openCategory = (category: Category) => { setSelectedCategory(category); setTab("categories"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openCombos = () => openCategory({ id: "combos", name: "Combos", description: "Opciones listas para ahorrar", color: "#d92822", image: "/demo-products/fideos.webp", count: 2 });

  return <div className="store-app">
    <header className="app-header">
      <button type="button" className="brand-lockup" onClick={() => goTo("home")} aria-label="JOMA Express. Ir al inicio"><img src="/joma-express.png" alt="JOMA Express" width="561" height="257"/></button>
      <button type="button" className={`profile-button ${tab === "profile" ? "is-active" : ""}`} onClick={() => goTo("profile")} aria-label="Abrir mis datos"><Icon name="user"/></button>
    </header>

    <main id="main-content" className={itemCount ? "has-mini-cart" : ""}>
      <AnimatePresence mode="wait" initial={false}>
        {tab === "home" ? <motion.div className="view" key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <section className="hero-card"><div><h1>Tu compra diaria,<br/><em>sin vueltas.</em></h1><div className="hero-actions"><button type="button" onClick={() => goTo("categories")}>Ver categorías <Icon name="arrow"/></button><button type="button" className="is-secondary" onClick={openCombos}>Ver combos <Icon name="arrow"/></button></div></div></section>
          <section className="quick-search"><button type="button" onClick={() => goTo("search")}><Icon name="search"/><span><strong>¿Qué necesitás?</strong><small>Buscá por producto o marca</small></span><Icon name="arrow"/></button></section>
          <section><div className="section-heading"><div><span>Elegidos para vos</span><h2>Destacados</h2></div><button type="button" onClick={() => goTo("categories")}>Ver todo</button></div>
            {initialLoading ? <ProductSkeletons/> : initialError ? <ErrorState message={initialError} retry={loadInitial}/> : <ProductList products={featured} eagerCount={3}/>}</section>
        </motion.div> : null}

        {tab === "categories" ? <motion.div className="view" key={`categories-${selectedCategory?.id ?? "grid"}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
          {selectedCategory ? <section><button className="back-button" type="button" onClick={() => setSelectedCategory(null)}><Icon name="arrow"/> Todas las categorías</button><div className="section-heading category-title"><div><span>{selectedCategory.description}</span><h1>{selectedCategory.name}</h1></div><b>{selectedCategory.count}</b></div>{categoryLoading ? <ProductSkeletons/> : categoryError ? <ErrorState message={categoryError} retry={() => { const current = selectedCategory; setSelectedCategory(null); requestAnimationFrame(() => setSelectedCategory(current)); }}/> : categoryProducts.length ? <ProductList products={categoryProducts}/> : <div className="empty-inline">No hay productos en esta categoría.</div>}</section> : <section><div className="page-intro"><span>Explorá sin apuro</span><h1>Categorías</h1><p>Elegí una sección y descargamos únicamente esos productos.</p></div>{initialLoading ? <div className="category-grid">{[1,2,3].map((n) => <div className="category-card skeleton-category" key={n}/>)}</div> : initialError ? <ErrorState message={initialError} retry={loadInitial}/> : <CategoryGrid categories={manifest?.categories ?? []} onSelect={openCategory}/>}</section>}
        </motion.div> : null}

        {tab === "search" ? <motion.div className="view" key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <section><div className="page-intro search-intro"><span>Encontralo rápido</span><h1>Buscar</h1></div><label className="search-field"><Icon name="search"/><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producto, marca o categoría" aria-label="Buscar productos"/><kbd>{searchLoading ? <span className="tiny-spinner"/> : null}</kbd></label>
          {query.length < 2 ? <div className="search-start"><p>Probá con</p><div>{["Aceite","Yerba","Gaseosa","Limpieza"].map((term) => <button type="button" onClick={() => setQuery(term)} key={term}>{term}</button>)}</div></div> : searchError ? <ErrorState message={searchError} retry={() => setQuery((value) => `${value} `)}/> : !searchLoading && !searchResults.length ? <div className="empty-state compact-empty"><div className="empty-icon"><Icon name="search"/></div><h2>Sin coincidencias</h2><p>Probá con otra palabra o revisá cómo está escrito.</p></div> : <><div className="result-count">{searchResults.length} {searchResults.length === 1 ? "resultado" : "resultados"}</div><ProductList products={searchResults}/></>}</section>
        </motion.div> : null}

        {tab === "cart" ? <motion.div className="view" key="cart" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><CartView onContinue={() => goTo("home")}/></motion.div> : null}
        {tab === "profile" ? <motion.div className="view" key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><ProfileView/></motion.div> : null}
      </AnimatePresence>
    </main>

    {itemCount && tab !== "cart" ? <button type="button" className="mini-cart" onClick={() => goTo("cart")} aria-label={`Abrir carrito. Subtotal ${money.format(cartTotal)}`}><span>Subtotal</span><strong>{money.format(cartTotal)}</strong></button> : null}

    <nav className="bottom-nav" aria-label="Navegación principal">{([
      ["home","home","Inicio"],["categories","grid","Categorías"],["search","search","Buscar"],["cart","cart","Carrito"],
    ] as const).map(([id, icon, label]) => <button type="button" className={tab === id ? "is-active" : ""} onClick={() => goTo(id)} aria-current={tab === id ? "page" : undefined} key={id}><span><Icon name={icon}/>{id === "cart" && itemCount ? <b>{itemCount > 99 ? "99+" : itemCount}</b> : null}</span><small>{label}</small></button>)}</nav>
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
