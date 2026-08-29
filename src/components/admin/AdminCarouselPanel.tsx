import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Category, Product } from "@/catalog/types";
import { deleteCarouselPng, uploadCarouselPng } from "@/lib/carouselImages";
import {
  getStoreCarouselSlides,
  getFeaturedProductsConfig,
  saveSponsoredProducts,
  saveStoreCarouselSlides,
  type CarouselTargetType,
  type CarouselButtonAlign,
  type StoreCarouselSlide,
  type SponsoredProductCampaign,
} from "@/lib/featuredProducts";

function createSlide(): StoreCarouselSlide {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `slide-${Date.now()}`,
    mobileImageUrl: "",
    desktopImageUrl: "",
    imageAlt: "",
    eyebrow: "",
    title: "",
    subtitle: "",
    buttonLabel: "",
    targetType: "none",
    targetValue: "",
    textPosition: "top-left",
    titleSize: "large",
    buttonAlign: "left",
    campaignId: "",
    campaignName: "",
    advertiser: "",
    campaignStart: "",
    campaignEnd: "",
  };
}

export function AdminCarouselPanel({ user }: { user: User }) {
  const [slides, setSlides] = useState<StoreCarouselSlide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sponsoredProducts, setSponsoredProducts] = useState<SponsoredProductCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [previewModes, setPreviewModes] = useState<Record<string, "mobile" | "desktop">>({});

  useEffect(() => {
    let active = true;
    const catalog = createRemoteCatalog();
    Promise.all([
      getStoreCarouselSlides({ refresh: true }),
      catalog.getManifest(),
      catalog.getAllProducts(),
      getFeaturedProductsConfig(),
    ]).then(([storedSlides, manifest, allProducts, config]) => {
      if (!active) return;
      setSlides(storedSlides);
      setCategories(manifest.categories);
      setProducts(allProducts);
      setSponsoredProducts(config.sponsoredProducts);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar el carrusel.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const updateSlide = (id: string, patch: Partial<StoreCarouselSlide>) => {
    setMessage("");
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...patch } : slide));
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    setSlides((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  };

  const uploadImage = async (slide: StoreCarouselSlide, file: File, viewport: "mobile" | "desktop") => {
    const key = `${slide.id}-${viewport}`;
    setUploadingKey(key);
    setMessage("");
    try {
      const url = await uploadCarouselPng(file, slide.id, viewport);
      updateSlide(slide.id, viewport === "mobile" ? { mobileImageUrl: url } : { desktopImageUrl: url });
      setMessage(`PNG para ${viewport === "mobile" ? "móvil" : "PC"} cargado. Guardá el carrusel para publicarlo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir el PNG.");
    } finally {
      setUploadingKey("");
    }
  };

  const removeImage = async (slide: StoreCarouselSlide, viewport: "mobile" | "desktop") => {
    const url = viewport === "mobile" ? slide.mobileImageUrl : slide.desktopImageUrl;
    if (!url) return;
    const key = `${slide.id}-${viewport}`;
    setUploadingKey(key);
    setMessage("");
    try {
      await deleteCarouselPng(url);
      updateSlide(slide.id, viewport === "mobile" ? { mobileImageUrl: "" } : { desktopImageUrl: "" });
      setMessage(`PNG para ${viewport === "mobile" ? "móvil" : "PC"} eliminado. Guardá el carrusel para aplicar el cambio.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el PNG.");
    } finally {
      setUploadingKey("");
    }
  };

  const save = async () => {
    const invalid = slides.find((slide) =>
      !slide.mobileImageUrl && !slide.desktopImageUrl && !slide.title.trim(),
    );
    if (invalid) {
      setMessage("Cada placa necesita al menos una imagen o un título.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveStoreCarouselSlides(slides, user.email || user.uid);
      await saveSponsoredProducts(sponsoredProducts, user.email || user.uid);
      setMessage("Carrusel guardado. La tienda mostrará las placas en este orden.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el carrusel.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="admin-content-box admin-carousel-config">
    <section className="admin-card">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Editar carrusel</h1>
          <p>Administrá las placas del inicio. La imagen contiene todo el diseño y el texto; acá configurás únicamente el botón.</p>
        </div>
        <button type="button" className="btn primary" disabled={loading} onClick={() => setSlides((current) => [...current, createSlide()])}>
          + Nueva placa
        </button>
      </div>
      <div className="admin-card__body">
        {message ? <div className="admin-users-message" role="status">{message}</div> : null}
        {loading ? <div className="admin-carousel-empty">Cargando carrusel...</div> : null}
        {!loading && !slides.length ? <div className="admin-carousel-empty">No hay placas personalizadas. La tienda mostrará la portada habitual.</div> : null}
        <div className="admin-carousel-list">
          {slides.map((slide, index) => <article className="admin-carousel-item" key={slide.id}>
            <div className="admin-carousel-item__head">
              <div><b>{index + 1}</b><strong>Placa {index + 1}</strong></div>
              <div className="admin-carousel-item__actions">
                <button type="button" onClick={() => moveSlide(index, -1)} disabled={index === 0} aria-label="Mover placa hacia arriba">↑</button>
                <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} aria-label="Mover placa hacia abajo">↓</button>
                <button type="button" className="is-remove" onClick={() => setSlides((current) => current.filter((item) => item.id !== slide.id))}>Eliminar</button>
              </div>
            </div>

            <div className="admin-carousel-upload-grid">
              <div className="admin-carousel-upload">
                <span>PNG para móvil</span>
                <small>Recomendado: 720 × 420 px, máximo 4 MB.</small>
                {slide.mobileImageUrl ? <img src={slide.mobileImageUrl} alt="" /> : <i>Vista móvil</i>}
                <input id={`carousel-mobile-${slide.id}`} type="file" accept="image/png" disabled={Boolean(uploadingKey)} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(slide, file, "mobile");
                  event.currentTarget.value = "";
                }}/>
                <label className="admin-carousel-upload-button" htmlFor={`carousel-mobile-${slide.id}`}>{uploadingKey === `${slide.id}-mobile` ? "Procesando..." : slide.mobileImageUrl ? "Reemplazar PNG móvil" : "Subir PNG móvil"}</label>
                {slide.mobileImageUrl ? <button type="button" className="admin-carousel-remove-image" disabled={Boolean(uploadingKey)} onClick={() => void removeImage(slide, "mobile")}>Quitar PNG móvil</button> : null}
              </div>
              <div className="admin-carousel-upload">
                <span>PNG para PC</span>
                <small>Recomendado: 1440 × 420 px, máximo 4 MB.</small>
                {slide.desktopImageUrl ? <img src={slide.desktopImageUrl} alt="" /> : <i>Vista PC</i>}
                <input id={`carousel-desktop-${slide.id}`} type="file" accept="image/png" disabled={Boolean(uploadingKey)} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(slide, file, "desktop");
                  event.currentTarget.value = "";
                }}/>
                <label className="admin-carousel-upload-button" htmlFor={`carousel-desktop-${slide.id}`}>{uploadingKey === `${slide.id}-desktop` ? "Procesando..." : slide.desktopImageUrl ? "Reemplazar PNG PC" : "Subir PNG PC"}</label>
                {slide.desktopImageUrl ? <button type="button" className="admin-carousel-remove-image" disabled={Boolean(uploadingKey)} onClick={() => void removeImage(slide, "desktop")}>Quitar PNG PC</button> : null}
              </div>
            </div>

            <div className="admin-carousel-preview-block">
              <div className="admin-carousel-preview-toolbar">
                <div><strong>Vista previa en tiempo real</strong><span>Usa el mismo tamaño y recorte de la tienda.</span></div>
                <div>
                  <button type="button" className={(previewModes[slide.id] ?? "mobile") === "mobile" ? "is-active" : ""} onClick={() => setPreviewModes((current) => ({ ...current, [slide.id]: "mobile" }))}>Móvil</button>
                  <button type="button" className={previewModes[slide.id] === "desktop" ? "is-active" : ""} onClick={() => setPreviewModes((current) => ({ ...current, [slide.id]: "desktop" }))}>PC</button>
                </div>
              </div>
              <div className={`hero-card has-custom-slide admin-carousel-live-preview is-${previewModes[slide.id] ?? "mobile"}`}>
                {slide.mobileImageUrl || slide.desktopImageUrl ? <picture className="hero-custom-picture">
                  <img
                    src={(previewModes[slide.id] ?? "mobile") === "desktop"
                      ? slide.desktopImageUrl || slide.mobileImageUrl
                      : slide.mobileImageUrl || slide.desktopImageUrl}
                    alt=""
                  />
                </picture> : null}
                <div className="hero-carousel-stage">
                  <div className="hero-carousel-slide">
                    {slide.buttonLabel && slide.targetType !== "none" ? <div className={`hero-actions align-${slide.buttonAlign}`}><button type="button">{slide.buttonLabel} →</button></div> : null}
                  </div>
                </div>
                <div className="hero-carousel-dots" aria-hidden="true"/>
              </div>
            </div>

            <div className="admin-carousel-fields">
              <label><span>ID de campaña <em>Opcional</em></span><input className="admin-input" value={slide.campaignId} onChange={(event) => updateSlide(slide.id, { campaignId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })} placeholder="Ej: coca-verano-2026"/></label>
              <label><span>Nombre de campaña</span><input className="admin-input" value={slide.campaignName} onChange={(event) => updateSlide(slide.id, { campaignName: event.target.value })} placeholder="Ej: Verano Coca-Cola"/></label>
              <label><span>Marca / anunciante</span><input className="admin-input" value={slide.advertiser} onChange={(event) => updateSlide(slide.id, { advertiser: event.target.value })} placeholder="Ej: Coca-Cola"/></label>
              <label><span>Inicio de campaña</span><input className="admin-input" type="date" value={slide.campaignStart} onChange={(event) => updateSlide(slide.id, { campaignStart: event.target.value })}/></label>
              <label><span>Fin de campaña</span><input className="admin-input" type="date" value={slide.campaignEnd} onChange={(event) => updateSlide(slide.id, { campaignEnd: event.target.value })}/></label>
              <label><span>Texto del botón <em>Opcional</em></span><input className="admin-input" value={slide.buttonLabel} onChange={(event) => updateSlide(slide.id, { buttonLabel: event.target.value })} placeholder="Ej: Ver vinos"/></label>
              <label><span>Alineación del botón</span><select className="admin-input" value={slide.buttonAlign} onChange={(event) => updateSlide(slide.id, { buttonAlign: event.target.value as CarouselButtonAlign })}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select></label>
              <label><span>Destino del botón</span><select className="admin-input" value={slide.targetType} onChange={(event) => updateSlide(slide.id, { targetType: event.target.value as CarouselTargetType, targetValue: "" })}>
                <option value="none">Sin botón / sin destino</option>
                <option value="categories">Todas las categorías</option>
                <option value="category">Una categoría específica</option>
                <option value="search">Una búsqueda</option>
                <option value="cart">Carrito</option>
              </select></label>
              {slide.targetType === "category" ? <label><span>Categoría de destino</span><select className="admin-input" value={slide.targetValue} onChange={(event) => updateSlide(slide.id, { targetValue: event.target.value })}>
                <option value="">Elegir categoría</option>
                {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select></label> : null}
              {slide.targetType === "search" ? <label><span>Término de búsqueda</span><input className="admin-input" value={slide.targetValue} onChange={(event) => updateSlide(slide.id, { targetValue: event.target.value })} placeholder="Ej: Malbec"/></label> : null}
            </div>
            {slide.targetType === "category" && slide.targetValue ? <p className="admin-carousel-destination">Destino: {categoryById.get(slide.targetValue)?.name || slide.targetValue}</p> : null}
          </article>)}
        </div>
        <div className="admin-carousel-save">
          <button type="button" className="btn success" onClick={() => void save()} disabled={saving || loading || Boolean(uploadingKey)}>
            {saving ? "Guardando..." : "Guardar carrusel"}
          </button>
        </div>
        <section className="admin-card mt-5">
          <div className="admin-card__head"><div><div className="admin-kicker">Publicidad</div><h2 className="admin-section-title">Productos patrocinados</h2><p>Asociá productos a una campaña para medir impresiones, clics y compras atribuidas.</p></div><button type="button" className="btn primary" onClick={() => { const product = products.find((item) => !sponsoredProducts.some((entry) => entry.productId === item.id)); if (product) setSponsoredProducts((current) => [...current, { productId: product.id, campaignId: "", campaignName: "", advertiser: product.brand || "", campaignStart: "", campaignEnd: "" }]); }} disabled={sponsoredProducts.length >= products.length}>+ Producto patrocinado</button></div>
          <div className="admin-card__body"><div className="admin-carousel-list">{sponsoredProducts.map((entry, index) => <article className="admin-carousel-item" key={`${entry.productId}-${index}`}><div className="admin-carousel-fields"><label><span>Producto</span><select className="admin-input" value={entry.productId} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value } : item))}>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.id}</option>)}</select></label><label><span>ID de campaña</span><input className="admin-input" value={entry.campaignId} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, campaignId: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") } : item))}/></label><label><span>Nombre de campaña</span><input className="admin-input" value={entry.campaignName} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, campaignName: event.target.value } : item))}/></label><label><span>Marca / anunciante</span><input className="admin-input" value={entry.advertiser} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, advertiser: event.target.value } : item))}/></label><label><span>Inicio</span><input className="admin-input" type="date" value={entry.campaignStart} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, campaignStart: event.target.value } : item))}/></label><label><span>Fin</span><input className="admin-input" type="date" value={entry.campaignEnd} onChange={(event) => setSponsoredProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, campaignEnd: event.target.value } : item))}/></label></div><button type="button" className="btn ofertas-danger" onClick={() => setSponsoredProducts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar patrocinio</button></article>)}</div>{!sponsoredProducts.length ? <div className="admin-carousel-empty">Todavía no hay productos patrocinados.</div> : null}<div className="admin-carousel-save"><button type="button" className="btn success" onClick={() => void save()} disabled={saving || loading}>{saving ? "Guardando..." : "Guardar campañas"}</button></div></div>
        </section>
      </div>
    </section>
  </div>;
}
