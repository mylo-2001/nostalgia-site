(function () {
  var step = 1;
  var shippingData = null;
  var orderCaptcha = null;
  var checkoutSubmitting = false;
  var checkoutCouponBound = false;

  function v2Context(lines, payment) {
    var currentShipping = Object.assign({}, shippingData || {});
    currentShipping.courier = getCourier() || currentShipping.courier;
    currentShipping.gift = collectGiftData();
    return {
      step: step,
      shippingData: currentShipping,
      lines: lines || window.NostalgiaCart.getLineItems().slice(),
      payment: payment || getPayMethod(),
      couponCode: getStoredCoupon(),
      lang: getLang(),
    };
  }

  function setCheckoutStatus(message, busy) {
    var status = document.getElementById("checkout-submit-status");
    var cta = document.getElementById("checkout-cta");
    if (status) status.textContent = message || "";
    if (cta) {
      cta.disabled = !!busy;
      cta.setAttribute("aria-busy", busy ? "true" : "false");
    }
  }

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getLang() {
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function getCountryCode() {
    var select = document.getElementById("checkout-country");
    if (select && select.value) return select.value;
    if (window.NostalgiaLocale && typeof window.NostalgiaLocale.getCountry === "function") {
      return window.NostalgiaLocale.getCountry();
    }
    return "GR";
  }

  function getCountryLabel(code) {
    if (window.NostalgiaEuropeCountries) {
      return window.NostalgiaEuropeCountries.getName(code, getLang());
    }
    return code === "GR" ? t("checkout_country_value") : code;
  }

  /* Every applied code — several coupons may be stacked. */
  function getStoredCoupons() {
    if (window.NostalgiaOrderFees && typeof window.NostalgiaOrderFees.couponCodes === "function") {
      return window.NostalgiaOrderFees.couponCodes();
    }
    try {
      var one = localStorage.getItem("nostalgia-coupon") || "";
      return one ? [one] : [];
    } catch (e) {
      return [];
    }
  }

  function getStoredCoupon() {
    return getStoredCoupons()[0] || "";
  }

  function getPayMethod() {
    var selected = document.querySelector('input[name="pay_method"]:checked');
    return selected && selected.value === "card" ? "card" : "card";
  }

  function getCourier() {
    var selected = document.querySelector('input[name="courier"]:checked');
    return selected ? selected.value : "";
  }

  function getOrderSubtotal() {
    if (window.NostalgiaCart && typeof window.NostalgiaCart.getSubtotal === "function") {
      return window.NostalgiaCart.getSubtotal();
    }
    return 0;
  }

  function lineUnitPrice(product) {
    if (window.NostalgiaProducts && typeof window.NostalgiaProducts.getEffectivePrice === "function") {
      var price = window.NostalgiaProducts.getEffectivePrice(product);
      return price != null ? Number(price) : 0;
    }
    return product && product.price != null ? Number(product.price) : 0;
  }

  function formatSummaryPrice(amount) {
    if (window.NostalgiaOrderFees && typeof window.NostalgiaOrderFees.formatPrice === "function") {
      return window.NostalgiaOrderFees.formatPrice(amount, getLang());
    }
    return "€" + Number(amount || 0).toFixed(2);
  }

  function getGiftFees(gift) {
    if (!gift || !gift.isGift || !gift.boxType) return 0;
    if (window.NostalgiaOrderFees && typeof window.NostalgiaOrderFees.giftBoxFee === "function") {
      return window.NostalgiaOrderFees.giftBoxFee(gift.boxType);
    }
    return 0;
  }

  function getOrderTotals() {
    var productSubtotal = getOrderSubtotal();
    var gift = collectGiftData();
    var giftFees = getGiftFees(gift);
    var subtotal = productSubtotal + giftFees;
    var discount = 0;
    if (window.NostalgiaOrderFees && typeof window.NostalgiaOrderFees.couponDiscount === "function") {
      discount = window.NostalgiaOrderFees.couponDiscount(subtotal);
    }
    var payment = "card";
    var fees = window.NostalgiaOrderFees
      ? window.NostalgiaOrderFees.extraFees(payment, subtotal)
      : { shipping: 0 };
    var total = Math.max(0, subtotal - discount + fees.shipping);
    return {
      productSubtotal: productSubtotal,
      giftFees: giftFees,
      subtotal: subtotal,
      discount: discount,
      shipping: fees.shipping,
      total: total,
      gift: gift,
    };
  }

  function getDocType() {
    var selected = document.querySelector('input[name="doc_type"]:checked');
    return selected ? selected.value : "receipt";
  }

  function collectGiftData() {
    var isGiftEl = document.getElementById("checkout-is-gift");
    if (!isGiftEl || !isGiftEl.checked) {
      return { isGift: false };
    }
    var boxSelected = document.querySelector('input[name="giftBoxType"]:checked');
    return {
      isGift: true,
      boxType: boxSelected ? boxSelected.value : "",
      messageText: document.getElementById("checkout-gift-message")
        ? document.getElementById("checkout-gift-message").value.trim()
        : "",
      shipOther: !!(
        document.getElementById("checkout-gift-ship-other") &&
        document.getElementById("checkout-gift-ship-other").checked
      ),
      recipient: document.getElementById("checkout-gift-recipient")
        ? document.getElementById("checkout-gift-recipient").value.trim()
        : "",
    };
  }

  function giftBoxLabel(type) {
    if (type === "premium") return t("checkout_gift_box_premium");
    if (type === "wood") return t("checkout_gift_box_wood");
    return type;
  }

  function validateGiftOptions() {
    return true;
  }

  function updateGiftUI() {
    var isGift = document.getElementById("checkout-is-gift");
    var options = document.getElementById("checkout-gift-options");
    var recipientWrap = document.getElementById("checkout-gift-recipient-wrap");
    var shipOther = document.getElementById("checkout-gift-ship-other");
    var open = !!(isGift && isGift.checked);

    if (options) {
      options.classList.toggle("is-open", open);
      options.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (recipientWrap) recipientWrap.hidden = !(shipOther && shipOther.checked && open);

    document.querySelectorAll(".checkout-gift__packaging-opt").forEach(function (opt) {
      var input = opt.querySelector('input[type="radio"]');
      opt.classList.toggle("is-selected", !!(input && input.checked));
    });
    renderSummary();
  }

  function appendGiftToOrder(parts, gift) {
    parts.push("");
    parts.push(t("checkout_gift_section") + ":");
    parts.push(t("checkout_gift_is_gift") + ": " + (gift.isGift ? t("checkout_gift_yes") : t("checkout_gift_no")));
    if (!gift.isGift) return;
    if (gift.boxType) {
      parts.push(t("checkout_gift_packaging") + " — " + giftBoxLabel(gift.boxType));
    }
    if (gift.messageText) {
      parts.push(t("gift_message_title") + " — " + gift.messageText);
    }
    parts.push(t("checkout_gift_ship_direct") + ": " + (gift.shipOther ? t("checkout_gift_yes") : t("checkout_gift_no")));
    if (gift.shipOther && gift.recipient) {
      parts.push(t("checkout_gift_recipient_label") + ": " + gift.recipient);
    }
  }

  function giftSummaryHtml(gift) {
    if (!gift || !gift.isGift) return "";
    var items = [];
    if (gift.boxType) items.push(giftBoxLabel(gift.boxType));
    if (gift.messageText) items.push(t("gift_message_title") + ": «" + gift.messageText + "»");
    if (gift.shipOther) items.push(t("checkout_gift_ship_direct"));
    if (!items.length) {
      items.push(t("checkout_gift_is_gift"));
    }
    return (
      '<div class="checkout-summary__gift">' +
      '<span class="checkout-summary__gift-label" data-i18n="checkout_gift_summary">' +
      escapeHtml(t("checkout_gift_summary")) +
      "</span>" +
      "<p>" +
      escapeHtml(items.join(" · ")) +
      "</p>" +
      "</div>"
    );
  }

  function isGreeceCheckout() {
    return getCountryCode() === "GR";
  }

  function fullAddress(data) {
    var line1 = data.street + (data.streetNumber ? " " + data.streetNumber : "");
    var line2 = data.postal + " " + data.city;
    if (data.prefecture) line2 += ", " + data.prefecture;
    if (data.country) line2 += ", " + data.country;
    return line1 + ", " + line2;
  }

  function fullName(data) {
    return (data.firstname + " " + data.lastname).trim();
  }

  function collectShippingData() {
    var form = document.getElementById("checkout-shipping-form");
    if (!form) return null;
    var data = {
      firstname: form.firstname.value.trim(),
      lastname: form.lastname.value.trim(),
      phone: form.phone.value.trim(),
      mobile: form.mobile.value.trim(),
      email: form.email.value.trim(),
      street: form.street.value.trim(),
      streetNumber: form.streetNumber.value.trim(),
      city: form.city.value.trim(),
      postal: form.postal.value.trim(),
      prefecture: form.prefecture.value.trim(),
      floor: form.floor.value.trim(),
      locationType: form.locationType.value.trim(),
      countryCode: getCountryCode(),
      country: getCountryLabel(getCountryCode()),
      notes: form.notes.value.trim(),
      docType: getDocType(),
      company: document.getElementById("checkout-company").value.trim(),
      afm: document.getElementById("checkout-afm").value.trim(),
      doy: document.getElementById("checkout-doy").value.trim(),
      activity: document.getElementById("checkout-activity").value.trim(),
      companyAddress: document.getElementById("checkout-company-address").value.trim(),
      gift: collectGiftData(),
      courier: getCourier(),
    };
    if (
      !data.firstname ||
      !data.lastname ||
      !data.mobile ||
      !data.email ||
      !data.street ||
      !data.streetNumber ||
      !data.city ||
      !data.postal
    ) {
      return null;
    }
    if (data.countryCode === "GR") {
      if (!data.prefecture || !data.floor || !data.locationType) return null;
    }
    if (data.docType === "invoice" && (!data.company || !data.afm || !data.doy || !data.companyAddress)) {
      return null;
    }
    if (!data.courier) return null;
    return data;
  }

  function buildOrderText(data, payment) {
    var lines = window.NostalgiaCart.getLineItems();
    var rows = lines.map(function (line) {
      return "- " + line.product.title + " x" + line.qty;
    });
    var parts = [
      t("checkout_email_subject"),
      "",
      t("checkout_firstname_label") + ": " + data.firstname,
      t("checkout_lastname_label") + ": " + data.lastname,
      t("checkout_email_label") + ": " + data.email,
    ];
    if (data.phone) parts.push(t("checkout_phone_label") + ": " + data.phone);
    parts.push(t("checkout_mobile_label") + ": " + data.mobile);
    parts.push(t("checkout_country_label") + ": " + data.country);
    parts.push(t("checkout_address_label") + ": " + fullAddress(data));
    if (data.countryCode === "GR" && data.prefecture) {
      parts.push(t("checkout_prefecture_label") + ": " + data.prefecture);
    }
    if (data.floor) {
      parts.push(t("checkout_floor_label") + ": " + window.NostalgiaAddressOptions.floorLabel(data.floor, t));
    }
    if (data.locationType) {
      parts.push(
        t("checkout_location_type_label") + ": " + window.NostalgiaAddressOptions.locationLabel(data.locationType, t)
      );
    }
    var coupons = getStoredCoupons();
    if (coupons.length) parts.push(t("cart_coupon_row") + ": " + coupons.join(", "));
    parts.push(t("checkout_doc_title") + ": " + (data.docType === "invoice" ? t("checkout_doc_invoice") : t("checkout_doc_receipt")));
    if (data.docType === "invoice") {
      parts.push(t("checkout_company_label") + ": " + data.company);
      parts.push(t("checkout_afm_label") + ": " + data.afm);
      parts.push(t("checkout_doy_label") + ": " + data.doy);
      if (data.activity) parts.push(t("checkout_activity_label") + ": " + data.activity);
      if (data.companyAddress) parts.push(t("checkout_company_hq_label") + ": " + data.companyAddress);
    }
    if (data.notes) parts.push(t("checkout_notes_label") + ": " + data.notes);
    if (data.courier && window.NostalgiaOrderFees) {
      parts.push(
        t("checkout_courier_title") +
          ": " +
          window.NostalgiaOrderFees.courierLabel(data.courier, getLang())
      );
    }
    appendGiftToOrder(parts, data.gift || { isGift: false });
    if (window.NostalgiaOrderFees) {
      var fees = window.NostalgiaOrderFees.extraFees(payment, getOrderSubtotal());
      var fmt = window.NostalgiaOrderFees.formatFee;
      parts.push("");
      parts.push(t("cart_shipping_label") + ": " + fmt(fees.shipping, getLang()));
    }
    parts.push("");
    parts.push(t("checkout_payment_title") + ": " + t("checkout_pay_card"));
    parts.push("");
    parts.push(t("cart_summary_title") + ":");
    parts.push.apply(parts, rows);
    return parts.join("\n");
  }

  function checkoutCouponFeedback(message, isError) {
    var el = document.getElementById("checkout-coupon-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.classList.toggle("is-error", !!isError && !!message);
    el.classList.toggle("is-success", !isError && !!message);
  }

  function checkoutCouponReason(reason) {
    var messages = {
      already_used: "Το κουπόνι έχει ήδη χρησιμοποιηθεί.",
      not_first_order: "Το κουπόνι ισχύει μόνο για την πρώτη παραγγελία.",
      expired: "Το κουπόνι έχει λήξει.",
      exhausted: "Το κουπόνι έχει εξαντληθεί.",
      email_required: "Συμπλήρωσε πρώτα το email σου και δοκίμασε ξανά.",
    };
    return messages[reason] || "Ο κωδικός κουπονιού δεν είναι έγκυρος.";
  }

  function syncCheckoutCouponUi() {
    var listEl = document.getElementById("checkout-coupon-list");
    if (!listEl) return;
    var f = window.NostalgiaOrderFees;
    var list = f && typeof f.readCoupons === "function" ? f.readCoupons() : [];
    listEl.innerHTML = list.map(function (c) {
      var value = c.type === "percent" ? "−" + c.value + "%" : c.freeShipping && !c.value ? "Δωρεάν μεταφορικά" : "−€" + Number(c.value).toFixed(2);
      return '<li class="checkout-coupon__chip"><span>' + escapeHtml(c.code) + '</span><span class="checkout-coupon__chip-value">' + escapeHtml(value) + '</span><button type="button" data-checkout-coupon-remove="' + escapeHtml(c.code) + '" aria-label="Αφαίρεση">×</button></li>';
    }).join("");
  }

  function bindCheckoutCoupon() {
    var form = document.getElementById("checkout-coupon-form");
    var input = document.getElementById("checkout-coupon-input");
    if (!form || !input || checkoutCouponBound) return;
    checkoutCouponBound = true;
    syncCheckoutCouponUi();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = input.value.trim().toUpperCase();
      if (!code) return checkoutCouponFeedback("Γράψε έναν κωδικό κουπονιού.", true);
      var f = window.NostalgiaOrderFees;
      if (f && f.readCoupons().some(function (c) { return c.code === code; })) {
        return checkoutCouponFeedback("Το κουπόνι έχει ήδη προστεθεί.", true);
      }
      var emailEl = document.getElementById("checkout-email");
      var email = emailEl ? emailEl.value.trim() : "";
      checkoutCouponFeedback("Έλεγχος κουπονιού…", false);
      var apply = function (meta) {
        if (f && typeof f.addCoupon === "function") f.addCoupon(meta || { code: code, type: "percent", value: 0 });
        input.value = "";
        checkoutCouponFeedback("Το κουπόνι εφαρμόστηκε.", false);
        syncCheckoutCouponUi();
        renderSummary();
      };
      if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
        window.NostalgiaAPI.post("/api/coupons/validate", { code: code, email: email })
          .then(function (res) {
            if (res.ok && res.valid) return apply(res.coupon || { code: code });
            checkoutCouponFeedback(checkoutCouponReason(res.reason), true);
          })
          .catch(function () { apply({ code: code }); });
      } else {
        apply({ code: code, type: "percent", value: 0 });
      }
    });
    form.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-checkout-coupon-remove]") : null;
      if (!btn) return;
      var f = window.NostalgiaOrderFees;
      if (f && typeof f.removeCoupon === "function") f.removeCoupon(btn.getAttribute("data-checkout-coupon-remove"));
      syncCheckoutCouponUi();
      renderSummary();
    });
  }

  function renderSummary() {
    var el = document.getElementById("checkout-summary");
    if (!el) return;
    var lines = window.NostalgiaCart.getLineItems();
    if (!lines.length) {
      window.location.href = "/cart";
      return;
    }

    var totals = getOrderTotals();
    var lang = getLang();

    var addressBlock = "";
    if (shippingData && step === 2) {
      addressBlock =
        '<div class="checkout-sidebar__address">' +
        '<span class="checkout-sidebar__address-label" data-i18n="checkout_deliver_to">' +
        t("checkout_deliver_to") +
        "</span>" +
        "<p>" +
        fullName(shippingData) +
        "<br>" +
        fullAddress(shippingData) +
        (shippingData.courier && window.NostalgiaOrderFees
          ? "<br><span class=\"checkout-sidebar__courier\">" +
            escapeHtml(t("checkout_courier_title")) +
            ": " +
            escapeHtml(window.NostalgiaOrderFees.courierLabel(shippingData.courier, lang)) +
            "</span>"
          : "") +
        "</p>" +
        "</div>";
    }

    var giftBlock = shippingData && step === 2 ? giftSummaryHtml(shippingData.gift) : "";

    var lineItemsHtml = lines
      .map(function (line) {
        var unit = lineUnitPrice(line.product);
        var lineTotal = unit * line.qty;
        return (
          '<li class="checkout-line">' +
          '<span class="checkout-line__info">' +
          '<span class="checkout-line__name">' +
          escapeHtml(line.product.title) +
          "</span>" +
          '<span class="checkout-line__qty">' +
          escapeHtml(t("cart_qty_label")) +
          ": " +
          line.qty +
          "</span>" +
          "</span>" +
          '<span class="checkout-line__price">' +
          escapeHtml(formatSummaryPrice(lineTotal)) +
          "</span>" +
          "</li>"
        );
      })
      .join("");

    if (totals.giftFees > 0 && totals.gift.boxType) {
      lineItemsHtml +=
        '<li class="checkout-line checkout-line--gift-fee">' +
        '<span class="checkout-line__info">' +
        '<span class="checkout-line__name">' +
        escapeHtml(giftBoxLabel(totals.gift.boxType)) +
        "</span>" +
        "</span>" +
        '<span class="checkout-line__price">' +
        escapeHtml(formatSummaryPrice(totals.giftFees)) +
        "</span>" +
        "</li>";
    }

    var shippingLabel =
      totals.shipping > 0
        ? formatSummaryPrice(totals.shipping)
        : escapeHtml(t("cart_shipping_free_note"));

    var discountDisplay =
      totals.discount > 0
        ? "−" + formatSummaryPrice(totals.discount)
        : formatSummaryPrice(0);
    var discountRowClass =
      totals.discount > 0 ? " checkout-summary__row--discount" : "";


    el.innerHTML =
      addressBlock +
      giftBlock +
      '<ul class="checkout-lines">' +
      lineItemsHtml +
      "</ul>" +
      '<div class="checkout-totals">' +
      '<div class="checkout-summary__row">' +
      '<span data-i18n="cart_subtotal_label">' +
      escapeHtml(t("cart_subtotal_label")) +
      "</span>" +
      "<span>" +
      escapeHtml(formatSummaryPrice(totals.subtotal)) +
      "</span></div>" +
      '<div class="checkout-summary__row checkout-summary__row--fee">' +
      '<span data-i18n="cart_shipping_label">' +
      escapeHtml(t("cart_shipping_label")) +
      "</span>" +
      "<span>" +
      shippingLabel +
      "</span></div>" +
      '<div class="checkout-summary__row' +
      discountRowClass +
      '">' +
      '<span data-i18n="cart_discount_label">' +
      escapeHtml(t("cart_discount_label")) +
      "</span>" +
      "<span>" +
      escapeHtml(discountDisplay) +
      "</span></div>" +
      '<div class="checkout-summary__row checkout-summary__row--total">' +
      '<span data-i18n="cart_total_label">' +
      escapeHtml(t("cart_total_label")) +
      "</span>" +
      "<strong>" +
      escapeHtml(formatSummaryPrice(totals.total)) +
      "</strong></div>" +
      '<p class="checkout-summary__vat" data-i18n="checkout_vat_included">' +
      escapeHtml(t("checkout_vat_included")) +
      "</p>" +
      "</div>";
    if (window.NostalgiaCheckoutV2) {
      window.NostalgiaCheckoutV2.refreshQuote(v2Context(lines));
    }
  }

  function updateCta() {
    var cta = document.getElementById("checkout-cta");
    if (!cta) return;
    if (step === 1) {
      cta.textContent = t("checkout_to_payment");
      cta.setAttribute("data-i18n", "checkout_to_payment");
    } else {
      cta.textContent = t("checkout_submit");
      cta.setAttribute("data-i18n", "checkout_submit");
    }
  }

  function updateStepIndicators() {
    document.querySelectorAll("[data-checkout-step-indicator]").forEach(function (el) {
      var n = parseInt(el.getAttribute("data-checkout-step-indicator"), 10);
      el.classList.toggle("is-active", n === step);
      el.classList.toggle("is-done", n < step);
    });
  }

  function showStep(n) {
    step = n;
    var shipping = document.getElementById("checkout-step-shipping");
    var payment = document.getElementById("checkout-step-payment");
    var back = document.getElementById("checkout-back");
    var stripeNote = document.getElementById("checkout-stripe-note");
    var nextBtn = document.getElementById("checkout-next");

    if (shipping) shipping.hidden = n !== 1;
    if (payment) payment.hidden = n !== 2;
    if (nextBtn) nextBtn.hidden = n !== 1;
    if (back) {
      back.href = n === 1 ? "/cart" : "#";
      back.textContent = n === 1 ? t("checkout_back") : t("checkout_back");
    }
    if (stripeNote) {
      stripeNote.hidden = getPayMethod() !== "stripe";
    }
    updateStepIndicators();
    updateCta();
    renderSummary();
  }

  function validateShippingForm() {
    var form = document.getElementById("checkout-shipping-form");
    if (!form) return false;
    if (!form.reportValidity()) return false;
    if (!validateGiftOptions()) return false;
    var data = collectShippingData();
    if (!data) {
      if (getDocType() === "invoice") {
        alert(t("checkout_invoice_required"));
      }
      return false;
    }
    shippingData = data;
    return true;
  }

  function hideCheckoutAndShowSuccess(lines, payment, orderNumber, orderId, extra) {
    document.getElementById("checkout-step-shipping").hidden = true;
    document.getElementById("checkout-step-payment").hidden = true;
    document.getElementById("checkout-sidebar").hidden = true;
    document.getElementById("checkout-back").hidden = true;
    var steps = document.getElementById("checkout-steps");
    var hero = document.querySelector(".checkout-page__hero");
    if (steps) steps.hidden = true;
    if (hero) hero.hidden = true;
    var layout = document.querySelector(".checkout-page__layout");
    if (layout) layout.hidden = true;

    showOrderSuccess(lines, payment, orderNumber, orderId, extra);
    window.NostalgiaCart.clearCart();
  }

  function submitOrderByEmail(lines, payment) {
    var body = encodeURIComponent(buildOrderText(shippingData, payment));
    var subject = encodeURIComponent(t("checkout_email_subject"));
    hideCheckoutAndShowSuccess(lines, payment, undefined, undefined, {
      courier: shippingData && shippingData.courier,
      date: Date.now(),
      email: shippingData && shippingData.email,
      firstname: shippingData && shippingData.firstname,
      lastname: shippingData && shippingData.lastname,
    });
    window.setTimeout(function () {
      window.location.href = "mailto:orders@nostalgiacandle.gr?subject=" + subject + "&body=" + body;
    }, 3200);
  }

  function submitOrder() {
    if (!shippingData) return;
    var payment = getPayMethod();
    var lines = window.NostalgiaCart.getLineItems().slice();

    if (window.NostalgiaCheckoutV2 && window.NostalgiaCheckoutV2.isEnabled()) {
      if (checkoutSubmitting) return;
      checkoutSubmitting = true;
      setCheckoutStatus(getLang() === "en" ? "Creating your order..."
        : "Δημιουργία παραγγελίας...", true);
      window.NostalgiaCheckoutV2.submit(v2Context(lines, payment)).then(function (result) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        try { sessionStorage.removeItem("nostalgia-pending-order"); } catch (_) {}
        hideCheckoutAndShowSuccess(lines, payment, result.order.orderNumber,
          result.order.orderId, {
            courier: getCourier(), date: Date.now(), email: shippingData.email,
            firstname: shippingData.firstname, lastname: shippingData.lastname,
          });
      }).catch(function (error) {
        checkoutSubmitting = false;
        var code = error && error.code || "CHECKOUT_FAILED";
        var message;
        if (code === "card_required") {
          message = getLang() === "en"
            ? "For this order, please choose card payment."
            : "Για αυτή την παραγγελία, επιλέξτε πληρωμή με κάρτα.";
        } else if (code === "GIFT_CHECKOUT_V2_NOT_CONFIGURED") {
          message = getLang() === "en"
            ? "Gift packaging is temporarily unavailable in secure checkout."
            : "Η συσκευασία δώρου δεν είναι προσωρινά διαθέσιμη στο ασφαλές checkout.";
        } else {
          message = getLang() === "en"
            ? "The order could not be created. No duplicate charge was made. Please try again."
            : "Η παραγγελία δεν δημιουργήθηκε. Δεν έγινε διπλή χρέωση. Δοκιμάστε ξανά.";
        }
        setCheckoutStatus(message, false);
      });
      return;
    }

    /* Backend running → store the order there; otherwise email fallback. */
    if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
      window.NostalgiaAPI.post("/api/orders", {
        customer: shippingData,
        items: lines.map(function (line) {
          return { id: line.id, qty: line.qty };
        }),
        payment: payment,
        /* `coupons` is authoritative; `coupon` stays for backwards compat. */
        coupons: getStoredCoupons(),
        coupon: getStoredCoupon(),
        lang: getLang(),
        captchaToken: window.NostalgiaCaptcha ? window.NostalgiaCaptcha.getToken(orderCaptcha) : "",
      }).then(function (res) {
        if (res.error === "captcha_failed") {
          if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(orderCaptcha);
          alert(
            getLang() === "en"
              ? "Please complete the verification and try again."
              : "Ολοκληρώστε την επαλήθευση και δοκιμάστε ξανά."
          );
          return;
        }
        if (res.ok && res.checkoutUrl) {
          /* Stripe is configured and the cart is priced → pay by card. */
          try {
            sessionStorage.setItem("nostalgia-pending-order", JSON.stringify({
              lines: lines.map(function (line) {
                return { qty: line.qty, image: line.product.image, title: line.product.title };
              }),
              payment: payment,
              orderNumber: res.order && res.order.number,
              orderId: res.order && res.order.id,
              courier: shippingData && shippingData.courier,
              date: Date.now(),
              email: shippingData && shippingData.email,
              firstname: shippingData && shippingData.firstname,
              lastname: shippingData && shippingData.lastname,
            }));
          } catch (e) {}
          window.location.href = res.checkoutUrl;
        } else if (res.ok) {
          hideCheckoutAndShowSuccess(lines, payment, res.order && res.order.number, res.order && res.order.id, {
            courier: shippingData && shippingData.courier,
            date: Date.now(),
            email: shippingData && shippingData.email,
            firstname: shippingData && shippingData.firstname,
            lastname: shippingData && shippingData.lastname,
          });
        } else if (res.error && String(res.error).indexOf("out_of_stock") === 0) {
          alert(
            getLang() === "en"
              ? "Sorry, one of the products in your cart is out of stock."
              : "Λυπούμαστε, ένα από τα προϊόντα του καλαθιού σας έχει εξαντληθεί."
          );
        } else {
          submitOrderByEmail(lines, payment);
        }
      }).catch(function () {
        submitOrderByEmail(lines, payment);
      });
      return;
    }

    submitOrderByEmail(lines, payment);
  }

  var PAY_ICON_STRIPE =
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<rect x="6" y="12" width="36" height="24" rx="3.5" />' +
    '<path d="M6 20h36" />' +
    '<path d="M12 30h8" stroke-linecap="round" />' +
    "</svg>";

  var PAY_ICON_COD =
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<path d="M10 16h22l6 6v14H10V16z" />' +
    '<path d="M32 16v6h6" />' +
    '<circle cx="18" cy="32" r="2.5" />' +
    '<path d="M28 28h8M28 32h6" stroke-linecap="round" />' +
    "</svg>";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setupOrderCancel(orderId, payment) {
    var wrap = document.getElementById("order-success-cancel");
    var btn = document.getElementById("order-success-cancel-btn");
    var result = document.getElementById("order-success-cancel-result");
    if (!wrap || !btn) return;
    if (!orderId || !(window.NostalgiaAPI && window.NostalgiaAPI.isAvailable())) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    btn.hidden = false;
    btn.disabled = false;
    if (result) { result.hidden = true; result.textContent = ""; }
    btn.onclick = function () {
      if (!window.confirm(t("checkout_cancel_confirm"))) return;
      btn.disabled = true;
      window.NostalgiaAPI.post("/api/orders/" + encodeURIComponent(orderId) + "/cancel", {}).then(function (res) {
        if (res && res.ok) {
          btn.hidden = true;
          if (result) {
            result.hidden = false;
        result.textContent = res.refunded ? t("checkout_cancel_done_refund") : t("checkout_cancel_done");
          }
        } else {
          btn.disabled = false;
          if (result) {
            result.hidden = false;
            result.textContent = res && res.error === "not_cancellable"
              ? t("checkout_cancel_too_late")
              : t("checkout_cancel_fail");
          }
        }
      }).catch(function () {
        btn.disabled = false;
        if (result) { result.hidden = false; result.textContent = t("checkout_cancel_fail"); }
      });
    };
  }

  var COURIER_LABELS = {
    acs: "ACS Courier",
    elta: "ELTA Courier",
    speedex: "Speedex",
    geniki: "Γενική Ταχυδρομική",
    box: "BOX NOW",
  };

  function courierLabel(key) {
    var id = String(key || "").toLowerCase();
    return COURIER_LABELS[id] || (key ? String(key) : "—");
  }

  function setSuccessValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  }

  /* Offer account creation after purchase — only to guests (not logged in),
     never revealing whether the email already has an account. */
  function setupCreateAccountCard(email, firstname, lastname) {
    var card = document.getElementById("order-success-account");
    if (!card) return;
    if (!email || !(window.NostalgiaAPI && typeof window.NostalgiaAPI.ready === "function")) {
      card.hidden = true;
      return;
    }
    window.NostalgiaAPI.ready().then(function (ok) {
      if (!ok) { card.hidden = true; return; }
      window.NostalgiaAPI.get("/api/auth/me").then(function (data) {
        if (data && data.ok && data.user) { card.hidden = true; return; } // already signed in
        var btn = document.getElementById("order-success-account-btn");
        if (btn) {
          var q = "?email=" + encodeURIComponent(email) +
            (firstname ? "&fn=" + encodeURIComponent(firstname) : "") +
            (lastname ? "&ln=" + encodeURIComponent(lastname) : "");
          btn.href = "/account/register" + q;
        }
        card.hidden = false;
      }).catch(function () { card.hidden = true; });
    });
  }

  function showOrderSuccess(lines, payment, orderNumber, orderId, extra) {
    extra = extra || {};
    var success = document.getElementById("order-success");
    var payIcon = document.getElementById("order-success-pay-icon");
    var productsEl = document.getElementById("order-success-products");

    /* summary details box */
    setSuccessValue("order-success-number-value", orderNumber ? "#" + orderNumber : "—");
    var d = extra.date ? new Date(extra.date) : new Date();
    var locale = getLang() === "en" ? "en-GB" : "el-GR";
    setSuccessValue(
      "order-success-date",
      d.toLocaleDateString(locale) + " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    );
    setSuccessValue("order-success-pay-method", t("pay_method_card"));
    var courierRow = document.getElementById("order-success-courier-row");
    if (extra.courier) {
      setSuccessValue("order-success-courier", courierLabel(extra.courier));
      if (courierRow) courierRow.hidden = false;
    } else if (courierRow) {
      courierRow.hidden = true;
    }

    if (payIcon) {
      payIcon.className = "order-success__pay-icon order-success__pay-icon--" + payment;
      payIcon.innerHTML = PAY_ICON_STRIPE;
    }

    if (productsEl) {
      productsEl.innerHTML = lines
        .map(function (line, index) {
          var p = line.product;
          return (
            '<li class="order-success__product" style="--delay:' +
            index * 0.1 +
            's">' +
            '<figure class="order-success__product-figure">' +
            '<div class="order-success__product-media">' +
            '<img src="' +
            escapeHtml(p.image) +
            '" alt="" loading="lazy" decoding="async" />' +
            '<span class="order-success__product-qty">×' +
            line.qty +
            "</span>" +
            "</div>" +
            '<figcaption class="order-success__product-name">' +
            escapeHtml(p.title) +
            "</figcaption>" +
            "</figure></li>"
          );
        })
        .join("");
    }

    /* When the backend stored the order (we have a code), a confirmation
       email is sent — otherwise we fall back to opening the user's mail app. */
    var note = document.querySelector(".order-success__email-note");
    if (note) {
      if (orderNumber) {
        note.removeAttribute("data-i18n");
        note.textContent = t("checkout_success_email_sent");
      } else {
        note.setAttribute("data-i18n", "checkout_success_email_note");
      }
    }

    if (success) {
      success.hidden = false;
      success.classList.remove("is-active");
      window.requestAnimationFrame(function () {
        success.classList.add("is-active");
      });
    }

    setupOrderCancel(orderId, payment);
    setupCreateAccountCard(extra.email, extra.firstname, extra.lastname);

    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang());
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function populatePrefectures() {
    var select = document.getElementById("checkout-prefecture");
    if (!select || !window.NostalgiaPrefectures) return;
    var current = select.value;
    window.NostalgiaPrefectures.populateSelect(select, t("checkout_prefecture_placeholder"));
    if (current) select.value = current;
  }

  function populateAddressOptions() {
    if (!window.NostalgiaAddressOptions) return;
    var floor = document.getElementById("checkout-floor");
    var locationType = document.getElementById("checkout-location-type");
    window.NostalgiaAddressOptions.populateSelect(
      floor,
      window.NostalgiaAddressOptions.floors,
      t("checkout_floor_placeholder"),
      t
    );
    window.NostalgiaAddressOptions.populateSelect(
      locationType,
      window.NostalgiaAddressOptions.locationTypes,
      t("checkout_location_type_placeholder"),
      t
    );
  }

  function populateCountrySelect() {
    var select = document.getElementById("checkout-country");
    if (!select || !window.NostalgiaEuropeCountries) return;
    var lang = getLang();
    var current = getCountryCode();
    select.innerHTML = window.NostalgiaEuropeCountries.sorted(lang)
      .map(function (entry) {
        return (
          '<option value="' +
          entry.code +
          '">' +
          escapeHtml(entry[lang] || entry.en) +
          "</option>"
        );
      })
      .join("");
    if (window.NostalgiaEuropeCountries.isValid(current)) {
      select.value = current;
    } else {
      select.value = "GR";
    }
  }

  function updateCountryField() {
    populateCountrySelect();
    updateGrFields();
  }

  function updateGrFields() {
    var isGr = isGreeceCheckout();
    var prefectureWrap = document.getElementById("checkout-prefecture-wrap");
    var grExtra = document.getElementById("checkout-gr-extra");
    var prefecture = document.getElementById("checkout-prefecture");
    var floor = document.getElementById("checkout-floor");
    var locationType = document.getElementById("checkout-location-type");
    var postal = document.getElementById("checkout-postal");

    if (prefectureWrap) {
      prefectureWrap.hidden = !isGr;
      var cityRow = prefectureWrap.parentElement;
      if (cityRow) cityRow.classList.toggle("checkout-form__row--single", !isGr);
    }
    if (grExtra) grExtra.hidden = !isGr;

    [prefecture, floor, locationType].forEach(function (el) {
      if (!el) return;
      if (isGr) el.setAttribute("required", "");
      else {
        el.removeAttribute("required");
        if (!isGr) el.value = "";
      }
    });

    if (postal) {
      if (isGr) postal.setAttribute("maxlength", "5");
      else postal.removeAttribute("maxlength");
    }
  }

  function updateDocTypeUI() {
    var isInvoice = getDocType() === "invoice";
    var invoiceFields = document.getElementById("checkout-invoice-fields");
    if (invoiceFields) invoiceFields.hidden = !isInvoice;

    ["checkout-company", "checkout-afm", "checkout-doy", "checkout-company-address"].forEach(function (id) {
      var input = document.getElementById(id);
      var label = document.querySelector('label[for="' + id + '"]');
      if (input) {
        if (isInvoice) input.setAttribute("required", "");
        else input.removeAttribute("required");
      }
      if (label) label.classList.toggle("checkout-form__label--required", isInvoice);
    });
  }

  function bindEvents() {
    var cta = document.getElementById("checkout-cta");
    var stepBack = document.getElementById("checkout-step-back");
    var back = document.getElementById("checkout-back");

    document.querySelectorAll('input[name="doc_type"]').forEach(function (radio) {
      radio.addEventListener("change", updateDocTypeUI);
    });

    var isGift = document.getElementById("checkout-is-gift");
    if (isGift) isGift.addEventListener("change", updateGiftUI);
    var shipOther = document.getElementById("checkout-gift-ship-other");
    if (shipOther) {
      shipOther.addEventListener("change", function () {
        var recipientWrap = document.getElementById("checkout-gift-recipient-wrap");
        var open = document.getElementById("checkout-is-gift") && document.getElementById("checkout-is-gift").checked;
        if (recipientWrap) recipientWrap.hidden = !(shipOther.checked && open);
        renderSummary();
      });
    }
    document.querySelectorAll('input[name="giftBoxType"]').forEach(function (radio) {
      radio.addEventListener("change", updateGiftUI);
    });
    var giftMessage = document.getElementById("checkout-gift-message");
    if (giftMessage) {
      giftMessage.addEventListener("input", function () {
        if (shippingData) shippingData.gift = collectGiftData();
        renderSummary();
      });
    }

    document.querySelectorAll('input[name="pay_method"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        var note = document.getElementById("checkout-stripe-note");
        if (note) note.hidden = false;
        renderSummary();
        updateCta();
      });
    });

    document.querySelectorAll('input[name="courier"]').forEach(function (radio) {
      radio.addEventListener("change", renderSummary);
    });

    function goToPayment() {
      if (!validateShippingForm()) return;
    if (!getCourier()) {
      alert(t("checkout_courier_required"));
      return;
    }
      showStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (cta) {
      cta.addEventListener("click", function () {
        if (step === 1) goToPayment();
        else submitOrder();
      });
    }

    var nextBtn = document.getElementById("checkout-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", goToPayment);
    }

    var countrySelect = document.getElementById("checkout-country");
    if (countrySelect) {
      countrySelect.addEventListener("change", function () {
        try {
          localStorage.setItem("nostalgia-country", countrySelect.value);
        } catch (e) {}
        updateGrFields();
        if (window.NostalgiaPlacesCheckout && window.NostalgiaPlacesCheckout.setCountry) {
          window.NostalgiaPlacesCheckout.setCountry(countrySelect.value);
        }
        window.dispatchEvent(new CustomEvent("nostalgia-locale-updated"));
      });
    }

    if (stepBack) {
      stepBack.addEventListener("click", function () {
        showStep(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (back) {
      back.addEventListener("click", function (e) {
        if (step === 2) {
          e.preventDefault();
          showStep(1);
        }
      });
    }

    window.addEventListener("nostalgia-cart-updated", renderSummary);
    window.addEventListener("nostalgia-coupon-updated", renderSummary);
    window.addEventListener("nostalgia-products-updated", renderSummary);
    window.addEventListener("nostalgia-locale-updated", function () {
      populateCountrySelect();
      renderSummary();
    });
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        populatePrefectures();
        populateAddressOptions();
        updateCountryField();
        renderSummary();
        updateCta();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  function getPendingOrder() {
    try {
      var raw = sessionStorage.getItem("nostalgia-pending-order");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function showSuccessFromPending(pending, orderId) {
    document.getElementById("checkout-step-shipping").hidden = true;
    document.getElementById("checkout-step-payment").hidden = true;
    var sidebar = document.getElementById("checkout-sidebar");
    if (sidebar) sidebar.hidden = true;
    var back = document.getElementById("checkout-back");
    if (back) back.hidden = true;
    var steps = document.getElementById("checkout-steps");
    var hero = document.querySelector(".checkout-page__hero");
    if (steps) steps.hidden = true;
    if (hero) hero.hidden = true;
    var layout = document.querySelector(".checkout-page__layout");
    if (layout) layout.hidden = true;
    /* pending.lines store {qty, image, title} → adapt to showOrderSuccess shape */
    var lines = (pending.lines || []).map(function (l) {
      return { qty: l.qty, product: { image: l.image, title: l.title } };
    });
    showOrderSuccess(lines, pending.payment || "stripe", pending.orderNumber, orderId || pending.orderId, {
      courier: pending.courier,
      date: pending.date,
      email: pending.email,
      firstname: pending.firstname,
      lastname: pending.lastname,
    });
    window.NostalgiaCart.clearCart();
  }

  function applyV2PaymentState(pending, status) {
    var title = document.querySelector(".order-success__title");
    var lead = document.querySelector(".order-success__lead");
    var eyebrow = document.querySelector(".order-success__eyebrow");
    var details = document.getElementById("order-success-details");
    var cancel = document.getElementById("order-success-cancel");
    if (cancel) cancel.hidden = true;
    [title, lead, eyebrow].forEach(function (element) {
      if (element) element.removeAttribute("data-i18n");
    });
    var paid = status && status.paymentStatus === "paid";
    var failed = status && status.paymentStatus === "failed";
    var cancelled = status && status.paymentStatus === "cancelled";
    if (eyebrow) eyebrow.textContent = paid
      ? (getLang() === "en" ? "Payment confirmed" : "Η πληρωμή επιβεβαιώθηκε")
      : (getLang() === "en" ? "Order received" : "Η παραγγελία καταχωρίστηκε");
    if (title) title.textContent = paid
      ? (getLang() === "en" ? "Your payment is complete" : "Η πληρωμή ολοκληρώθηκε")
      : (failed || cancelled)
        ? (getLang() === "en" ? "The payment was not completed" : "Η πληρωμή δεν ολοκληρώθηκε")
        : (getLang() === "en" ? "Your payment is being confirmed"
          : "Η πληρωμή επιβεβαιώνεται");
    if (lead) lead.textContent = paid
      ? (getLang() === "en" ? "Your order is confirmed and will proceed for fulfilment."
        : "Η παραγγελία επιβεβαιώθηκε και θα προχωρήσει για εκτέλεση.")
      : failed
        ? (getLang() === "en" ? "You can retry securely without creating a second order."
          : "Μπορείτε να δοκιμάσετε ξανά με ασφάλεια, χωρίς δεύτερη παραγγελία.")
        : cancelled
          ? (getLang() === "en" ? "The payment session has closed. Your card was not marked paid."
            : "Η συνεδρία πληρωμής έκλεισε και η κάρτα δεν σημειώθηκε ως πληρωμένη.")
        : (getLang() === "en" ? "The order will be marked paid only after the provider webhook is verified."
          : "Η παραγγελία θα σημειωθεί ως πληρωμένη μόνο μετά την επαλήθευση του webhook.");
    var oldRetry = document.getElementById("v2-payment-retry");
    if (oldRetry) oldRetry.remove();
    if (failed && status.retryAllowed && details) {
      var retry = document.createElement("button");
      retry.type = "button";
      retry.id = "v2-payment-retry";
      retry.className = "btn-shop btn-shop--primary order-success__retry";
      retry.textContent = getLang() === "en" ? "Retry card payment" : "Νέα προσπάθεια πληρωμής";
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.setAttribute("aria-busy", "true");
        window.NostalgiaCheckoutV2.createCardSession(pending).then(function (session) {
          window.location.href = session.checkoutUrl;
        }).catch(function () {
          retry.disabled = false;
          retry.setAttribute("aria-busy", "false");
          if (lead) lead.textContent = getLang() === "en"
            ? "The new payment attempt could not start. Please try again."
            : "Η νέα προσπάθεια πληρωμής δεν ξεκίνησε. Δοκιμάστε ξανά.";
        });
      });
      details.appendChild(retry);
    }
    if (paid) {
      try { sessionStorage.removeItem("nostalgia-pending-order"); } catch (_) {}
    }
  }

  function pollV2PaymentState(pending, attempt) {
    window.NostalgiaCheckoutV2.getPaymentStatus(pending).then(function (res) {
      if (!res || !res.ok) return;
      applyV2PaymentState(pending, res);
      if (res.paymentStatus === "pending" && attempt < 8) {
        window.setTimeout(function () { pollV2PaymentState(pending, attempt + 1); }, 2000);
      }
    }).catch(function () {});
  }

  /**
   * Handle the redirect back from Stripe Checkout.
   * Returns true if a Stripe return was handled (init should stop).
   */
  function handleStripeReturn() {
    var params = new URLSearchParams(window.location.search);
    var stripe = params.get("stripe");
    if (!stripe) return false;

    /* clean the URL so a refresh doesn't re-trigger */
    try {
      history.replaceState(null, "", "/checkout");
    } catch (e) {}

    if (stripe === "cancel") {
      var cancelledPending = getPendingOrder();
      if (!cancelledPending || !cancelledPending.v2) {
        try { sessionStorage.removeItem("nostalgia-pending-order"); } catch (e) {}
      }
      alert(
        getLang() === "en"
          ? "Payment was cancelled. Your cart is still saved."
          : "Η πληρωμή ακυρώθηκε. Το καλάθι σας παραμένει αποθηκευμένο."
      );
      return false; // let normal checkout init continue
    }

    if (stripe === "success") {
      var pending = getPendingOrder();
      var sessionId = params.get("session_id");
      if (pending && pending.v2 && window.NostalgiaCheckoutV2) {
        showSuccessFromPending(pending, pending.orderId);
        applyV2PaymentState(pending, { paymentStatus: "pending" });
        pollV2PaymentState(pending, 0);
        return true;
      }
      if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable() && sessionId) {
        window.NostalgiaAPI.get(
          "/api/orders/confirm?session_id=" + encodeURIComponent(sessionId)
        ).then(function (res) {
          var oid = res && res.order && res.order.id;
          if (pending) showSuccessFromPending(pending, oid);
        }).catch(function () {
          if (pending) showSuccessFromPending(pending);
        });
      } else if (pending) {
        showSuccessFromPending(pending);
      }
      try { sessionStorage.removeItem("nostalgia-pending-order"); } catch (e) {}
      return true;
    }
    return false;
  }

  /* Only fill blank fields, so we never overwrite what the visitor typed. */
  function prefillField(id, val) {
    var el = document.getElementById(id);
    if (el && val != null && val !== "" && !el.value) el.value = val;
  }

  function prefillFromAccount(user) {
    if (!user) return;
    prefillField("checkout-firstname", user.firstname);
    prefillField("checkout-lastname", user.lastname);
    prefillField("checkout-email", user.email);
    var a = user.address || {};
    prefillField("checkout-phone", a.phone);
    prefillField("checkout-mobile", a.mobile);
    prefillField("checkout-postal", a.postal);
    prefillField("checkout-street", a.street);
    prefillField("checkout-street-number", a.streetNumber);
    prefillField("checkout-city", a.city);
    prefillField("checkout-prefecture", a.prefecture);
    prefillField("checkout-floor", a.floor);
    prefillField("checkout-location-type", a.locationType);
    var country = document.getElementById("checkout-country");
    if (country && a.country && !country.value) {
      country.value = a.country;
    }
    updateCountryField();
    updateGrFields();
  }

  /* Account banner: [Σύνδεση] or [Συνέχεια ως επισκέπτης] for guests; a
     "logged in as …" note + auto-prefill for signed-in customers. */
  function initAccountBanner() {
    var banner = document.getElementById("checkout-account-banner");
    if (!banner) return;
    var guestBox = document.getElementById("checkout-account-guest");
    var userBox = document.getElementById("checkout-account-user");
    var guestBtn = document.getElementById("checkout-continue-guest");
    if (guestBtn) guestBtn.addEventListener("click", function () { banner.hidden = true; });

    function showGuest() {
      banner.hidden = false;
      if (guestBox) guestBox.hidden = false;
      if (userBox) userBox.hidden = true;
    }
    function showUser(user) {
      banner.hidden = false;
      if (guestBox) guestBox.hidden = true;
      if (userBox) userBox.hidden = false;
      var emailEl = document.getElementById("checkout-account-email");
      if (emailEl) emailEl.textContent = user.email || "";
      prefillFromAccount(user);
    }

    if (!(window.NostalgiaAPI && typeof window.NostalgiaAPI.ready === "function")) return;
    window.NostalgiaAPI.ready().then(function (ok) {
      if (!ok) return; // no backend → stays a plain guest checkout, no banner
      window.NostalgiaAPI.get("/api/auth/me").then(function (data) {
        if (data && data.ok && data.user) showUser(data.user);
        else showGuest();
      }).catch(showGuest);
    });
  }

  function init() {
    if (handleStripeReturn()) return;
    if (!window.NostalgiaCart.getLineItems().length) {
      window.location.href = "/cart";
      return;
    }
    populatePrefectures();
    populateAddressOptions();
    updateCountryField();
    updateGrFields();
    if (window.NostalgiaPlacesCheckout && window.NostalgiaPlacesCheckout.registerOnFilled) {
      window.NostalgiaPlacesCheckout.registerOnFilled(updateGrFields);
    }
    updateDocTypeUI();
    updateGiftUI();
    bindEvents();
    bindCheckoutCoupon();
    initAccountBanner();
    if (window.NostalgiaCheckoutV2) {
      window.NostalgiaCheckoutV2.loadConfig().then(renderSummary);
    }
    if (window.NostalgiaCaptcha) {
      orderCaptcha = window.NostalgiaCaptcha.mount(document.getElementById("checkout-captcha"));
    }
    showStep(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
