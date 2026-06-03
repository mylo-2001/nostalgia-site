(function () {
  var COUPON_STORAGE = "nostalgia-coupon";

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

  function buildLineHtml(line) {
    var p = line.product;
    var url = window.NostalgiaProducts.getProductUrl(p.id);
    return (
      '<li class="cart-line">' +
      '<a class="cart-line__media" href="' +
      url +
      '"><img src="' +
      escapeHtml(p.image) +
      '" alt="" width="88" height="88" loading="lazy" decoding="async" /></a>' +
      '<div class="cart-line__body">' +
      '<a class="cart-line__name" href="' +
      url +
      '">' +
      escapeHtml(p.title) +
      "</a>" +
      '<span class="cart-line__meta">' +
      escapeHtml(p.categoryName) +
      "</span>" +
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
      '" min="1" max="99" aria-label="' +
      escapeHtml(t("cart_qty_label")) +
      '" />' +
      '<button type="button" class="qty-stepper__btn" data-qty-plus data-product-id="' +
      escapeHtml(p.id) +
      '" aria-label="+">+</button>' +
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

  function getStoredCoupon() {
    try {
      var code = localStorage.getItem(COUPON_STORAGE);
      return code ? String(code).trim() : "";
    } catch (e) {
      return "";
    }
  }

  function setStoredCoupon(code) {
    try {
      if (code) localStorage.setItem(COUPON_STORAGE, code);
      else localStorage.removeItem(COUPON_STORAGE);
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("nostalgia-coupon-updated"));
  }

  function showCouponFeedback(message, isError) {
    if (!couponFeedback) return;
    couponFeedback.textContent = message;
    couponFeedback.hidden = !message;
    couponFeedback.classList.toggle("is-error", !!isError);
    couponFeedback.classList.toggle("is-success", !isError && !!message);
  }

  function syncCouponUi() {
    if (!couponInput) return;
    var code = getStoredCoupon();
    couponInput.value = code;
    if (couponRemoveBtn) couponRemoveBtn.hidden = !code;
    if (couponInput) couponInput.disabled = !!code;
    if (code) {
      showCouponFeedback(t("cart_coupon_saved"), false);
    } else {
      showCouponFeedback("", false);
    }
  }

  function bindCouponForm() {
    if (!couponForm || couponBound) return;
    couponBound = true;

    couponForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = couponInput ? couponInput.value.trim() : "";
      if (!code) {
        showCouponFeedback(t("cart_coupon_empty"), true);
        return;
      }
      setStoredCoupon(code.toUpperCase());
      syncCouponUi();
      render();
    });

    if (couponRemoveBtn) {
      couponRemoveBtn.addEventListener("click", function () {
        setStoredCoupon("");
        if (couponInput) {
          couponInput.value = "";
          couponInput.disabled = false;
        }
        showCouponFeedback("", false);
        if (couponRemoveBtn) couponRemoveBtn.hidden = true;
        render();
      });
    }
  }

  function renderSummary(lines) {
    if (!summaryEl) return;
    var itemCount = lines.reduce(function (sum, line) {
      return sum + line.qty;
    }, 0);
    var coupon = getStoredCoupon();
    var couponRow = coupon
      ? '<div class="cart-summary__row cart-summary__row--coupon">' +
        '<dt data-i18n="cart_coupon_row">' +
        escapeHtml(t("cart_coupon_row")) +
        "</dt>" +
        '<dd><span class="cart-summary__coupon-code">' +
        escapeHtml(coupon) +
        "</span></dd>" +
        "</div>"
      : "";

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
      '<dd data-i18n="cart_shipping_note">' +
      escapeHtml(t("cart_shipping_note")) +
      "</dd>" +
      "</div>" +
      couponRow +
      "</dl>" +
      '<p class="cart-summary__note" data-i18n="cart_summary_note">' +
      escapeHtml(t("cart_summary_note")) +
      "</p>" +
      '<a class="btn-shop btn-shop--primary cart-summary__checkout" href="checkout.html" data-i18n="cart_proceed_checkout">' +
      escapeHtml(t("cart_proceed_checkout")) +
      "</a>" +
      '<a class="btn-shop btn-shop--ghost cart-summary__continue" href="collection.html" data-i18n="cart_continue_shopping">' +
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
      return;
    }

    syncCouponUi();

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
    bindCouponForm();
    render();
    window.addEventListener("nostalgia-cart-updated", render);
    window.addEventListener("nostalgia-locale-updated", render);
    window.addEventListener("nostalgia-coupon-updated", render);
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
