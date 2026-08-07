import { useEffect, useMemo, useState } from "react";
import type { CatalogProvider, Category, Product } from "@/catalog/types";
import { ProductCard } from "@/components/ProductCard";
import { Icon } from "@/components/Icons";
import { BUSINESS, navigateInStore, productIdFromPath, productPath, setDocumentMetadata, SITE_URL } from "@/lib/seo";
import { useCartStore } from "@/store/cart";
import { AnimatePresence, motion } from "framer-motion";
import { StoreCreditBar, StoreInfoFooter } from "@/components/StoreFooter";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

type PageState = {
  loading: boolean;
  error: string;
  categories: Category[];
  products: Product[];
  product: Product | null;
};

const initialState: PageState = { loading: true, error: "", categories: [], products: [], product: null };

const staticPages: Record<string, { title: string; description: string; heading: string; body: React.ReactNode }> = {
  "/envios-corrientes": {
    title: "Envíos en Corrientes Capital | Joma Group",
    description: "Comprá alimentos, bebidas y productos de consumo diario con entrega en Corrientes Capital.",
    heading: "Envíos en Corrientes Capital",
    body: <><p>Realizamos entregas programadas dentro de Corrientes Capital. Al confirmar tu compra podrás elegir entre las fechas y franjas disponibles.</p><p>La cobertura se valida con la dirección del pedido. Por el momento no realizamos entregas en Resistencia ni en otras localidades.</p></>,
  },
  "/locales": {
    title: "Locales de Joma Group y Jónico en Corrientes",
    description: "Información de Joma Group y Jónico Supermercado Mayorista y Minorista en Corrientes Capital.",
    heading: "Nuestros locales en Corrientes",
    body: <><h2>Joma Group</h2><p>Distribuidora, mayorista y tienda online con atención en Av. Maipú 7249, Corrientes Capital.</p><h2>Jónico</h2><p>Jónico Supermercado Mayorista y Minorista es una empresa vinculada, con operación y presencia propias junto a Joma Group.</p></>,
  },
  "/jonico": {
    title: "Jónico Supermercado Mayorista y Minorista | Corrientes",
    description: "Conocé Jónico, supermercado mayorista y minorista vinculado a Joma Group en Corrientes Capital.",
    heading: "Jónico Supermercado Mayorista y Minorista",
    body: <><p>Jónico es nuestro supermercado mayorista y minorista vinculado en Corrientes Capital. Cuenta con identidad y atención propias, junto a las instalaciones de Joma Group.</p><p>La tienda online de este sitio es operada por Joma Group.</p></>,
  },
  "/nosotros": {
    title: "Sobre Joma Group | Corrientes",
    description: "Conocé Joma Group, distribuidora, mayorista y tienda online de Corrientes Capital.",
    heading: "Joma Group",
    body: <p>Somos una empresa de Corrientes dedicada a la distribución y venta mayorista y minorista de productos de consumo diario. Nuestra tienda online permite consultar el catálogo y preparar pedidos desde cualquier dispositivo.</p>,
  },
  "/contacto": {
    title: "Contacto | Joma Group Corrientes",
    description: "Contactá a Joma Group en Corrientes Capital por consultas sobre productos, compras y entregas.",
    heading: "Contacto",
    body: <><p><strong>Dirección:</strong> Av. Maipú 7249, Corrientes Capital.</p><p><strong>Teléfono:</strong> <a href="tel:+543794390919">0379 439-0919</a></p></>,
  },
  "/privacidad": {
    title: "Política de privacidad | Joma Group",
    description: "Información sobre el tratamiento de datos personales en la tienda online de Joma Group.",
    heading: "Política de privacidad",
    body: <><p>Utilizamos los datos que ingresás para gestionar tu cuenta, preparar pedidos, coordinar entregas y responder consultas. No vendemos información personal a terceros.</p><p>Podés solicitar la actualización o eliminación de tus datos contactando a Joma Group.</p></>,
  },
  "/cambios": {
    title: "Cambios y devoluciones | Joma Group",
    description: "Condiciones generales para solicitar cambios o informar inconvenientes con una compra en Joma Group.",
    heading: "Cambios y devoluciones",
    body: <p>Si tu pedido presenta un producto incorrecto, faltante o en condiciones inadecuadas, comunicate con nosotros indicando el número de pedido. Evaluaremos cada caso según el producto y su estado.</p>,
  },
  "/condiciones": {
    title: "Términos y condiciones | Joma Group",
    description: "Condiciones de uso y compra de la tienda online de Joma Group en Corrientes Capital.",
    heading: "Términos y condiciones",
    body: <><p>Los precios y la disponibilidad pueden actualizarse junto con el catálogo. El pedido queda sujeto a validación de stock y confirmación.</p><p>Las fechas y franjas de entrega disponibles se informan durante la confirmación de compra.</p></>,
  },
};

