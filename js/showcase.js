(function () {
  /**
   * Renders the "New Arrivals" and "Sale" showcase pages.
   * The page mode comes from <body data-showcase="new|sale">.
   * Products come from the unified catalog (js/products.js) which merges the
   * static catalog with admin-created products + price/sale overrides from the
   * backend, so these pages update automatically when the backend responds.
   */

  var mode = document.body.getAttribute("data-showcase") || "new";
  var gridEl;
  var countEl;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getList() {
    var P = window.NostalgiaProducts;
    if (!P) return [];
    if (mode === "sale" && typeof P.getOnSale === "function") {
      return P.getOnSale();
    }
    if (typeof P.getNewArrivals === "function") {
      return P.getNewArrivals();
    }
    return [];
  }

  function money(value) {
    return "€" + Number(value).toFixed(2);
  }

  function buildBadge(item) {
    var badge = document.createElement("div");
    badge.className = "showcase-badge showcase-badge--" + mode;
    if (mode === "sale" && window.NostalgiaProducts) {
      var pct = window.NostalgiaProducts.discountPercent(item);
      badge.textContent = pct > 0 ? "-" + pct + "%" : t("badge_sale");
    } else {
      badge.textContent = t("badge_new");
    }
    return badge;
  }

  function buildPrice(item) {
    var wrap = document.createElement("p");
    wrap.className = "collection-product__price showcase-price";
    var onSale =
      window.NostalgiaProducts && window.NostalgiaProducts.isOnSale(item);
    if (onSale) {
      var was = document.createElement("span");
      was.className = "showcase-price__was";
      was.textContent = money(item.price);
      var now = document.createElement("span");
      now.className = "showcase-price__now";
      now.textContent = money(item.salePrice);
      wrap.appendChild(was);
      wrap.appendChild(now);
    } else if (item.price != null) {
      wrap.textContent = money(item.price);
    } else {
      return null;
    }
    return wrap;
  }

  function buildCard(item, i) {
    var productId = item.id;
    var titleText = item.title;
    var productUrl = window.NostalgiaProducts
      ? window.NostalgiaProducts.getProductUrl(productId)
      : "/product/" + encodeURIComponent(productId);

    var article = document.createElement("article");
    article.className =
      "collection-product showcase-product site-reveal site-reveal--d" +
      ((i % 4) + 1);
    article.setAttribute("data-category", item.catId);
    article.setAttribute("data-product-id", productId);
    article.setAttribute("data-reveal-tagged", "1");
    article.setAttribute("role", "listitem");

    var link = document.createElement("a");
    link.className = "collection-product__link";
    link.href = productUrl;
    link.setAttribute("aria-label", titleText);

    var visual = document.createElement("div");
    visual.className = "collection-product__visual candle-hover";
    visual.appendChild(buildBadge(item));

    if (window.NostalgiaImages && typeof window.NostalgiaImages.create === "function") {
      visual.appendChild(
        window.NostalgiaImages.create(item.image, {
          alt: "",
          loading: "lazy",
          sizes: "(max-width: 640px) 50vw, 280px",
        })
      );
    } else {
      var img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      visual.appendChild(img);
    }

    var meta = document.createElement("div");
    meta.className = "collection-product__meta";

    var name = document.createElement("h3");
    name.className = "collection-product__name";
    name.textContent = titleText;
    meta.appendChild(name);

    var price = buildPrice(item);
    if (price) meta.appendChild(price);

    link.appendChild(visual);
    link.appendChild(meta);
    article.appendChild(link);

    return article;
  }

  function renderEmpty() {
    var empty = document.createElement("section");
    empty.className = "collection-coming";
    empty.setAttribute("role", "listitem");

    var eyebrow = document.createElement("p");
    eyebrow.className = "collection-coming__eyebrow";
    eyebrow.textContent = t(mode === "sale" ? "nav_sale" : "nav_new_arrivals");

    var title = document.createElement("h3");
    title.className = "collection-coming__title";
    title.textContent = t(mode === "sale" ? "sale_title" : "new_arrivals_title");

    var lead = document.createElement("p");
    lead.className = "collection-coming__lead";
    lead.textContent = t(mode === "sale" ? "sale_empty" : "new_arrivals_empty");

    empty.appendChild(eyebrow);
    empty.appendChild(title);
    empty.appendChild(lead);
    gridEl.appendChild(empty);
  }

  function render() {
    if (!gridEl) return;
    gridEl.innerHTML = "";
    var list = getList();

    if (countEl) {
      countEl.textContent = t("showcase_items_count").replace(
        "{n}",
        String(list.length)
      );
    }

    if (!list.length) {
      renderEmpty();
      return;
    }

    list.forEach(function (item, i) {
      gridEl.appendChild(buildCard(item, i));
    });

    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.refreshReveal === "function") {
      window.NostalgiaPolish.refreshReveal();
    }
  }

  function bind() {
    gridEl = document.getElementById("showcase-grid");
    countEl = document.getElementById("showcase-count");

    /* re-render when admin products / prices arrive from the backend */
    document.addEventListener("nostalgia-products-updated", render);
    document.addEventListener("nostalgia-stock-updated", render);

    /* keep titles/labels in sync with language changes */
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        render();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
