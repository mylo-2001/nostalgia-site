(function () {
  /** Flat order fees (EUR) — keep in sync with server/fees.js */
  var SHIPPING_FEE = 3.5;
  var COD_FEE = 3.5;
  var FREE_SHIPPING_MIN = 80;
  var COUPON_META_KEY = "nostalgia-coupon-meta";

  var COURIERS = {
    elta: "ELTA",
    acs: "ACS",
  };

  function readCouponMeta() {
    try {
      var raw = localStorage.getItem(COUPON_META_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function couponGrantsFreeShipping() {
    var meta = readCouponMeta();
    return !!(meta && meta.freeShipping);
  }

  function extraFees(payment, subtotal) {
    var base = Number(subtotal) || 0;
    var freeShipping = base >= FREE_SHIPPING_MIN || couponGrantsFreeShipping();
    var shipping = freeShipping ? 0 : SHIPPING_FEE;
    var cod = payment === "cod" ? COD_FEE : 0;
    return { shipping: shipping, cod: cod, feesTotal: shipping + cod, freeShipping: freeShipping };
  }

  function formatFee(amount, lang) {
    if (!amount || amount <= 0) return lang === "en" ? "Free" : "Δωρεάν";
    var n = Number(amount).toFixed(2);
    if (lang === "en") return "+€" + n;
    return "+" + n.replace(".", ",") + " €";
  }

  function formatPrice(amount, lang) {
    var n = Number(amount || 0).toFixed(2);
    if (lang === "en") return "€" + n;
    return "€" + n.replace(".", ",");
  }

  function couponDiscount(subtotal) {
    var meta = readCouponMeta();
    var base = Number(subtotal) || 0;
    if (!meta || base <= 0) return 0;
    if (meta.type === "percent") {
      return Math.round((base * Number(meta.value)) / 100 * 100) / 100;
    }
    if (meta.value != null && Number(meta.value) > 0) {
      return Math.min(Number(meta.value), base);
    }
    return 0;
  }

  var GIFT_BOX_FEES = { premium: 4, wood: 8 };

  function giftBoxFee(boxType) {
    return GIFT_BOX_FEES[boxType] || 0;
  }

  function courierLabel(key, lang) {
    var id = String(key || "").toLowerCase();
    if (id === "acs") return COURIERS.acs;
    if (id === "elta") return COURIERS.elta;
    return lang === "en" ? "Not selected" : "Δεν επιλέχθηκε";
  }

  window.NostalgiaOrderFees = {
    SHIPPING_FEE: SHIPPING_FEE,
    COD_FEE: COD_FEE,
    FREE_SHIPPING_MIN: FREE_SHIPPING_MIN,
    COUPON_META_KEY: COUPON_META_KEY,
    COURIERS: COURIERS,
    readCouponMeta: readCouponMeta,
    couponGrantsFreeShipping: couponGrantsFreeShipping,
    extraFees: extraFees,
    formatFee: formatFee,
    formatPrice: formatPrice,
    couponDiscount: couponDiscount,
    giftBoxFee: giftBoxFee,
    GIFT_BOX_FEES: GIFT_BOX_FEES,
    courierLabel: courierLabel,
  };
})();
