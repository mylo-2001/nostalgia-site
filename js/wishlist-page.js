(function () {
  var LOW_STOCK = 5;
  var rootEl;
  var emptyEl;
  var gridEl;
  var countEl;
  var noticeEl;

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

  function updateNotice(products) {
    if (!noticeEl) return;
    var out = 0;
    var low = 0;
    products.forEach(function (p) {
      var s = stockState(p);
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
      msg = t("stock_notice_wish_both");
      cls += " stock-notice--out";
    } else if (out) {
      msg = t("stock_notice_wish_out");
      cls += " stock-notice--out";
    } else {
      msg = t("stock_notice_wish_low");
      cls += " stock-notice--low";
    }
    noticeEl.className = cls;
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
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
      updateNotice([]);
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (!gridEl) return;

    updateNotice(products);

    gridEl.hidden = false;
    gridEl.innerHTML = products
      .map(function (p) {
        var url = window.NostalgiaProducts.getProductUrl(p.id);
        var stock = stockState(p);
        var out = stock && stock.kind === "out";
        var stockHtml = stock
          ? '<span class="stock-pill stock-pill--' +
            stock.kind +
            '">' +
            escapeHtml(stock.text) +
            "</span>"
          : "";
        var addLabel = out ? t("stock_out") : t("product_add_cart");
        return (
          '<article class="wishlist-card' +
          (out ? " wishlist-card--out" : "") +
          '" data-product-id="' +
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
          stockHtml +
          '    <div class="wishlist-card__actions">' +
          '      <button type="button" class="btn-shop btn-shop--primary wishlist-card__add" data-wishlist-add="' +
          escapeHtml(p.id) +
          '"' +
          (out ? " disabled" : "") +
          ">" +
          escapeHtml(addLabel) +
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
        if (btn.disabled) return;
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
    noticeEl = document.getElementById("wishlist-stock-notice");
    render();

    window.addEventListener("nostalgia-wishlist-updated", render);
    document.addEventListener("nostalgia-stock-updated", render);
    document.addEventListener("nostalgia-products-updated", render);
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
