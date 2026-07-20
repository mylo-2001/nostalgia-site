# Admin product variants

## Data model

`product_variants` is the purchasable unit for a product that has colour options.
The base product owns shared content; each variant owns its colour, SKU, price,
sale, stock, availability and image gallery. Cart, pricing and order creation use
the variant ID. Order items retain product and variant snapshots.

Required invariants:

- `(product_id, lower(trim(color)))` is unique.
- `lower(trim(sku))` is unique across variants.
- Colour, SKU, price and stock are required.
- Price and stock cannot be negative.
- A sale price, when present, is positive and lower than the regular price.
- A colour swatch is empty or a six-digit CSS hex value.

## Admin workflow

1. Open **Προϊόντα & Stock** in `/admin-react`.
2. Find the existing base product and select **Παραλλαγές**.
3. Select **Προσθήκη παραλλαγής**.
4. Choose a colour preset or enter a custom label and swatch.
5. Enter the unique SKU, price and stock for this colour.
6. Optionally enter a sale and upload up to three colour-specific images.
7. Save. The base product is not duplicated.

Existing variants can be edited or disabled independently. Selecting new images
replaces the variant gallery; removing all images makes the storefront fall back
to the base product gallery.

## API contract

`POST /api/admin/products/:productId/variants` requires `color`, `sku`, `price`
and `stock`. It accepts `colorEn`, `colorHex`, `salePrice`, `saleDays`, `available`
and up to three image data URLs in `imagesData`.

`PATCH /api/admin/variants/:variantId` updates only the submitted commercial
fields. Set `replaceImages: true` and provide `imagesData` to replace the gallery;
an empty array removes the variant-specific gallery.

Expected conflict codes are `variant_color_exists` and `variant_sku_exists`.

## Migration and rollback

Run the read-only preflight first:

```sh
psql "$DATABASE_URL" -f server/migrations/preflight/product_variant_integrity_preflight.sql
```

All three result sets must be empty. Then apply migrations with:

```sh
npm run migrate:up
```

Migrations `026` and `027` add checks and unique indexes only. They do not update
or delete product data. Roll back `027` before `026` with the normal migration
runner. Rolling back removes database enforcement but does not remove variants.

## Manual QA

- Add two colours to one product and confirm both appear under the same product.
- Confirm each swatch changes image gallery, SKU, price and stock in the store.
- Confirm the cart and checkout send the selected variant ID.
- Try a duplicate colour on the same product and expect a clear conflict.
- Try a duplicate SKU on another product and expect a clear conflict.
- Set stock to zero and verify checkout rejects purchase.
- Disable a variant and verify it cannot be purchased.
- Replace and remove a variant gallery and verify base-image fallback.
- Verify the editor remains usable on a narrow mobile viewport and by keyboard.