function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const itemCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.qty, 0));
  return <div className="top-shell public-top-shell">
    <header className="app-header">
      <button type="button" className={`menu-button ${menuOpen ? "is-active" : ""}`} onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Icon name="menu"/></button>
        <a className="brand-lockup" href="/" onClick={(event) => { event.preventDefault(); navigateInStore("/"); }} aria-label="Ir al inicio de Joma Group"><img src="/joma-express-white.png" alt="Joma Group, servicio online Joma Express" width="800" height="329"/></a>
      <a className="header-cart" href="/?view=cart" aria-label={`Abrir carrito. ${itemCount} productos`}><Icon name="cart"/>{itemCount ? <b>{itemCount > 99 ? "99+" : itemCount}</b> : null}</a>
    </header>
    <div className="search-dock"><label className="top-search"><Icon name="search"/><input readOnly value="" onFocus={() => window.location.assign("/?view=search")} placeholder="¿Qué necesitás?" aria-label="Buscar productos"/><span/></label></div>
      <AnimatePresence>{menuOpen ? <><motion.button type="button" className="drawer-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.nav className="header-menu" aria-label="Menú principal" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: .24, ease: [0.22, 1, 0.36, 1] }}><div className="drawer-head"><button type="button" className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><Icon name="close"/></button><img src="/joma-express-white.png" alt="Joma Group" width="800" height="329"/></div><div className="drawer-content"><a className="drawer-public-link" href="/?view=profile"><Icon name="user"/><span><strong>Perfil</strong><small>Mis datos y dirección</small></span></a><hr/><a className="drawer-public-link" href="/?view=categories"><Icon name="grid"/><span><strong>Categorías</strong><small>Explorar productos</small></span></a><a className="drawer-public-link" href="/?info=envios"><Icon name="arrow"/><span><strong>Envíos en Corrientes</strong><small>Cobertura y entregas</small></span></a></div></motion.nav></> : null}</AnimatePresence>
  </div>;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><PublicHeader/><main className="public-main">{children}</main><StoreInfoFooter/><StoreCreditBar/></div>;
}

function StaticPage({ path }: { path: string }) {
  const page = staticPages[path];
  useEffect(() => setDocumentMetadata(page.title, page.description, path), [page, path]);
  return <PublicShell><article className="public-copy"><h1>{page.heading}</h1>{page.body}</article></PublicShell>;
}

