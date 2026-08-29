import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Product } from "@/catalog/types";
import {
  getFeaturedProductsConfig,
  saveSponsoredProducts,
  saveStoreCarouselSlides,
  type SponsoredProductCampaign,
  type StoreCarouselSlide,
} from "@/lib/featuredProducts";

type ProductDraft = { index: number | null; value: SponsoredProductCampaign };
type SlideDraft = { index: number; value: StoreCarouselSlide };

function emptyCampaign(product?: Product): SponsoredProductCampaign {
  return { productId: product?.id || "", campaignId: "", campaignName: "", advertiser: product?.brand || "", campaignStart: "", campaignEnd: "" };
}

function status(start: string, end: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (!start || !end) return { label: "Sin patrocinio", className: "is-ended" };
  if (start > today) return { label: "Programada", className: "is-scheduled" };
  if (end < today) return { label: "Finalizada", className: "is-ended" };
  return { label: "Activa", className: "is-active" };
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
  return next;
}

export function AdminAdvertisingPanel({ user }: { user: User }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<SponsoredProductCampaign[]>([]);
  const [slides, setSlides] = useState<StoreCarouselSlide[]>([]);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [slideDraft, setSlideDraft] = useState<SlideDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"products" | "slides" | "">("");
  const [productMessage, setProductMessage] = useState("");
  const [slideMessage, setSlideMessage] = useState("");

  useEffect(() => {
    let active = true;
    const catalog = createRemoteCatalog();
    Promise.all([catalog.getAllProducts(), getFeaturedProductsConfig({ refresh: true })]).then(([allProducts, config]) => {
      if (!active) return;
      setProducts(allProducts);
      setCampaigns(config.sponsoredProducts);
      setSlides(config.carouselSlides);
    }).catch((error) => {
      if (active) setProductMessage(error instanceof Error ? error.message : "No se pudo cargar la publicidad.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const availableProduct = () => products.find((product) => !campaigns.some((campaign) => campaign.productId === product.id));

  const applyProduct = () => {
    if (!productDraft) return;
    const entry = productDraft.value;
    if (!entry.productId || !entry.campaignId.trim() || !entry.campaignName.trim() || !entry.advertiser.trim() || !entry.campaignStart || !entry.campaignEnd) return setProductMessage("Completá todos los campos de la campaña.");
    if (entry.campaignEnd < entry.campaignStart) return setProductMessage("La fecha de finalización debe ser posterior al inicio.");
    if (campaigns.some((item, index) => index !== productDraft.index && item.productId === entry.productId)) return setProductMessage("Ese producto ya está patrocinado.");
    setCampaigns((current) => productDraft.index === null ? [...current, entry] : current.map((item, index) => index === productDraft.index ? entry : item));
    setProductDraft(null);
    setProductMessage("Orden preparado. Guardá los productos patrocinados para publicarlo.");
  };

  const saveProducts = async () => {
    setSaving("products"); setProductMessage("");
    try { await saveSponsoredProducts(campaigns, user.email || user.uid); setProductMessage("Productos patrocinados guardados y publicados."); }
    catch (error) { setProductMessage(error instanceof Error ? error.message : "No se pudieron guardar los productos patrocinados."); }
    finally { setSaving(""); }
  };

  const applySlide = () => {
    if (!slideDraft) return;
    const entry = slideDraft.value;
    if (!entry.campaignId.trim() || !entry.campaignName.trim() || !entry.advertiser.trim() || !entry.campaignStart || !entry.campaignEnd) return setSlideMessage("Completá campaña, anunciante y fechas.");
    if (entry.campaignEnd < entry.campaignStart) return setSlideMessage("La fecha de finalización debe ser posterior al inicio.");
    setSlides((current) => current.map((slide, index) => index === slideDraft.index ? entry : slide));
    setSlideDraft(null);
    setSlideMessage("Patrocinio preparado. Guardá el carrusel patrocinado para publicarlo.");
  };

  const saveSlides = async () => {
    setSaving("slides"); setSlideMessage("");
    try { await saveStoreCarouselSlides(slides, user.email || user.uid); setSlideMessage("Carrusel patrocinado guardado y publicado."); }
    catch (error) { setSlideMessage(error instanceof Error ? error.message : "No se pudo guardar el carrusel patrocinado."); }
    finally { setSaving(""); }
  };

  return <div className="admin-content-box admin-advertising">
    <section className="admin-card admin-sponsored-card">
      <div className="admin-card__head"><div><div className="admin-kicker">Publicidad</div><h1 className="admin-title">Productos patrocinados</h1><p>Definí qué productos aparecen antes de Destacados y ordenalos según el acuerdo comercial.</p></div><button type="button" className="btn primary" disabled={loading || Boolean(productDraft) || !availableProduct()} onClick={() => { setProductMessage(""); setProductDraft({ index: null, value: emptyCampaign(availableProduct()) }); }}>+ Producto patrocinado</button></div>
      <div className="admin-card__body">
        {productMessage ? <div className="admin-users-message" role="status">{productMessage}</div> : null}
        {loading ? <div className="admin-carousel-empty">Cargando publicidad...</div> : <div className="ofertas-list-wrap"><table className="productos-table ofertas-table admin-sponsored-table"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><thead><tr><th>Orden</th><th>Producto</th><th>Campaña</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{campaigns.map((entry, index) => { const campaignStatus = status(entry.campaignStart, entry.campaignEnd); return <tr key={`${entry.productId}-${entry.campaignId}`}><td><div className="admin-order-actions"><button type="button" disabled={index === 0} onClick={() => setCampaigns((current) => move(current, index, -1))} aria-label="Subir producto">↑</button><button type="button" disabled={index === campaigns.length - 1} onClick={() => setCampaigns((current) => move(current, index, 1))} aria-label="Bajar producto">↓</button></div></td><td><strong>{productById.get(entry.productId)?.name || entry.productId}</strong><small>{entry.advertiser}</small></td><td><strong>{entry.campaignName}</strong><small>{entry.campaignId}</small></td><td>{entry.campaignStart}<small>hasta {entry.campaignEnd}</small></td><td><span className={`admin-campaign-status ${campaignStatus.className}`}>{campaignStatus.label}</span></td><td><div className="admin-sponsored-actions"><button type="button" className="btn ghost" onClick={() => setProductDraft({ index, value: { ...entry } })}>Editar</button><button type="button" className="btn ofertas-danger" onClick={() => { setCampaigns((current) => current.filter((_, itemIndex) => itemIndex !== index)); setProductMessage("Producto quitado. Guardá para confirmar el cambio."); }}>Quitar</button></div></td></tr>; })}</tbody></table>{!campaigns.length ? <div className="admin-carousel-empty"><strong>No hay productos patrocinados</strong><span>La fila publicitaria permanecerá oculta en la tienda.</span></div> : null}</div>}
        {productDraft ? <section className="admin-sponsored-editor"><div className="admin-sponsored-editor__head"><div><h3>{productDraft.index === null ? "Nuevo producto patrocinado" : "Editar patrocinio"}</h3><p>La posición en la tabla define el orden en la tienda.</p></div><button type="button" className="btn ghost" onClick={() => setProductDraft(null)}>Cancelar</button></div><div className="admin-carousel-fields"><label><span>Producto</span><select className="admin-input" value={productDraft.value.productId} onChange={(event) => { const product = productById.get(event.target.value); setProductDraft((current) => current ? { ...current, value: { ...current.value, productId: event.target.value, advertiser: product?.brand || current.value.advertiser } } : current); }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.id}</option>)}</select></label><label><span>ID de campaña</span><input className="admin-input" value={productDraft.value.campaignId} onChange={(event) => setProductDraft((current) => current ? { ...current, value: { ...current.value, campaignId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") } } : current)}/></label><label><span>Nombre de campaña</span><input className="admin-input" value={productDraft.value.campaignName} onChange={(event) => setProductDraft((current) => current ? { ...current, value: { ...current.value, campaignName: event.target.value } } : current)}/></label><label><span>Marca / anunciante</span><input className="admin-input" value={productDraft.value.advertiser} onChange={(event) => setProductDraft((current) => current ? { ...current, value: { ...current.value, advertiser: event.target.value } } : current)}/></label><label><span>Inicio</span><input className="admin-input" type="date" value={productDraft.value.campaignStart} onChange={(event) => setProductDraft((current) => current ? { ...current, value: { ...current.value, campaignStart: event.target.value } } : current)}/></label><label><span>Fin</span><input className="admin-input" type="date" min={productDraft.value.campaignStart} value={productDraft.value.campaignEnd} onChange={(event) => setProductDraft((current) => current ? { ...current, value: { ...current.value, campaignEnd: event.target.value } } : current)}/></label></div><div className="admin-carousel-save"><button type="button" className="btn success" onClick={applyProduct}>Aplicar al listado</button></div></section> : null}
        <div className="admin-carousel-save"><button type="button" className="btn success" disabled={loading || Boolean(productDraft) || saving === "products"} onClick={() => void saveProducts()}>{saving === "products" ? "Guardando..." : "Guardar productos patrocinados"}</button></div>
      </div>
    </section>

    <section className="admin-card admin-sponsored-card">
      <div className="admin-card__head"><div><div className="admin-kicker">Carrusel patrocinado</div><h2 className="admin-section-title">Placas publicitarias</h2><p>Las placas patrocinadas activas aparecen primero. Las placas comunes continúan después como contenido de respaldo.</p></div></div>
      <div className="admin-card__body">
        {slideMessage ? <div className="admin-users-message" role="status">{slideMessage}</div> : null}
        <div className="ofertas-list-wrap"><table className="productos-table ofertas-table admin-sponsored-table admin-sponsored-slides"><thead><tr><th>Orden</th><th>Placa</th><th>Campaña</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{slides.map((slide, index) => { const campaignStatus = status(slide.campaignStart, slide.campaignEnd); return <tr key={slide.id}><td><div className="admin-order-actions"><button type="button" disabled={index === 0} onClick={() => setSlides((current) => move(current, index, -1))} aria-label="Subir placa">↑</button><button type="button" disabled={index === slides.length - 1} onClick={() => setSlides((current) => move(current, index, 1))} aria-label="Bajar placa">↓</button></div></td><td><div className="admin-slide-cell">{slide.mobileImageUrl || slide.desktopImageUrl ? <img src={slide.mobileImageUrl || slide.desktopImageUrl} alt=""/> : null}<div><strong>{slide.title || slide.imageAlt || `Placa ${index + 1}`}</strong><small>Posición {index + 1}</small></div></div></td><td><strong>{slide.campaignName || "Contenido propio"}</strong><small>{slide.campaignId || "Sin campaña"}</small></td><td>{slide.campaignStart || "—"}<small>{slide.campaignEnd ? `hasta ${slide.campaignEnd}` : ""}</small></td><td><span className={`admin-campaign-status ${campaignStatus.className}`}>{campaignStatus.label}</span></td><td><div className="admin-sponsored-actions"><button type="button" className="btn ghost" onClick={() => { setSlideMessage(""); setSlideDraft({ index, value: { ...slide } }); }}>{slide.campaignId ? "Editar" : "Patrocinar"}</button>{slide.campaignId ? <button type="button" className="btn ofertas-danger" onClick={() => { setSlides((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, campaignId: "", campaignName: "", advertiser: "", campaignStart: "", campaignEnd: "" } : item)); setSlideMessage("Patrocinio quitado. Guardá para confirmar."); }}>Quitar</button> : null}</div></td></tr>; })}</tbody></table>{!slides.length ? <div className="admin-carousel-empty"><strong>No hay placas cargadas</strong><span>Crealas primero desde el módulo Carrusel.</span></div> : null}</div>
        {slideDraft ? <section className="admin-sponsored-editor"><div className="admin-sponsored-editor__head"><div><h3>Patrocinar {slideDraft.value.title || slideDraft.value.imageAlt || `placa ${slideDraft.index + 1}`}</h3><p>La placa conservará su diseño, botón y destino actuales.</p></div><button type="button" className="btn ghost" onClick={() => setSlideDraft(null)}>Cancelar</button></div><div className="admin-carousel-fields"><label><span>ID de campaña</span><input className="admin-input" value={slideDraft.value.campaignId} onChange={(event) => setSlideDraft((current) => current ? { ...current, value: { ...current.value, campaignId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") } } : current)}/></label><label><span>Nombre de campaña</span><input className="admin-input" value={slideDraft.value.campaignName} onChange={(event) => setSlideDraft((current) => current ? { ...current, value: { ...current.value, campaignName: event.target.value } } : current)}/></label><label><span>Marca / anunciante</span><input className="admin-input" value={slideDraft.value.advertiser} onChange={(event) => setSlideDraft((current) => current ? { ...current, value: { ...current.value, advertiser: event.target.value } } : current)}/></label><label><span>Inicio</span><input className="admin-input" type="date" value={slideDraft.value.campaignStart} onChange={(event) => setSlideDraft((current) => current ? { ...current, value: { ...current.value, campaignStart: event.target.value } } : current)}/></label><label><span>Fin</span><input className="admin-input" type="date" min={slideDraft.value.campaignStart} value={slideDraft.value.campaignEnd} onChange={(event) => setSlideDraft((current) => current ? { ...current, value: { ...current.value, campaignEnd: event.target.value } } : current)}/></label></div><div className="admin-carousel-save"><button type="button" className="btn success" onClick={applySlide}>Aplicar patrocinio</button></div></section> : null}
        <div className="admin-carousel-save"><button type="button" className="btn success" disabled={loading || Boolean(slideDraft) || saving === "slides"} onClick={() => void saveSlides()}>{saving === "slides" ? "Guardando..." : "Guardar carrusel patrocinado"}</button></div>
      </div>
    </section>
  </div>;
}
