(function () {
  var COUPON_STORAGE = "nostalgia-coupon";
  var LOW_STOCK = 5;

  function couponMetaKey() {
    return window.NostalgiaOrderFees && window.NostalgiaOrderFees.COUPON_META_KEY
      ? window.NostalgiaOrderFees.COUPON_META_KEY
      : "nostalgia-coupon-meta";
  }

  var rootEl;
  var emptyEl;
  var itemsEl;
  var summaryEl;
  var miniListEl;
  var sidebarEl;
  var heroActionsEl;
  var footEl;
  var extrasEl;
  var couponEl;
  var couponForm;
  var couponInput;
  var couponFeedback;
  var couponRemoveBtn;
  var couponBound = false;
  var noticeEl;

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

  /* Tracked stock only — unknown stock is not shown as scarcity. */
  function stockState(p) {
    if (!p || p.stock == null) return null;
    var n = Number(p.stock);
    if (n <= 0) return { kind: "out", text: t("stock_out") };
    if (n > 0 && n <= LOW_STOCK) {
      return { kind: "low", text: t("stock_low").replace("{n}", String(n)) };
    }
    return null;
  }

  function updateNotice(lines) {
    if (!noticeEl) return;
    var out = 0;
    var low = 0;
    lines.forEach(function (line) {
      var s = stockState(line.product);
      if (!s) return;
      if (s.kind === "out") out += 1;
      else if (s.kind === "low") low += 1;
    });

    if (!out && !low) {
      noticeEl.hidden = true;
      noticeEl.textContent = "";
      noticeEl.className = "stock-notice";
      return;
    }

    var msg;
    var cls = "stock-notice";
    if (out && low) {
      msg = t("stock_notice_cart_both");
      cls += " stock-notice--out";
    } else if (out) {
      msg = t("stock_notice_cart_out");
      cls += " stock-notice--out";
    } else {
      msg = t("stock_notice_cart_low");
      cls += " stock-notice--low";
    }
    noticeEl.className = cls;
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
  }

  function buildLineHtml(line) {
    var p = line.product;
    var url = window.NostalgiaProducts.getProductUrl(p.id);
    var stock = stockState(p);
    var out = stock && stock.kind === "out";
    var maxQty =
      p.stock != null && Number(p.stock) > 0 ? Math.min(99, Number(p.stock)) : 99;
    var stockHtml = stock
      ? '<span class="stock-pill stock-pill--' +
        stock.kind +
        '">' +
        escapeHtml(stock.text) +
        "</span>"
      : "";
    return (
      '<li class="cart-line' +
      (out ? " cart-line--out" : "") +
      '">' +
      '<a class="cart-line__media" href="' +
      url +
      '"><img src="' +
      escapeHtml(p.image) +
      '" alt="' + escapeHtml(p.title) + '" width="88" height="88" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'images/home%20page%20photo/home%20photo%201.png\';this.classList.add(\'is-fallback\')" /></a>' +
      '<div class="cart-line__body">' +
      '<a class="cart-line__name" href="' +
      url +
      '">' +
      escapeHtml(p.title) +
      "</a>" +
      '<span class="cart-line__meta">' +
      escapeHtml(p.categoryName) +
      "</span>" +
      stockHtml +
      '<div class="cart-line__controls">' +
      '<label class="cart-line__qty-label">' +
      escapeHtml(t("cart_qty_label")) +
      "</label>" +
      '<div class="qty-stepper qty-stepper--cart">' +
      '<button type="button" class="qty-stepper__btn" data-qty-minus data-product-id="' +
      escapeHtml(p.id) +
      '" aria-label="-">−</button>' +
      '<input type="number" class="qty-stepper__input" data-qty-input data-product-id="' +
      escapeHtml(p.id) +
      '" value="' +
      line.qty +
      '" min="1" max="' +
      maxQty +
      '" aria-label="' +
      escapeHtml(t("cart_qty_label")) +
      '"' +
      (out ? " disabled" : "") +
      " />" +
      '<button type="button" class="qty-stepper__btn" data-qty-plus data-product-id="' +
      escapeHtml(p.id) +
      '" aria-label="+"' +
      (out || line.qty >= maxQty ? " disabled" : "") +
      ">+</button>" +
      "</div>" +
      '<button type="button" class="cart-line__remove" data-cart-remove data-product-id="' +
      escapeHtml(p.id) +
      '">' +
      escapeHtml(t("cart_remove")) +
      "</button>" +
      "</div>" +
      "</div>" +
      "</li>"
    );
  }

  function fees() {
    return window.NostalgiaOrderFees || null;
  }

  /* Every applied coupon (several may be stacked). */
  function appliedCoupons() {
    var f = fees();
    if (f && typeof f.readCoupons === "function") return f.readCoupons();
    try {
      var code = localStorage.getItem(COUPON_STORAGE);
      return code ? [{ code: String(code).trim(), type: "percent", value: 0 }] : [];
    } catch (e) {
      return [];
    }
  }

  /* The email used to verify customer-bound codes. Remembered from the
     welcome-offer popup / newsletter signup when available. */
  function offerEmail() {
    var typed = document.getElementById("cart-coupon-email");
    if (typed && typed.value.trim()) return typed.value.trim();
    try {
      return localStorage.getItem("nostalgia-offer-email") || "";
    } catch (e) {
      return "";
    }
  }

  function rememberOfferEmail(email) {
    try {
      if (email) localStorage.setItem("nostalgia-offer-email", email);
    } catch (e) {}
  }

  function showCouponFeedback(message, isError) {
    if (!couponFeedback) return;
    couponFeedback.textContent = message;
    couponFeedback.hidden = !message;
    couponFeedback.classList.toggle("is-error", !!isError);
    couponFeedback.classList.toggle("is-success", !isError && !!message);
  }

  /* Renders one chip per applied coupon; the input stays open so more codes
     can be stacked. */
  function syncCouponUi() {
    if (!couponInput) return;
    var list = appliedCoupons();
    var listEl = document.getElementById("cart-coupon-list");
    couponInput.value = "";
    couponInput.disabled = false;

    if (listEl) {
      listEl.innerHTML = list
        .map(function (c) {
          var label =
            c.type === "percent"
              ? "−" + c.value + "%"
              : c.freeShipping && !c.value
                ? t("cart_coupon_free_shipping")
                : "−€" + Number(c.value).toFixed(2);
          return (
            '<li class="cart-coupon__chip">' +
            '<span class="cart-coupon__chip-code">' + escapeHtml(c.code) + "</span>" +
            '<span class="cart-coupon__chip-value">' + escapeHtml(label) + "</span>" +
            '<button type="button" class="cart-coupon__chip-remove" data-coupon-remove="' +
            escapeHtml(c.code) + '" aria-label="' + escapeHtml(t("cart_coupon_remove")) + '">×</button>' +
            "</li>"
          );
        })
        .join("");
    }
    if (couponRemoveBtn) couponRemoveBtn.hidden = list.length < 2;
    if (!list.length) showCouponFeedback("", false);
  }

  function bindCouponForm() {
    if (!couponForm || couponBound) return;
    couponBound = true;

    couponForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = couponInput ? couponInput.value.trim().toUpperCase() : "";
      if (!code) {
        showCouponFeedback(t("cart_coupon_empty"), true);
        return;
      }
      var f = fees();
      if (f && f.readCoupons().some(function (c) { return c.code === code; })) {
        showCouponFeedback(t("cart_coupon_duplicate"), true);
        return;
      }

      var apply = function (meta) {
        if (f && typeof f.addCoupon === "function") {
          f.addCoupon(meta && meta.code ? meta : { code: code, type: "percent", value: 0 });
        }
        showCouponFeedback(t("cart_coupon_saved"), false);
        syncCouponUi();
        render();
      };

      /* Validate against the backend when it is running. */
      if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
        showCouponFeedback(t("cart_coupon_checking") || "…", false);
        var email = offerEmail();
        window.NostalgiaAPI.post("/api/coupons/validate", { code: code, email: email })
          .then(function (res) {
            if (res.ok && res.valid) {
              if (email) rememberOfferEmail(email);
              hideCouponEmail();
              apply(res.coupon || { code: code });
              return;
            }
            /* Customer-bound code: ask for the email instead of a dead end. */
            if (res.reason === "email_required") {
              showCouponEmail();
              showCouponFeedback(t("cart_coupon_needs_email"), true);
              return;
            }
            showCouponFeedback(couponReasonText(res.reason), true);
          })
          .catch(function () {
            apply({ code: code });
          });
        return;
      }
      apply({ code: code });
    });

    /* Chip × buttons (event-delegated — chips are re-rendered). */
    couponForm.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-coupon-remove]") : null;
      if (!btn) return;
      e.preventDefault();
      var f = fees();
      if (f && typeof f.removeCoupon === "function") f.removeCoupon(btn.getAttribute("data-coupon-remove"));
      showCouponFeedback("", false);
      syncCouponUi();
      render();
    });

    if (couponRemoveBtn) {
      couponRemoveBtn.addEventListener("click", function () {
        var f = fees();
        if (f && typeof f.clearCoupons === "function") f.clearCoupons();
        if (couponInput) {
          couponInput.value = "";
          couponInput.disabled = false;
        }
        showCouponFeedback("", false);
        syncCouponUi();
        render();
      });
    }
  }

  function showCouponEmail() {
    var wrap = document.getElementById("cart-coupon-email-wrap");
    if (wrap) wrap.hidden = false;
    var input = document.getElementById("cart-coupon-email");
    if (input && !input.value) {
      try { input.value = localStorage.getItem("nostalgia-offer-email") || ""; } catch (e) {}
    }
    if (input) input.focus();
  }

  function hideCouponEmail() {
    var wrap = document.getElementById("cart-coupon-email-wrap");
    if (wrap) wrap.hidden = true;
  }

  /* Turns a server rejection reason into a message the shopper understands. */
  function couponReasonText(reason) {
    if (reason === "already_used") return t("cart_coupon_used");
    if (reason === "not_first_order") return t("cart_coupon_first_order_only");
    if (reason === "expired") return t("cart_coupon_expired");
    if (reason === "exhausted") return t("cart_coupon_exhausted");
    return t("cart_coupon_invalid") || "Μη έγκυρο κουπόνι.";
  }

  function renderSummary(lines) {
    if (!summaryEl) return;
    var itemCount = lines.reduce(function (sum, line) {
      return sum + line.qty;
    }, 0);
    var subtotal = window.NostalgiaCart ? window.NostalgiaCart.getSubtotal() : 0;

    /* One row per applied coupon, each showing what it takes off. */
    var breakdown =
      fees() && typeof fees().couponBreakdown === "function"
        ? fees().couponBreakdown(subtotal)
        : [];
    var couponRow = breakdown
      .map(function (c) {
        var amount =
          c.discount > 0
            ? "−" + (fees() ? fees().formatPrice(c.discount, document.documentElement.lang === "en" ? "en" : "el") : c.discount)
            : c.freeShipping
              ? t("cart_coupon_free_shipping")
              : "";
        return (
          '<div class="cart-summary__row cart-summary__row--coupon">' +
          '<dt><span class="cart-summary__coupon-code">' + escapeHtml(c.code) + "</span></dt>" +
          "<dd>" + escapeHtml(amount) + "</dd>" +
          "</div>"
        );
      })
      .join("");

    var lang = document.documentElement.lang === "en" ? "en" : "el";
    var shippingAmount = t("cart_shipping_note");
    if (window.NostalgiaOrderFees) {
      var shipFee = window.NostalgiaOrderFees.extraFees("card", subtotal).shipping;
      shippingAmount = window.NostalgiaOrderFees.formatFee(shipFee, lang);
    }

    summaryEl.innerHTML =
      '<h2 class="cart-sidebar__heading" id="cart-summary-heading" data-i18n="cart_order_summary">' +
      escapeHtml(t("cart_order_summary")) +
      "</h2>" +
      '<dl class="cart-summary__rows">' +
      '<div class="cart-summary__row">' +
      '<dt data-i18n="cart_products_line">' +
      escapeHtml(t("cart_products_line")) +
      "</dt>" +
      '<dd>' +
      itemCount +
      "</dd>" +
      "</div>" +
      '<div class="cart-summary__row cart-summary__row--muted">' +
      '<dt data-i18n="cart_estimate_shipping">' +
      escapeHtml(t("cart_estimate_shipping")) +
      "</dt>" +
      '<dd>' +
      escapeHtml(shippingAmount) +
      "</dd>" +
      "</div>" +
      couponRow +
      "</dl>" +
      '<p class="cart-summary__note" data-i18n="cart_summary_note">' +
      escapeHtml(t("cart_summary_note")) +
      "</p>" +
      '<a class="btn-shop btn-shop--primary cart-summary__checkout" href="/checkout" data-i18n="cart_proceed_checkout">' +
      escapeHtml(t("cart_proceed_checkout")) +
      "</a>" +
      '<a class="btn-shop btn-shop--ghost cart-summary__continue" href="/collection" data-i18n="cart_continue_shopping">' +
      escapeHtml(t("cart_continue_shopping")) +
      "</a>";
  }

  function renderMiniList(lines) {
    if (!miniListEl) return;
    miniListEl.innerHTML = lines
      .map(function (line) {
        return (
          '<li class="cart-sidebar__mini-item">' +
          '<span class="cart-sidebar__mini-name">' +
          escapeHtml(line.product.title) +
          "</span>" +
          '<span class="cart-sidebar__mini-qty">× ' +
          line.qty +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function render() {
    if (!rootEl) return;
    var lines = window.NostalgiaCart.getLineItems();
    var layout = document.querySelector(".cart-page__layout");
    var hasItems = lines.length > 0;

    if (layout) layout.classList.toggle("cart-page__layout--empty", !hasItems);
    rootEl.classList.toggle("cart-page--empty", !hasItems);

    if (heroActionsEl) heroActionsEl.hidden = !hasItems;
    if (sidebarEl) sidebarEl.hidden = !hasItems;
    if (extrasEl) extrasEl.hidden = !hasItems;
    if (footEl) footEl.hidden = !hasItems;
    if (couponEl) couponEl.hidden = !hasItems;

    if (!hasItems) {
      if (emptyEl) emptyEl.hidden = false;
      if (itemsEl) itemsEl.hidden = true;
      updateNotice([]);
      return;
    }

    syncCouponUi();
    updateNotice(lines);

    if (emptyEl) emptyEl.hidden = true;
    if (itemsEl) {
      itemsEl.hidden = false;
      itemsEl.innerHTML = lines.map(buildLineHtml).join("");
      window.NostalgiaCart.bindQtyControls(itemsEl);
    }

    renderMiniList(lines);
    renderSummary(lines);
  }

  function init() {
    rootEl = document.getElementById("cart-page-root");
    emptyEl = document.getElementById("cart-empty");
    itemsEl = document.getElementById("cart-items");
    summaryEl = document.getElementById("cart-summary");
    miniListEl = document.getElementById("cart-mini-items");
    sidebarEl = document.getElementById("cart-sidebar");
    heroActionsEl = document.getElementById("cart-page-hero-actions");
    extrasEl = document.getElementById("cart-page-extras");
    footEl = document.getElementById("cart-page-foot");
    couponEl = document.getElementById("cart-coupon");
    couponForm = document.getElementById("cart-coupon-form");
    couponInput = document.getElementById("cart-coupon-input");
    couponFeedback = document.getElementById("cart-coupon-feedback");
    couponRemoveBtn = document.getElementById("cart-coupon-remove");
    noticeEl = document.getElementById("cart-stock-notice");
    bindCouponForm();
    render();
    window.addEventListener("nostalgia-cart-updated", render);
    window.addEventListener("nostalgia-locale-updated", render);
    window.addEventListener("nostalgia-coupon-updated", render);
    document.addEventListener("nostalgia-stock-updated", render);
    document.addEventListener("nostalgia-products-updated", render);
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        render();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaCartPage = { render: render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
