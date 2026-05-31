(function () {
  var rootEl;
  var emptyEl;
  var itemsEl;
  var summaryEl;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function render() {
    if (!rootEl) return;
    var lines = window.NostalgiaCart.getLineItems();
    var layout = document.querySelector(".cart-page__layout");

    if (layout) {
      layout.classList.toggle("cart-page__layout--empty", !lines.length);
    }
    if (rootEl) {
      rootEl.classList.toggle("cart-page--empty", !lines.length);
    }

    if (!lines.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (itemsEl) itemsEl.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (itemsEl) {
      itemsEl.hidden = false;
      itemsEl.innerHTML = lines
        .map(function (line) {
          var p = line.product;
          return (
            '<li class="cart-item">' +
            '  <a class="cart-item__media" href="' +
            window.NostalgiaProducts.getProductUrl(p.id) +
            '">' +
            '    <img src="' +
            p.image +
            '" alt="" loading="lazy" decoding="async" />' +
            "  </a>" +
            '  <div class="cart-item__body">' +
            '    <span class="cart-item__cat">' +
            p.categoryName +
            "</span>" +
            '    <a class="cart-item__name" href="' +
            window.NostalgiaProducts.getProductUrl(p.id) +
            '">' +
            p.title +
            "</a>" +
            '    <div class="cart-item__row">' +
            '      <div class="qty-stepper qty-stepper--compact">' +
            '        <button type="button" class="qty-stepper__btn" data-qty-minus data-product-id="' +
            p.id +
            '" aria-label="-">−</button>' +
            '        <input type="number" class="qty-stepper__input" data-qty-input data-product-id="' +
            p.id +
            '" value="' +
            line.qty +
            '" min="1" max="99" aria-label="' +
            t("cart_qty_label") +
            '" />' +
            '        <button type="button" class="qty-stepper__btn" data-qty-plus data-product-id="' +
            p.id +
            '" aria-label="+">+</button>' +
            "      </div>" +
            "    </div>" +
            '    <button type="button" class="cart-item__remove" data-cart-remove data-product-id="' +
            p.id +
            '">' +
            t("cart_remove") +
            "</button>" +
            "  </div>" +
            "</li>"
          );
        })
        .join("");
      window.NostalgiaCart.bindQtyControls(itemsEl);
    }

    if (summaryEl) {
      summaryEl.hidden = false;
      summaryEl.innerHTML =
        '<h2 class="cart-summary__title" data-i18n="cart_summary_title">' +
        t("cart_summary_title") +
        "</h2>" +
        '<p class="cart-summary__note" data-i18n="cart_summary_note">' +
        t("cart_summary_note") +
        "</p>" +
        '<div class="cart-summary__actions">' +
        '  <a class="btn-shop btn-shop--primary" href="checkout.html" data-i18n="cart_checkout">' +
        t("cart_checkout") +
        "</a>" +
        '  <a class="btn-shop btn-shop--ghost" href="collection.html" data-i18n="cart_continue">' +
        t("cart_continue") +
        "</a>" +
        "</div>";
    }
  }

  function init() {
    rootEl = document.getElementById("cart-page-root");
    emptyEl = document.getElementById("cart-empty");
    itemsEl = document.getElementById("cart-items");
    summaryEl = document.getElementById("cart-summary");
    render();
    window.addEventListener("nostalgia-cart-updated", render);
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
