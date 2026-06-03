(function () {
  var step = 1;
  var shippingData = null;

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

  function getStoredCoupon() {
    try {
      return localStorage.getItem("nostalgia-coupon") || "";
    } catch (e) {
      return "";
    }
  }

  function getPayMethod() {
    var selected = document.querySelector('input[name="pay_method"]:checked');
    return selected ? selected.value : "stripe";
  }

  function getDocType() {
    var selected = document.querySelector('input[name="doc_type"]:checked');
    return selected ? selected.value : "receipt";
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
    if (data.docType === "invoice" && (!data.company || !data.afm || !data.doy)) {
      return null;
    }
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
    var coupon = getStoredCoupon();
    if (coupon) parts.push(t("cart_coupon_row") + ": " + coupon);
    parts.push(t("checkout_doc_title") + ": " + (data.docType === "invoice" ? t("checkout_doc_invoice") : t("checkout_doc_receipt")));
    if (data.docType === "invoice") {
      parts.push(t("checkout_company_label") + ": " + data.company);
      parts.push(t("checkout_afm_label") + ": " + data.afm);
      parts.push(t("checkout_doy_label") + ": " + data.doy);
      if (data.activity) parts.push(t("checkout_activity_label") + ": " + data.activity);
    }
    if (data.notes) parts.push(t("checkout_notes_label") + ": " + data.notes);
    parts.push("");
    parts.push(t("checkout_payment_title") + ": " + (payment === "cod" ? t("checkout_pay_cod") : t("checkout_pay_stripe")));
    parts.push("");
    parts.push(t("cart_summary_title") + ":");
    parts.push.apply(parts, rows);
    return parts.join("\n");
  }

  function renderSummary() {
    var el = document.getElementById("checkout-summary");
    if (!el) return;
    var lines = window.NostalgiaCart.getLineItems();
    if (!lines.length) {
      window.location.href = "cart.html";
      return;
    }

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
        "</p>" +
        "</div>";
    }

    var coupon = getStoredCoupon();
    var couponRow = coupon
      ? '<div class="checkout-summary__row checkout-summary__row--coupon"><span data-i18n="cart_coupon_row">' +
        escapeHtml(t("cart_coupon_row")) +
        '</span><span class="checkout-summary__coupon">' +
        escapeHtml(coupon) +
        "</span></div>"
      : "";

    el.innerHTML =
      addressBlock +
      '<ul class="checkout-lines">' +
      lines
        .map(function (line) {
          return (
            '<li class="checkout-line">' +
            '<span class="checkout-line__name">' +
            escapeHtml(line.product.title) +
            "</span>" +
            '<span class="checkout-line__meta">Qty ' +
            line.qty +
            "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>" +
      couponRow +
      '<p class="checkout-summary__note" data-i18n="cart_summary_note">' +
      escapeHtml(t("cart_summary_note")) +
      "</p>";
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
      back.href = n === 1 ? "cart.html" : "#";
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

  function submitOrder() {
    if (!shippingData) return;
    var payment = getPayMethod();
    var lines = window.NostalgiaCart.getLineItems().slice();
    var body = encodeURIComponent(buildOrderText(shippingData, payment));
    var subject = encodeURIComponent(t("checkout_email_subject"));

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

    showOrderSuccess(lines, payment);
    window.NostalgiaCart.clearCart();

    window.setTimeout(function () {
      window.location.href = "mailto:mgerostathi@gmail.com?subject=" + subject + "&body=" + body;
    }, 3200);
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

  function showOrderSuccess(lines, payment) {
    var success = document.getElementById("order-success");
    var payIcon = document.getElementById("order-success-pay-icon");
    var payText = document.getElementById("order-success-payment");
    var productsEl = document.getElementById("order-success-products");

    if (payIcon) {
      payIcon.className = "order-success__pay-icon order-success__pay-icon--" + payment;
      payIcon.innerHTML = payment === "cod" ? PAY_ICON_COD : PAY_ICON_STRIPE;
    }

    if (payText) {
      payText.textContent =
        payment === "cod" ? t("checkout_success_payment_cod") : t("checkout_success_payment_stripe");
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

    if (success) {
      success.hidden = false;
      success.classList.remove("is-active");
      window.requestAnimationFrame(function () {
        success.classList.add("is-active");
      });
    }

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

    ["checkout-company", "checkout-afm", "checkout-doy"].forEach(function (id) {
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

    document.querySelectorAll('input[name="pay_method"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        var note = document.getElementById("checkout-stripe-note");
        if (note) note.hidden = getPayMethod() !== "stripe";
        renderSummary();
        updateCta();
      });
    });

    function goToPayment() {
      if (!validateShippingForm()) return;
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

  function init() {
    if (!window.NostalgiaCart.getLineItems().length) {
      window.location.href = "cart.html";
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
    bindEvents();
    showStep(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