export function PublicRoutePage({ catalog, path }: { catalog: CatalogProvider; path: string }) {
  const [state, setState] = useState<PageState>(initialState);
  const categoryId = path.startsWith("/categorias/") ? decodeURIComponent(path.slice("/categorias/".length)) : "";
  const productId = path.startsWith("/productos/") ? productIdFromPath(path) : "";
  const knownStaticPage = staticPages[path];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  useEffect(() => {
    if (knownStaticPage) return;
    let active = true;
    setState(initialState);
    const request = productId
      ? catalog.getProduct(productId).then((product) => ({ products: [], categories: [], product }))
      : categoryId
        ? Promise.all([catalog.getManifest(), catalog.getCategoryProducts(categoryId)]).then(([manifest, products]) => ({ products, categories: manifest.categories, product: null }))
        : path === "/ofertas"
          ? catalog.getOfferProducts().then((products) => ({ products, categories: [], product: null }))
          : path === "/categorias"
            ? catalog.getManifest().then((manifest) => ({ products: [], categories: manifest.categories, product: null }))
            : Promise.reject(new Error("Página no encontrada"));
    request.then((result) => { if (active) setState({ loading: false, error: "", ...result }); }).catch((error) => { if (active) setState({ ...initialState, loading: false, error: error instanceof Error ? error.message : "No pudimos cargar esta página." }); });
    return () => { active = false; };
  }, [catalog, categoryId, knownStaticPage, path, productId]);

  const category = useMemo(() => state.categories.find((item) => item.id === categoryId), [categoryId, state.categories]);
  useEffect(() => {
    if (knownStaticPage || state.loading) return;
    if (state.product) setDocumentMetadata(`${state.product.name} | Joma Group`, `Comprá ${state.product.name} por unidad${state.product.pack ? " o por caja" : ""} en Joma Group, Corrientes Capital.`, productPath(state.product));
    else if (category) setDocumentMetadata(`${category.name} en Corrientes | Joma Group`, `Comprá productos de ${category.name} en Joma Group con entrega en Corrientes Capital.`, `/categorias/${category.id}`);
    else if (path === "/ofertas") setDocumentMetadata("Ofertas en Corrientes | Joma Group", "Consultá ofertas vigentes en alimentos, bebidas y productos de consumo diario en Joma Group.", path);
    else if (path === "/categorias") setDocumentMetadata("Productos por categoría | Joma Group", "Explorá el catálogo mayorista y minorista de Joma Group en Corrientes Capital.", path);
    else setDocumentMetadata("Página no encontrada | Joma Group", "La página solicitada no está disponible.", path, true);
  }, [category, knownStaticPage, path, state.loading, state.product]);

  if (knownStaticPage) return <StaticPage path={path}/>;
  if (state.loading) return <PublicShell><motion.div className="public-product-loading" aria-label="Cargando producto" aria-busy="true" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .22 }}><div><i/><i/><i/><i/></div><span/></motion.div></PublicShell>;
  if (state.error || (productId && !state.product)) return <PublicShell><article className="public-copy"><h1>Página no encontrada</h1><p>El contenido que buscás no está disponible.</p><a className="public-primary-link" href="/categorias">Explorar productos</a></article></PublicShell>;

  if (state.product) {
    const product = state.product;
    const structuredData = { "@context": "https://schema.org", "@type": "Product", name: product.name, sku: product.id, image: product.imageUrl ? [product.imageUrl] : undefined, brand: { "@type": "Brand", name: product.brand || BUSINESS.name }, offers: { "@type": "Offer", url: `${SITE_URL}${productPath(product)}`, priceCurrency: "ARS", price: product.unit.price, availability: product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" } };
    return <PublicShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}/><motion.article className="public-product" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}><div className="public-product-intro"><span className="public-product-category">{product.category || product.brand}</span><h1>{product.name}</h1><p>Disponible por unidad{product.pack ? ` y por ${product.pack.label.toLowerCase()}` : ""}.</p><strong className="public-product-price">Desde {money.format(product.unit.price)}</strong><dl className="public-product-facts"><div><dt>Código</dt><dd>{product.id}</dd></div><div><dt>Categoría</dt><dd>{product.category || "Productos"}</dd></div><div><dt>Presentación</dt><dd>{product.pack ? `${product.unit.label} o ${product.pack.label}` : product.unit.label}</dd></div><div><dt>Disponibilidad</dt><dd>{product.active ? "Disponible" : "Temporalmente sin stock"}</dd></div></dl></div><ProductCard product={product} eager linkImageToDetail={false}/></motion.article></PublicShell>;
  }

  if (path === "/categorias") return <PublicShell><section className="public-list-heading"><h1>Productos por categoría</h1><p>Consultá el catálogo mayorista y minorista de Joma Group.</p></section><div className="public-category-grid">{state.categories.map((item) => <a href={`/categorias/${item.id}`} key={item.id}><strong>{item.name}</strong><span>{item.count} productos</span></a>)}</div></PublicShell>;

  const heading = category?.name || "Ofertas";
  return <PublicShell><section className="public-list-heading"><h1>{heading}</h1><p>{category ? `Productos de ${heading} disponibles en Corrientes Capital.` : "Precios especiales vigentes en nuestra tienda online."}</p></section><div className="public-product-grid">{state.products.map((product) => <div className="public-product-entry" key={product.id}><a href={productPath(product)} className="public-product-detail">Ver detalle de {product.name}</a><ProductCard product={product}/></div>)}</div></PublicShell>;
}
