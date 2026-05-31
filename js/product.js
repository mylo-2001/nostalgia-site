(function () {
  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getProductId() {
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || "";
  }

  function renderNotFound() {
    var root = document.getElementById("product-page-root");
    if (!root) return;
    root.innerHTML =
      '<div class="product-not-found">' +
      '  <h1 class="product-info__title" data-i18n="product_not_found">' +
      t("product_not_found") +
      "</h1>" +
      '  <a class="btn-shop btn-shop--ghost" href="collection.html" style="max-width:16rem;margin:1rem auto 0" data-i18n="cart_continue">' +
      t("cart_continue") +
      "</a>" +
      "</div>";
  }

  function renderProduct(product) {
    var root = document.getElementById("product-page-root");
    if (!root) return;

    document.title =
      product.title + " · Nostalgia Collection";

    root.innerHTML =
      '<div class="product-page__layout">' +
      '  <figure class="product-gallery">' +
      '    <img class="product-gallery__img" src="' +
      product.image +
      '" alt="' +
      product.title.replace(/"/g, "&quot;") +
      '" decoding="async" />' +
      "  </figure>" +
      '  <div class="product-info">' +
      '    <p class="product-info__breadcrumb">' +
      '      <a href="collection.html">' +
      t("nav_collection") +
      "</a> · " +
      '      <a href="collection.html#' +
      product.catId +
      '">' +
      product.categoryName +
      "</a>" +
      "    </p>" +
      '    <h1 class="product-info__title">' +
      product.title +
      "</h1>" +
      '    <p class="product-info__shipping">' +
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
      '      <span data-i18n="cart_shipping_free">' +
      t("cart_shipping_free") +
      "</span>" +
      "    </p>" +
      '    <label class="product-info__qty-label" for="product-qty" data-i18n="product_qty_label">' +
      t("product_qty_label") +
      "</label>" +
      '    <div class="product-info__actions">' +
      '      <div class="product-info__actions-row">' +
      '        <div class="qty-stepper">' +
      '          <button type="button" class="qty-stepper__btn" id="product-qty-minus" aria-label="-">−</button>' +
      '          <input type="number" class="qty-stepper__input" id="product-qty" value="1" min="1" max="99" aria-label="' +
      t("product_qty_label") +
      '" />' +
      '          <button type="button" class="qty-stepper__btn" id="product-qty-plus" aria-label="+">+</button>' +
      "        </div>" +
      '        <button type="button" class="btn-shop btn-shop--primary" id="product-add-cart" data-i18n="product_add_cart">' +
      t("product_add_cart") +
      "</button>" +
      "      </div>" +
      '      <button type="button" class="btn-shop btn-shop--buy" id="product-buy-now" data-i18n="product_buy_now">' +
      t("product_buy_now") +
      "</button>" +
      "    </div>" +
      "  </div>" +
      "</div>";

    var qtyInput = document.getElementById("product-qty");
    document.getElementById("product-qty-minus").addEventListener("click", function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    });
    document.getElementById("product-qty-plus").addEventListener("click", function () {
      qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
    });

    document.getElementById("product-add-cart").addEventListener("click", function () {
      var qty = parseInt(qtyInput.value, 10) || 1;
      window.NostalgiaCart.addAndNotify(product.id, qty);
    });

    document.getElementById("product-buy-now").addEventListener("click", function () {
      var qty = parseInt(qtyInput.value, 10) || 1;
      window.NostalgiaCart.addItem(product.id, qty);
      window.location.href = "checkout.html";
    });
  }

  function init() {
    var id = getProductId();
    if (!window.NostalgiaProducts) return;
    var product = window.NostalgiaProducts.getById(id);
    if (!product) {
      renderNotFound();
      return;
    }
    renderProduct(product);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
