# Lanzamiento SEO de Joma Group

## Datos comerciales por confirmar

- Confirmar que `Av. Maipú 7249, Corrientes Capital` y `0379 439-0919` coincidan exactamente con la ficha verificada de Joma Group.
- Incorporar horarios, coordenadas y URL directa de Google Maps en `src/lib/seo.ts` y en el JSON-LD del generador.
- Incorporar dirección, teléfono, horarios, coordenadas y URL directa de la ficha de Jónico en su página y datos estructurados.
- Mantener Joma Group y Jónico como entidades separadas. No crear una ficha adicional para Joma Express.

## Antes de publicar

- Revisar por localhost `/`, `/categorias`, una categoría, un producto, `/envios-corrientes`, `/locales`, `/jonico` y las páginas legales.
- Exportar desde Google Search Console o Analytics las URLs históricas de `jomagroup.com.ar` y preparar redirecciones 301 individuales. No redirigir todo a la portada.
- Configurar `VITE_GTM_ID` en Vercel y publicar el contenedor con eventos `page_view`, `add_to_cart` y `begin_checkout`.
- Verificar el dominio completo en Search Console por DNS y enviar `https://jomagroup.com.ar/sitemap.xml`.
- Revisar `robots.txt`, sitemap, canónicas y Rich Results después del deploy.
- Vincular la portada desde la ficha de Joma Group y `/jonico` desde la ficha de Jónico.

## Después de publicar

- Solicitar indexación de la portada, categorías principales, página de envíos y locales.
- Activar Merchant Center únicamente después de validar precios, stock, imágenes y políticas del catálogo.
- Controlar errores 404, páginas excluidas, Core Web Vitals y consultas locales durante ocho semanas.
- Añadir Resistencia solo cuando exista logística y cobertura real.
