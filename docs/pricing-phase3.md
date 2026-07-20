# Server-side Pricing Phase 3

## Scope

Phase 3 introduces a central server-side pricing domain for the hybrid catalog. It
supports static catalog products with database overrides, custom database products,
and database variants. It does not replace the legacy `/api/orders` flow yet.

The browser may provide product and variant identifiers, quantities, coupon code,
shipping method, payment method, and destination country. Monetary fields are
rejected. Prices, sales, coupon rules, VAT, shipping, COD fees, stock visibility,
and the final total are read or calculated by the server.

## Exact money model

- Database `NUMERIC` values are parsed from decimal strings into `BigInt` cents.
- Hidden precision beyond two money decimals is rejected, not silently rounded.
- Percentages and VAT rates use four-decimal fixed-point units.
- Multiplication and VAT calculations use deterministic half-up rounding.
- Fixed discounts use deterministic largest-remainder allocation.
- JavaScript floating-point arithmetic is not used for monetary calculations.

The payable formula is:

```text
grand_total = subtotal - discount_total + shipping_total + cod_fee
```

`subtotal`, shipping, and COD are payable gross amounts. `vat_total` is the VAT
portion included in those amounts. Tax-exclusive catalog prices are converted to
gross before totals and discount allocations are produced.

## Product resolution

The PostgreSQL repository preserves the current catalog precedence:

1. Static products use `server/catalog.js` for identity and `catalog_overrides` for
   price, sale, stock, SKU, active state, and optional VAT override.
2. Custom products use `products` for identity, price, sale, SKU, and active state,
   with stock from `catalog_overrides`.
3. A variant with its own price uses its own regular and sale price. A variant with
   no price inherits the base product price and sale.
4. Variant stock and availability override the base purchasable unit.
5. VAT uses a variant/product override when present, otherwise the active country
   and tax-category rule from `tax_rates`.

Sale prices that are expired, equal to, or above the regular price are ignored.

## Coupon rules

Coupons can enforce active windows, currency, minimum subtotal, global usage limit,
per-customer usage limit, maximum discount, eligible products, eligible variants,
and free shipping. Product and variant allow-lists use union semantics. Empty lists
mean the coupon applies to every line.

Legacy `coupons.uses` is added to active Phase 3 redemption records. Future checkout
code must create `coupon_redemptions` and must not also increment `coupons.uses`.

## Shipping and tax configuration

Migration 004 intentionally does not seed shipping prices or VAT rates. They are
business and legal configuration and require explicit approval. Applying the
migration alone does not affect legacy checkout. The new service fails closed when
a shipping method or required VAT rule is missing.

An empty `supported_country_codes` array means no country restriction. A populated
array must contain uppercase ISO 3166-1 alpha-2 codes.

## Transaction use

`priceOrder()` accepts an existing PostgreSQL client. `lockRows: true` adds shared
row locks, but callers must already have opened a transaction for those locks to
span the full operation. Phase 5 will call the service again inside the atomic order
creation transaction. A preview quote can never authorize an order total.

## Structured logs

Successful calculations log only request ID, currency, line count, shipping method,
payment method, and grand total. Customer details, coupon customer keys, secrets,
and payment credentials are not logged.

## Known limitations

- The legacy checkout still uses `server/fees.js` and floating-point totals.
- No HTTP quote endpoint is introduced in this phase.
- Stock is checked but not reserved. Atomic reservations belong to Phase 4.
- Coupon redemption is modeled but not reserved or consumed until Phase 5.
- Tax and shipping rules require approved production configuration.
- SKU indexes are non-unique because legacy data spans three catalog tables. A
  future data cleanup is required before cross-catalog SKU uniqueness is possible.
- Historical orders are unchanged and no production backfill is performed.

