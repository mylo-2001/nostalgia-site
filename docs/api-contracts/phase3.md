# Phase 3 Pricing Contract

Phase 3 introduces no public HTTP route. The internal service is:

```js
await priceOrder({ client, request, requestId, now, lockRows, logger });
```

Accepted request data:

```json
{
  "items": [
    { "productId": "cat1-1", "variantId": null, "quantity": 2 }
  ],
  "couponCode": "SAVE10",
  "shippingMethodId": "home",
  "paymentMethod": "card",
  "destinationCountry": "GR",
  "customerKeyHash": null
}
```

`customerKeyHash` is optional unless a coupon has a per-customer limit. It must be a
lowercase SHA-256 hash produced by trusted server code. Raw email or phone values do
not belong in this field.

The service rejects browser-supplied `price`, `unitPrice`, `subtotal`, `discount`,
`shippingTotal`, `codFee`, `vatTotal`, `total`, or `grandTotal` fields.
Unknown request and line fields are also rejected; checkout routes must pass only the
pricing subset shown above.

The response contains immutable order-item snapshot candidates and an exact string
breakdown:

```json
{
  "currency": "EUR",
  "items": [
    {
      "productId": "cat1-1",
      "variantId": null,
      "productName": "Product name",
      "variantName": null,
      "sku": "SKU-1",
      "quantity": 2,
      "unitPrice": "8.00",
      "originalUnitPrice": "10.00",
      "discountAmount": "5.60",
      "vatRate": "24.0000",
      "vatAmount": "2.79",
      "lineSubtotal": "20.00",
      "lineTotal": "14.40",
      "currency": "EUR",
      "pricesIncludeTax": true
    }
  ],
  "shippingMethodId": "home",
  "paymentMethod": "card",
  "breakdown": {
    "subtotal": "20.00",
    "saleDiscountTotal": "4.00",
    "couponDiscountTotal": "1.60",
    "discountTotal": "5.60",
    "merchandiseTotal": "14.40",
    "shippingTotal": "3.50",
    "codFee": "0.00",
    "vatTotal": "3.47",
    "otherChargesTotal": "0.00",
    "grandTotal": "17.90"
  }
}
```

Amounts are decimal strings. Callers must not convert them to binary floats for
persistence or payment-provider requests.

Stable validation errors expose a `code`, safe message, and optional non-sensitive
details. Examples include `PRODUCT_PRICE_MISSING`, `INSUFFICIENT_STOCK`,
`COUPON_EXPIRED`, `COUPON_USAGE_LIMIT_REACHED`, `VAT_RATE_MISSING`,
`SHIPPING_COUNTRY_UNSUPPORTED`, and `CLIENT_PRICING_FIELD_FORBIDDEN`.
