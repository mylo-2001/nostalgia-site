(function () {
  var REVIEWS_KEY = "nostalgia-reviews";

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
      '      <button type="button" class="btn-shop btn-shop--ghost" id="product-toggle-wishlist">' +
      getWishlistLabel(product.id) +
      "</button>" +
      "    </div>" +
      "  </div>" +
      "</div>" +
      renderReviewsHTML(product) +
      renderRelatedHTML(product);

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

    var wishlistBtn = document.getElementById("product-toggle-wishlist");
    if (wishlistBtn) {
      wishlistBtn.addEventListener("click", function () {
        if (window.NostalgiaWishlist) window.NostalgiaWishlist.toggle(product.id);
        wishlistBtn.textContent = getWishlistLabel(product.id);
      });
    }

    bindReviews(product);
  }

  function getWishlistLabel(id) {
    var has = window.NostalgiaWishlist && window.NostalgiaWishlist.has(id);
    return has ? "♥ " + t("wishlist_remove") : "♡ " + t("wishlist_add");
  }

  function getReviews(productId) {
    try {
      var all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}");
      return Array.isArray(all[productId]) ? all[productId] : [];
    } catch (e) {
      return [];
    }
  }

  function saveReview(productId, review) {
    try {
      var all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}");
      if (!Array.isArray(all[productId])) all[productId] = [];
      all[productId].unshift(review);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderReviewsHTML(product) {
    var reviews = getReviews(product.id);
    var avg = reviews.length
      ? (reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length).toFixed(1)
      : "0.0";
    var list = reviews
      .slice(0, 6)
      .map(function (r) {
        return (
          '<li><strong>' + escapeHtml(r.name) + "</strong>" +
          '<span class="product-reviews__stars">' + "★".repeat(r.rating) + "</span>" +
          "<p>" + escapeHtml(r.text) + "</p></li>"
        );
      })
      .join("");
    return (
      '<section class="product-reviews">' +
      '  <h2>' + t("reviews_title") + '</h2>' +
      '  <p class="product-reviews__summary">' + t("reviews_avg") + ": " + avg + " · " + reviews.length + " " + t("reviews_count") + "</p>" +
      '  <form class="product-reviews__form" id="product-review-form">' +
      '    <input id="review-name" type="text" placeholder="' + t("reviews_name") + '" required />' +
      '    <select id="review-rating"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>' +
      '    <textarea id="review-text" placeholder="' + t("reviews_placeholder") + '" required></textarea>' +
      '    <button type="submit" class="btn-shop btn-shop--primary">' + t("reviews_submit") + "</button>" +
      "  </form>" +
      '  <ul class="product-reviews__list">' + list + "</ul>" +
      "</section>"
    );
  }

  function bindReviews(product) {
    var form = document.getElementById("product-review-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameEl = document.getElementById("review-name");
      var ratingEl = document.getElementById("review-rating");
      var textEl = document.getElementById("review-text");
      saveReview(product.id, {
        name: (nameEl.value || "").trim() || "Guest",
        rating: Math.max(1, Math.min(5, parseInt(ratingEl.value, 10) || 5)),
        text: (textEl.value || "").trim(),
      });
      renderProduct(product);
    });
  }

  function renderRelatedHTML(product) {
    var all = window.NostalgiaProducts && typeof window.NostalgiaProducts.getAll === "function"
      ? window.NostalgiaProducts.getAll()
      : [];
    var related = all.filter(function (p) { return p.catId !== product.catId; }).sort(function () { return Math.random() - 0.5; }).slice(0, 4);
    if (!related.length) return "";
    var cards = related.map(function (item) {
      return (
        '<article class="related-card">' +
        '  <a href="product.html?id=' + encodeURIComponent(item.id) + '">' +
        '    <img src="' + item.image + '" alt="' + escapeHtml(item.title) + '" loading="lazy" decoding="async" />' +
        '    <h3>' + escapeHtml(item.title) + '</h3>' +
        "  </a>" +
        "</article>"
      );
    }).join("");
    return (
      '<section class="related-products">' +
      '  <h2>' + t("related_title") + "</h2>" +
      '  <div class="related-products__grid">' + cards + "</div>" +
      "</section>"
    );
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
