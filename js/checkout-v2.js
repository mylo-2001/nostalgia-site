(function () {
  "use strict";

  var enabled = false;
  var quoteSequence = 0;
  var configPromise = null;
  var ORDER_KEY = "nostalgia-v2-checkout-key";
  var PENDING_KEY = "nostalgia-pending-order";

  function api() {
    return window.NostalgiaAPI;
  }

  function randomKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var values = new Uint8Array(24);
    window.crypto.getRandomValues(values);
    return Array.prototype.map.call(values, function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
  }

  function loadConfig() {
    if (configPromise) return configPromise;
    if (!api()) return Promise.resolve(false);
    configPromise = api().get("/api/public-config").then(function (result) {
      enabled = !!(result && result.ok && result.checkoutV2Enabled);
      return enabled;
    }).catch(function () {
      enabled = false;
      return false;
    });
    return configPromise;
  }

  function productLines(lines) {
    return lines.map(function (line) {
      var variantId = line.product && line.product.variantOf ? line.id : null;
      return {
        productId: variantId ? line.product.variantOf : line.id,
        variantId: variantId,
        quantity: line.qty,
      };
    });
  }

  function quotePayload(context) {
    return {
      items: productLines(context.lines),
      couponCode: context.couponCode || null,
      shippingMethodId: context.shippingData.courier,
      paymentMethod: "card",
      destinationCountry: context.shippingData.countryCode,
      customerEmail: context.shippingData.email,
    };
  }

  function checkoutPayload(context) {
    var data = context.shippingData;
    var gift = data.gift && data.gift.isGift
      ? {
          isGift: true,
          boxType: data.gift.boxType || "",
          messageText: data.gift.messageText || "",
          shipOther: !!data.gift.shipOther,
          recipient: data.gift.recipient || "",
        }
      : { isGift: false };
    return {
      items: productLines(context.lines),
      couponCode: context.couponCode || null,
      shippingMethodId: data.courier,
      paymentMethod: "card",
      destinationCountry: data.countryCode,
      gift: gift,
      customer: {
        firstName: data.firstname,
        lastName: data.lastname,
        email: data.email,
        phone: data.mobile,
        notes: data.notes,
        documentType: data.docType,
        company: data.company,
        taxId: data.afm,
        taxOffice: data.doy,
        activity: data.activity,
      },
      shippingAddress: {
        firstName: data.firstname,
        lastName: data.lastname,
        line1: (data.street + " " + data.streetNumber).trim(),
        line2: data.floor ? "Floor: " + data.floor : "",
        city: data.city,
        region: data.prefecture,
        postalCode: data.postal,
        countryCode: data.countryCode,
        phone: data.mobile,
      },
      billingSameAsShipping: true,
      lang: context.lang,
      termsAccepted: !!context.termsAccepted,
      termsVersion: context.termsVersion,
    };
  }

  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  function storageRemove(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  function submit(context) {
    var checkoutKey = storageGet(ORDER_KEY) || randomKey();
    storageSet(ORDER_KEY, checkoutKey);
    return api().postWithHeaders("/api/v2/checkout", checkoutPayload(context), {
      "Idempotency-Key": checkoutKey,
    }).then(function (order) {
      if (!order || !order.ok || !order.orderId) {
        if (order && order.riskDecision === "card_required") storageRemove(ORDER_KEY);
        var orderError = new Error(order && order.error || "CHECKOUT_FAILED");
        orderError.code = order && (order.error || order.riskDecision) || "CHECKOUT_FAILED";
        orderError.response = order;
        throw orderError;
      }
      storageRemove(ORDER_KEY);
      var pending = {
        v2: true,
        lines: context.lines.map(function (line) {
          return { qty: line.qty, image: line.product.image, title: line.product.title };
        }),
        payment: "card",
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        guestAccessToken: order.guestAccessToken || null,
        courier: context.shippingData.courier,
        date: Date.now(),
        email: context.shippingData.email,
        firstname: context.shippingData.firstname,
        lastname: context.shippingData.lastname,
      };
      storageSet(PENDING_KEY, JSON.stringify(pending));
      return createCardSession(pending).then(function (session) {
        return { order: order, pending: pending, checkoutUrl: session.checkoutUrl };
      });
    });
  }

  function createCardSession(pending) {
    var headers = { "Idempotency-Key": randomKey() };
    if (pending.guestAccessToken) headers["X-Order-Access-Token"] = pending.guestAccessToken;
    return api().postWithHeaders("/api/v2/orders/" + encodeURIComponent(pending.orderId) +
      "/card-session", {
        successUrl: window.location.origin + "/checkout?payment=success",
        cancelUrl: window.location.origin + "/checkout?payment=cancel",
      }, headers).then(function (result) {
        if (!result || !result.ok || !result.checkoutUrl) {
          var error = new Error(result && result.error || "PAYMENT_SESSION_FAILED");
          error.code = result && result.error || "PAYMENT_SESSION_FAILED";
          throw error;
        }
        return result;
      });
  }

  function getPaymentStatus(pending) {
    var headers = {};
    if (pending.guestAccessToken) headers["X-Order-Access-Token"] = pending.guestAccessToken;
    return api().getWithHeaders("/api/v2/orders/" + encodeURIComponent(pending.orderId) +
      "/payment-status", headers);
  }

  function money(value, currency, lang) {
    return new Intl.NumberFormat(lang === "en" ? "en-GB" : "el-GR", {
      style: "currency", currency: currency || "EUR",
    }).format(Number(value || 0));
  }

  function renderQuote(context, result) {
    var box = document.getElementById("checkout-server-quote");
    var localTotals = document.querySelector("#checkout-summary .checkout-totals");
    var cta = document.getElementById("checkout-cta");
    if (!box || !result || !result.quote) return;
    var b = result.quote.breakdown;
    var label = context.lang === "en"
      ? ["Subtotal", "Discount", "Shipping", "VAT", "Total"]
      : ["Υποσύνολο", "Έκπτωση", "Μεταφορικά", "ΦΠΑ", "Σύνολο"];
    if (label.length === 6) label.splice(3, 1);
    var values = [b.subtotal, Number(b.discountTotal) > 0 ? "-" + b.discountTotal : "0.00",
      b.shippingTotal, b.vatTotal, b.grandTotal];
    box.innerHTML = values.map(function (value, index) {
      return '<div class="checkout-summary__row' + (index === 5
        ? ' checkout-summary__row--total' : '') + '"><span>' + label[index] +
        '</span><strong>' + money(value, result.quote.currency, context.lang) +
        '</strong></div>';
    }).join("") + '<p class="checkout-sidebar__vat">' +
      (context.lang === "en"
        ? "Prices include 24% VAT. Authoritative total from the server."
        : "Στις τιμές συμπεριλαμβάνεται ΦΠΑ 24%. Το τελικό ποσό υπολογίστηκε από τον server.") + '</p>';
    box.hidden = false;
    if (localTotals) localTotals.hidden = true;
    if (cta) cta.disabled = false;
  }

  function refreshQuote(context) {
    if (!enabled || !context || !context.shippingData || context.step !== 2) return;
    var box = document.getElementById("checkout-server-quote");
    var status = document.getElementById("checkout-submit-status");
    var cta = document.getElementById("checkout-cta");
    var sequence = ++quoteSequence;
    if (cta) cta.disabled = true;
    if (status) status.textContent = context.lang === "en"
      ? "Calculating the final total..." : "Υπολογισμός τελικού ποσού...";
    api().post("/api/v2/quote", quotePayload(context)).then(function (result) {
      if (sequence !== quoteSequence) return;
      if (!result || !result.ok) throw new Error(result && result.error || "QUOTE_FAILED");
      renderQuote(context, result);
      if (status) status.textContent = "";
    }).catch(function () {
      if (sequence !== quoteSequence) return;
      if (box) box.hidden = true;
      if (cta) cta.disabled = true;
      if (status) status.textContent = context.lang === "en"
        ? "The final total could not be verified. Please try again."
        : "Δεν ήταν δυνατή η επιβεβαίωση του τελικού ποσού. Δοκιμάστε ξανά.";
    });
  }

  window.NostalgiaCheckoutV2 = {
    createCardSession: createCardSession,
    getPaymentStatus: getPaymentStatus,
    isEnabled: function () { return enabled; },
    loadConfig: loadConfig,
    refreshQuote: refreshQuote,
    submit: submit,
  };
})();
