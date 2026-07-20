# Admin product content

The React admin uses one shared product-content editor for product creation and
editing. This prevents the two forms from drifting apart again.

## Editable content

- Product colour family used by storefront filters.
- Greek and English short descriptions.
- Greek and English badges, features and full descriptions.
- Greek and English specifications in `Label: Value` format.
- Care instructions, shipping/returns copy and package contents.
- Perfume top, heart and base notes.
- Diffuser notes, duration and capacity.
- Custom-product category, Greek/English title and base image gallery.

Colour variants remain in `product_variants`. They are not represented through
the legacy `variantGroup` fields. Each variant continues to own its SKU, price,
stock, availability and colour-specific images.

## Data safety

The editor starts with the complete existing `details` JSON object and overwrites
only fields it owns. Unknown and legacy keys are retained on save. The server then
normalizes lists, badges, specifications, scent notes and diffuser data to their
canonical JSON shapes.

Create, update and delete operations for products and variants write sanitized
audit events. Image payloads and full content values are never copied into audit
metadata; only identifiers and changed field names are recorded.

For custom products, selecting new base images replaces the saved gallery. A
pending image selection can be cancelled before save. Up to three PNG, JPEG, WEBP
or GIF images of 10 MB each are accepted.

## Manual QA

1. Create a product with Greek and English content in every section.
2. Reopen it under **Products & Stock → Content** and confirm every value returns.
3. Change only English content and confirm Greek content remains unchanged.
4. Edit a static product and confirm its unknown existing detail keys remain.
5. Edit a custom title, category and gallery and confirm the storefront updates.
6. Add two colour variants and confirm content remains shared while SKU, price,
   stock and images remain independent.
7. Verify the form with keyboard navigation and at a narrow mobile viewport.
