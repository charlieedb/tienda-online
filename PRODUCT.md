# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

La Tienda Online está dirigida a dos públicos:

- Consumidores finales que compran productos para su hogar.
- Comercios que necesitan abastecerse y pueden comprar productos por unidad o por caja.

Los usuarios suelen acceder desde el celular y necesitan encontrar productos, comparar presentaciones, aprovechar promociones y completar su pedido con rapidez y confianza.

Cuando una persona registra su local comercial y el registro es aprobado, obtiene un cupón de descuento para usar en la tienda.

## Product Purpose

Permitir que consumidores y comercios armen pedidos online seleccionando productos individualmente, eligiendo compra por unidad o por caja y aprovechando las promociones disponibles.

El producto existe para simplificar la compra y el abastecimiento local. El éxito significa que una persona pueda descubrir productos, comprender precios y promociones, completar su carrito y coordinar la entrega sin confusión ni pasos innecesarios.

## Positioning

La tienda reúne en una misma experiencia la compra minorista y comercial: permite elegir presentaciones por unidad o por caja, ofrece promociones por cantidad y ofertas sobre productos específicos, y reconoce a los comercios registrados con beneficios propios.

No es un buscador basado en una lista escrita por el usuario. La idea original de ingresar una “listita” para que el sistema buscara productos fue descartada; la experiencia vigente es la de una tienda online con catálogo y carrito.

## Operating Context

- El usuario navega el catálogo, las categorías, las ofertas y los productos destacados.
- Cada producto puede comprarse por unidad o por caja cuando ambas presentaciones están disponibles.
- El carrito conserva la separación entre presentaciones, promociones y cantidades a precio normal.
- Los clientes pueden registrar un comercio y, una vez aprobado, recibir un cupón de descuento.
- El pedido se completa con datos del cliente y una entrega programada.
- La operación, los pedidos, los clientes, los cupones, las promociones, el catálogo visible y otros contenidos de la tienda se administran desde un panel privado.

## Capabilities and Constraints

- Ofrece productos individuales y presentaciones por caja.
- Admite promociones por cantidad y ofertas aplicadas a productos específicos.
- Los límites promocionales determinan cuántas unidades reciben el precio especial, pero no restringen la cantidad total que el usuario puede comprar.
- Los cupones respetan las condiciones de cada promoción y no se aplican indebidamente sobre unidades ya promocionadas.
- El stock publicado proviene del catálogo operativo y los productos sin stock disponible no deben ofrecerse como comprables.
- La cobertura actual de entrega es únicamente Corrientes Capital.
- Está prevista una futura expansión a Resistencia, Riachuelo, San Luis del Palmar, Paso de la Patria y San Cosme. Las fechas y el orden de habilitación todavía no están definidos.
- Firebase gestiona autenticación, perfiles, pedidos, promociones, cupones, notificaciones y permisos administrativos.
- El panel administrador utiliza acceso con Google restringido a una lista configurable de correos autorizados.
- Deben evitarse lecturas innecesarias de Firestore; los datos se cachean y solo se recargan automáticamente cuando existe una necesidad operativa confirmada.

## Brand Commitments

- Nombre principal: JOMA Express.
- Voz ágil, clara y cercana, con mensajes directos y humanos.
- La experiencia debe transmitir confianza operativa y una compra fácil de resolver.
- Activos de marca disponibles en `public/`, incluidos los logotipos de JOMA Express y Joma Group.

## Evidence on Hand

- Catálogo real de productos consumido por la API de la tienda.
- Precios, stock, ofertas por producto, promociones por cantidad y presentaciones por unidad o caja.
- Flujo real de registro de comercios y emisión de cupones.
- Pedidos, clientes, configuraciones de entrega, carruseles, notificaciones y reportes administrables desde el panel.
- Implementación vigente en `src/` y aplicación publicada en `https://jomaexpress.vercel.app/`.
- No deben inventarse testimonios, métricas comerciales, tiempos de entrega ni fechas de expansión que no estén respaldados por datos reales.

## Product Principles

- Hacer que comprar por unidad o por caja sea fácil de entender en todo momento.
- Mostrar precios, promociones, límites y condiciones antes de que el usuario tome una decisión.
- Servir a consumidores y comercios sin duplicar ni fragmentar innecesariamente la experiencia.
- Priorizar un proceso de compra rápido, confiable y adaptado al uso desde el celular.
- Expandir la cobertura solo cuando cada localidad esté operativamente habilitada.

## Accessibility & Inclusion

Priorizar legibilidad, contraste suficiente, navegación mediante teclado, estados comprensibles sin depender únicamente del color y áreas táctiles amplias. Los inputs deben mantener un mínimo de 16 px en iPhone para evitar zoom involuntario. La experiencia debe funcionar correctamente en navegadores móviles e in-app, con animaciones reducidas cuando el usuario así lo solicite.
