(function () {
  /** Flat order fees (EUR) — keep in sync with server/fees.js */
  var SHIPPING_FEE = 3.5;
  var FREE_SHIPPING_MIN = 120;
  var COUPON_META_KEY = "nostalgia-coupon-meta";
  /* Legacy single-coupon keys, kept in sync so anything still reading them
     (and the server's `coupon` field) keeps working. */
  var COUPON_CODE_KEY = "nostalgia-coupon";
  /* New: an array of coupon metas — several codes can be stacked. */
  var COUPONS_KEY = "nostalgia-coupons";

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

  /* ---- multi-coupon store ---------------------------------------------
     Several codes can be applied at once. Percent coupons are ADDITIVE on
     the original subtotal (10% + 5% = 15%) and the total is capped at the
     subtotal — this must mirror resolveCoupons() in server/server.js. */

  function normalizeCoupon(entry) {
    if (!entry || typeof entry !== "object") return null;
    var code = String(entry.code || "").toUpperCase().trim();
    if (!code) return null;
    return {
      code: code,
      type: entry.type === "fixed" ? "fixed" : "percent",
      value: Number(entry.value) || 0,
      freeShipping: !!entry.freeShipping,
      firstOrderOnly: !!entry.firstOrderOnly,
    };
  }

  function readCoupons() {
    try {
      var raw = localStorage.getItem(COUPONS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          var out = [];
          for (var i = 0; i < arr.length; i++) {
            var c = normalizeCoupon(arr[i]);
            if (c && !hasCode(out, c.code)) out.push(c);
          }
          return out;
        }
      }
    } catch (e) {}
    /* Migrate a cart that still holds the old single-coupon keys. */
    var meta = readCouponMeta();
    var legacyCode = "";
    try { legacyCode = localStorage.getItem(COUPON_CODE_KEY) || ""; } catch (e) {}
    var merged = normalizeCoupon({
      code: (meta && meta.code) || legacyCode,
      type: meta && meta.type,
      value: meta && meta.value,
      freeShipping: meta && meta.freeShipping,
    });
    return merged ? [merged] : [];
  }

  function hasCode(list, code) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === String(code || "").toUpperCase().trim()) return true;
    }
    return false;
  }

  function writeCoupons(list) {
    var clean = [];
    for (var i = 0; i < (list || []).length; i++) {
      var c = normalizeCoupon(list[i]);
      if (c && !hasCode(clean, c.code)) clean.push(c);
    }
    try {
      if (clean.length) localStorage.setItem(COUPONS_KEY, JSON.stringify(clean));
      else localStorage.removeItem(COUPONS_KEY);
      /* Keep the legacy single-coupon keys pointing at the first code so any
         older code path (and the server's `coupon` field) still resolves. */
      if (clean.length) {
        localStorage.setItem(COUPON_CODE_KEY, clean[0].code);
        localStorage.setItem(COUPON_META_KEY, JSON.stringify(clean[0]));
      } else {
        localStorage.removeItem(COUPON_CODE_KEY);
        localStorage.removeItem(COUPON_META_KEY);
      }
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("nostalgia-coupon-updated"));
    } catch (e) {}
    return clean;
  }

  function addCoupon(entry) {
    var c = normalizeCoupon(entry);
    if (!c) return readCoupons();
    var list = readCoupons();
    if (hasCode(list, c.code)) return list;
    list.push(c);
    return writeCoupons(list);
  }

  function removeCoupon(code) {
    var want = String(code || "").toUpperCase().trim();
    var list = readCoupons().filter(function (c) { return c.code !== want; });
    return writeCoupons(list);
  }

  function clearCoupons() { return writeCoupons([]); }

  function couponCodes() {
    return readCoupons().map(function (c) { return c.code; });
  }

  function couponGrantsFreeShipping() {
    var list = readCoupons();
    for (var i = 0; i < list.length; i++) if (list[i].freeShipping) return true;
    return false;
  }

  function extraFees(payment, subtotal) {
    var base = Number(subtotal) || 0;
    var freeShipping = base >= FREE_SHIPPING_MIN || couponGrantsFreeShipping();
    var shipping = freeShipping ? 0 : SHIPPING_FEE;
    return { shipping: shipping, feesTotal: shipping, freeShipping: freeShipping };
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

  function singleCouponDiscount(meta, base) {
    if (!meta || base <= 0) return 0;
    if (meta.type === "percent") {
      return Math.round((base * Number(meta.value)) / 100 * 100) / 100;
    }
    if (meta.value != null && Number(meta.value) > 0) {
      return Math.min(Number(meta.value), base);
    }
    return 0;
  }

  /* Total discount across every applied coupon. Percentages are additive on
     the ORIGINAL subtotal and the sum is capped at it, matching the server. */
  function couponDiscount(subtotal) {
    var base = Number(subtotal) || 0;
    if (base <= 0) return 0;
    var list = readCoupons();
    var total = 0;
    for (var i = 0; i < list.length; i++) {
      total += singleCouponDiscount(list[i], base);
    }
    total = Math.round(total * 100) / 100;
    return Math.min(total, base);
  }

  /* Per-coupon breakdown for the cart summary rows. */
  function couponBreakdown(subtotal) {
    var base = Number(subtotal) || 0;
    return readCoupons().map(function (c) {
      return {
        code: c.code,
        type: c.type,
        value: c.value,
        freeShipping: c.freeShipping,
        discount: singleCouponDiscount(c, base),
      };
    });
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
    FREE_SHIPPING_MIN: FREE_SHIPPING_MIN,
    COUPON_META_KEY: COUPON_META_KEY,
    COUPON_CODE_KEY: COUPON_CODE_KEY,
    COUPONS_KEY: COUPONS_KEY,
    COURIERS: COURIERS,
    readCouponMeta: readCouponMeta,
    readCoupons: readCoupons,
    writeCoupons: writeCoupons,
    addCoupon: addCoupon,
    removeCoupon: removeCoupon,
    clearCoupons: clearCoupons,
    couponCodes: couponCodes,
    couponBreakdown: couponBreakdown,
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
