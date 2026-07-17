# Tests

Zero-dependency tests using Node's built-in runner (`node:test` + `node:assert`).
No install needed — requires Node 18+ (this project runs on Node 24).

## Run

```bash
npm test
```

or directly:

```bash
node --test test/
```

## What is covered

| File | Catches |
|------|---------|
| `syntax.test.js` | Any syntax error in every file under `js/` and `server/` (`node --check`). The broad safety net. |
| `catalog.test.js` | `server/catalog.js` integrity: category counts, cat9 = 8 colour products, unique ids, **every product image file actually exists on disk**, colour labels in titles. |
| `products.test.js` | `js/products.js` logic: built-in colour variants (6 + 2 groups), admin-declared `variantGroup` linking, sale helpers, custom multi-image products. |
| `images.test.js` | `js/images.js`: `webp()` path building and `hasDerivatives()` (uploads/CDN must NOT get a broken `.webp`). |

## Notes

- Frontend scripts (`js/*.js`) are browser IIFEs; `helpers/browser-env.js` loads
  them in an isolated VM with a minimal `window`/`document` stub so their
  `window.Nostalgia*` API can be asserted in Node.
- These are **offline** tests — they do not need PostgreSQL or a running server.
  The DB layer (`server/db.js`) and HTTP routes are not exercised here.
