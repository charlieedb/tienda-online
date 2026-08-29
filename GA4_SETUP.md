# Configuración de GA4 y Google Tag Manager

La aplicación ya envía eventos al `dataLayer`, aplica Consent Mode v2 y expone el reporte administrativo. Para activar la recolección faltan estos pasos externos.

## 1. GA4 y GTM

1. Crear una propiedad GA4 de JOMA y un flujo web para `https://www.jomagroup.com.ar`.
2. Crear un contenedor web de Google Tag Manager.
3. Configurar `VITE_GTM_ID=GTM-XXXXXXX` en Vercel.
4. En GTM crear una **Google tag** con el ID `G-XXXXXXXXXX`, disparador `Initialization - All Pages` y envío automático de page view desactivado.
5. Crear una etiqueta **GA4 Event** que use `{{Event}}` como nombre y se dispare para los eventos personalizados del `dataLayer`.
6. Validar en Tag Assistant y GA4 DebugView antes de publicar el contenedor.

Eventos disponibles: `page_view`, `view_item_list`, `select_item`, `view_item`, `search`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `view_promotion`, `select_promotion`, `login` y `sign_up`.

## 2. Dimensiones de campañas

El panel usa las dimensiones ecommerce estándar `itemPromotionId`, `itemPromotionName`, `itemPromotionCreativeSlot` e `itemBrand`; no hace falta registrar dimensiones personalizadas para los indicadores principales. Opcionalmente puede registrarse `attribution_type` como dimensión personalizada de evento para analizar clic frente a impresión directamente en las exploraciones de GA4.

## 3. Acceso del panel administrativo

1. En Google Cloud habilitar **Google Analytics Data API**.
2. Crear una cuenta de servicio de JOMA y agregar su correo como lector de la propiedad GA4.
3. Configurar en Vercel, solo como secretos de servidor:
   - `GA4_PROPERTY_ID`
   - `GA4_CLIENT_EMAIL` y `GA4_PRIVATE_KEY` solo si se desea usar una cuenta distinta de Firebase Admin.
4. Configurar una cuenta de servicio Firebase Admin:
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
5. Mantener `NEXT_PUBLIC_FIREBASE_PROJECT_ID` con el proyecto actual.

Las claves privadas multilínea pueden guardarse con saltos `\n`. Nunca deben usar prefijo `VITE_` o `NEXT_PUBLIC_`.

## 4. Verificación

- Rechazar opcionales: no deben aparecer eventos ecommerce en `dataLayer`.
- Aceptar analítica: deben verse eventos ecommerce, pero no debe persistirse atribución publicitaria.
- Aceptar publicidad: las placas y productos patrocinados deben emitir `view_promotion` al permanecer visibles un segundo y `select_promotion` al interactuar.
- Completar un pedido de prueba y comprobar un solo `purchase` con el ID real del pedido.
- Abrir Administrador > Reportes; la primera consulta puede demorar y las siguientes usan caché de cinco minutos.

GA4 comienza a reunir datos desde la activación y puede demorar entre 24 y 48 horas en completar los informes estándar.
