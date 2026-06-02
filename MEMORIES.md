# Memories

## Proyecto

- Repo local: `D:\TIENDA ONLINE\tienda-online-main`
- Stack principal: `Next.js 16` + `React 19` + `TypeScript` + `Tailwind CSS v4` + `Framer Motion` + `Zustand`
- Objetivo del repo: tienda online tipo "listita", donde el usuario arma una lista, recibe sugerencias de productos y agrega variantes al carrito.

## Regla de trabajo acordada

- Trabajar solo con archivos dentro de este repositorio.
- Si una tarea depende de otros archivos de tu app principal, Firebase, o datos externos no disponibles en esta PC, se deja anotada para otro dia.

## Estructura importante

- `src/app/page.tsx`: pantalla principal. Maneja landing, builder, lista, carrito, modales, categorias y flujo general.
- `src/components/`: UI principal de la tienda. Hay modales, paneles, top bar, lista y tarjetas.
- `src/lib/products.ts`: carga del catalogo, cache en `localStorage`, busqueda por token y sugerencias.
- `src/app/api/catalog/route.ts`: API local de Next para exponer el catalogo al frontend.
- `src/store/cart.ts`: carrito persistido con Zustand (`listita_cart_v1`).
- `src/auth/AuthProvider.tsx`: login/signup/logout y sesion con Firebase Auth.
- `src/lib/userProfile.ts`: perfiles de usuario, usernames y direcciones en Firestore.
- `src/lib/firebase.ts` y `src/lib/env.ts`: inicializacion de Firebase segun variables de entorno.

## Como obtiene productos

Orden de prioridad actual:

1. Frontend consume `GET /api/catalog`.
2. `src/app/api/catalog/route.ts` intenta leer:
   - `CATALOGO_SOURCE_URL` si existe, o
   - un archivo externo `..\..\catalogo\productos.json` relativo al repo.
3. Si eso no funciona en cliente, `src/lib/products.ts` puede caer en:
   - Firestore (`products`) si Firebase esta configurado.
   - `src/lib/seedProducts.ts` como ultimo fallback.

Conclusion practica:

- La UI y gran parte de la logica de tienda se pueden arreglar desde este repo.
- Cambios en el origen real del catalogo pueden requerir el archivo externo `catalogo/productos.json` o configuracion remota que hoy no esta disponible.

## Dependencias externas a tener presentes

- Firebase Auth: necesario para login y acceso al builder.
- Firestore: usado para perfiles (`users`, `usernames`) y potencialmente catalogo fallback (`products`).
- Variables de entorno `NEXT_PUBLIC_FIREBASE_*`.
- Posible fuente externa del catalogo:
  - `CATALOGO_SOURCE_URL`
  - `CATALOGO_VERSION_URL`
  - `CATALOGO_JSON_PATH`

## Comportamiento funcional observado

- La app tiene dos etapas: `landing` y `builder`.
- El `builder` esta bloqueado si no hay usuario autenticado.
- El carrito y la lista quedan sincronizados: si se elimina del carrito, tambien se ajusta la lista.
- Hay categorias generadas dinamicamente desde marcas del catalogo.
- Hay flujo especial para `Ofertas` y `Combos`.

## Riesgos o detalles a recordar

- En varios textos se ven caracteres mal codificados (`SÃºper`, `ConfiguraciÃ³n`, etc.). Posible tema de encoding a revisar si tocamos copies o archivos.
- No hay `git` instalado en esta PC al momento de descargar el repo; el proyecto se bajó como ZIP.
- Existe una carpeta `.next_listita`, probablemente build/cache previa; no asumir que representa el estado fuente.

## Archivos que probablemente tocaremos seguido

- `src/app/page.tsx`
- `src/components/SuperList.tsx`
- `src/components/OptionsModal.tsx`
- `src/components/CartPanel.tsx`
- `src/components/OffersPanel.tsx`
- `src/components/TopBar.tsx`
- `src/lib/products.ts`
- `src/app/globals.css`

## Criterio para futuras sesiones

- Primero revisar `MEMORIES.md`.
- Antes de cambiar logica de catalogo o auth, confirmar si la tarea depende solo del repo o de archivos/servicios externos.
- Priorizar arreglos visuales, UX y logica local de la tienda, que son seguros de trabajar desde esta PC.
- Despues de cada actualizacion, siempre aumentar `APP_VERSION` en `src/lib/appVersion.ts`.
- Despues de cada actualizacion, siempre pasar el bloque de deploy listo para PowerShell junto con el cambio.
