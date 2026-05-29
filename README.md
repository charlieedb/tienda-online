## Listita de Súper (MVP)

MVP de tienda online con experiencia “listita de papel”: el usuario escribe ítems (palabras sueltas), el sistema sugiere productos por ítem desde Firestore (o seed local si falta config) y permite agregar al carrito con micro‑animaciones.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Firebase / Firestore (opcional en MVP)

1) Copiá `.env.local.example` a `.env.local` y completá tus credenciales.
2) En Firestore creá colección `products` con documentos tipo:

```ts
{
  name: string,
  brand?: string,
  imageUrl?: string,
  unit: { label: string, price: number },
  pack?: { qty: number, label: string, price: number },
  keywords: string[], // e.g. ["arroz", "atun", "aceite"]
  active: boolean
}
```

Si no configurás Firebase, la app usa productos de ejemplo en `src/lib/seedProducts.ts`.

### Firestore rules (MVP)

Para prueba rápida (catálogo público, sin escrituras):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if resource.data.active == true;
      allow write: if false;
    }
  }
}
```
