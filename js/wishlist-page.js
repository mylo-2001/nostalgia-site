(function () {
  var rootEl;
  var emptyEl;
  var gridEl;
  var countEl;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProducts() {
    if (!window.NostalgiaWishlist || !window.NostalgiaProducts) return [];
    return window.NostalgiaWishlist.getAll()
      .map(function (id) {
        return window.NostalgiaProducts.getById(id);
      })
      .filter(Boolean);
  }

  function render() {
    if (!rootEl) return;
    var products = getProducts();

    if (countEl) {
      countEl.textContent = products.length
        ? t("wishlist_count").replace("{n}", String(products.length))
        : "";
    }

    rootEl.classList.toggle("wishlist-page--empty", !products.length);

    if (!products.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (gridEl) {
        gridEl.hidden = true;
        gridEl.innerHTML = "";
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (!gridEl) return;

    gridEl.hidden = false;
    gridEl.innerHTML = products
      .map(function (p) {
        var url = window.NostalgiaProducts.getProductUrl(p.id);
        return (
          '<article class="wishlist-card" data-product-id="' +
          escapeHtml(p.id) +
          '">' +
          '  <a class="wishlist-card__media" href="' +
          escapeHtml(url) +
          '">' +
          '    <img src="' +
          escapeHtml(p.image) +
          '" alt="" loading="lazy" decoding="async" />' +
          "  </a>" +
          '  <div class="wishlist-card__body">' +
          '    <span class="wishlist-card__cat">' +
          escapeHtml(p.categoryName) +
          "</span>" +
          '    <a class="wishlist-card__name" href="' +
          escapeHtml(url) +
          '">' +
          escapeHtml(p.title) +
          "</a>" +
          '    <div class="wishlist-card__actions">' +
          '      <button type="button" class="btn-shop btn-shop--primary wishlist-card__add" data-wishlist-add="' +
          escapeHtml(p.id) +
          '">' +
          escapeHtml(t("product_add_cart")) +
          "</button>" +
          '      <button type="button" class="btn-shop btn-shop--ghost wishlist-card__remove" data-wishlist-remove="' +
          escapeHtml(p.id) +
          '">' +
          escapeHtml(t("wishlist_remove")) +
          "</button>" +
          "    </div>" +
          "  </div>" +
          "</article>"
        );
      })
      .join("");

    gridEl.querySelectorAll("[data-wishlist-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-wishlist-remove");
        if (window.NostalgiaWishlist) window.NostalgiaWishlist.remove(id);
        render();
      });
    });

    gridEl.querySelectorAll("[data-wishlist-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-wishlist-add");
        if (window.NostalgiaCart) window.NostalgiaCart.addAndNotify(id, 1);
      });
    });
  }

  function init() {
    rootEl = document.getElementById("wishlist-page-root");
    emptyEl = document.getElementById("wishlist-empty");
    gridEl = document.getElementById("wishlist-grid");
    countEl = document.getElementById("wishlist-count");
    render();

    window.addEventListener("nostalgia-wishlist-updated", render);
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        render();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
