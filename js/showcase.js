(function () {
  /**
   * Renders the "New Arrivals" and "Sale" showcase pages, with the same filter
   * sidebar (sort · colour · price · sale) as the collection page. The page mode
   * comes from <body data-showcase="new|sale">. Products come from the unified
   * catalog (js/products.js).
   */

  var mode = document.body.getAttribute("data-showcase") || "new";
  var gridEl;
  var countEl;

  /* filter state */
  var activeColor = null;
  var priceMin = null;
  var priceMax = null;
  var saleOnly = false;
  var bestSellerRank = null;

  /* filter elements (built once by ensureLayout) */
  var layoutBuilt = false;
  var filtersEl, filtersToggleEl, filtersBackdropEl;
  var sortEl, colorsEl, colorsSwatchEl;
  var priceMinEl, priceMaxEl, priceApplyEl, saleOnlyEl, filtersClearEl;

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

  function pickTitle(item) {
    if (!item) return "";
    if (document.documentElement.lang === "en" && item.titleEn && String(item.titleEn).trim()) {
      return item.titleEn;
    }
    return item.title || "";
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
      var current = Number(item.salePrice);
      var reference = item.priorPrice != null ? Number(item.priorPrice) : Number(item.price);
      if (!(reference > current)) {
        wrap.textContent = money(current);
        return wrap;
      }
      var was = document.createElement("span");
      was.className = "showcase-price__was";
      was.textContent = money(reference);
      was.title = /^en/i.test(document.documentElement.lang)
        ? "Lowest price in the previous 30 days"
        : "Χαμηλότερη τιμή προηγούμενων 30 ημερών";
      var now = document.createElement("span");
      now.className = "showcase-price__now";
      now.textContent = money(current);
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
    var titleText = pickTitle(item);
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

  function renderEmpty(noResults) {
    var empty = document.createElement("section");
    empty.className = "collection-coming";
    empty.setAttribute("role", "listitem");

    var eyebrow = document.createElement("p");
    eyebrow.className = "collection-coming__eyebrow";
    eyebrow.textContent = mode === "sale" ? "NOSTALGIA" : t("nav_new_arrivals");

    var title = document.createElement("h3");
    title.className = "collection-coming__title";
    title.textContent = mode === "sale"
      ? (document.documentElement.lang === "en" ? "Selected offers" : "Επιλεγμένες προσφορές")
      : t("new_arrivals_title");

    var lead = document.createElement("p");
    lead.className = "collection-coming__lead";
    lead.textContent = noResults
      ? t("collection_no_results")
      : t(mode === "sale" ? "sale_empty" : "new_arrivals_empty");

    empty.appendChild(eyebrow);
    empty.appendChild(title);
    empty.appendChild(lead);
    gridEl.appendChild(empty);
  }

  /* ---- filter sidebar ---- */

  function sidebarHtml() {
    var saleRow =
      mode === "sale"
        ? ""
        : '<label class="collection-check">' +
          '<input type="checkbox" id="collection-sale-only" class="collection-check__input" />' +
          '<span class="collection-check__box" aria-hidden="true"></span>' +
          '<span class="collection-check__label" data-i18n="collection_sale_only">Μόνο σε έκπτωση</span>' +
          "</label>";
    return (
      '<div class="collection-filters__backdrop" id="collection-filters-backdrop" hidden></div>' +
      '<aside class="collection-filters" id="collection-filters" data-i18n-aria="collection_filters_title" aria-label="Φίλτρα">' +
      '<div class="collection-filters__head">' +
      '<span class="collection-filters__head-title" data-i18n="collection_filters_title">Φίλτρα</span>' +
      '<button type="button" class="collection-filters__close" id="collection-filters-close" data-i18n-aria="collection_filters_close_aria" aria-label="Κλείσιμο φίλτρων">×</button>' +
      "</div>" +
      '<div class="collection-filter">' +
      '<h4 class="collection-filter__title" data-i18n="collection_sort_label">Ταξινόμηση</h4>' +
      '<select id="collection-sort" class="collection-filter__select">' +
      '<option value="featured" data-i18n="collection_sort_featured">Προτεινόμενα</option>' +
      '<option value="bestseller" data-i18n="collection_sort_bestseller">Best seller</option>' +
      '<option value="price-asc" data-i18n="collection_sort_price_asc">Τιμή: χαμηλή προς υψηλή</option>' +
      '<option value="price-desc" data-i18n="collection_sort_price_desc">Τιμή: υψηλή προς χαμηλή</option>' +
      '<option value="name-asc" data-i18n="collection_sort_name">Όνομα A-Z</option>' +
      "</select>" +
      "</div>" +
      '<div class="collection-filter collection-filter--colors" id="collection-colors" hidden>' +
      '<h4 class="collection-filter__title" data-i18n="collection_color_label">Χρώμα</h4>' +
      '<ul class="collection-colors__list" id="collection-colors-swatches" role="group" data-i18n-aria="collection_color_label" aria-label="Χρώμα"></ul>' +
      "</div>" +
      '<div class="collection-filter">' +
      '<h4 class="collection-filter__title" data-i18n="collection_filter_price">Τιμή</h4>' +
      '<div class="collection-price">' +
      '<input type="number" id="collection-price-min" class="collection-price__input" min="0" step="1" inputmode="numeric" data-i18n-aria="collection_price_from" aria-label="Από" placeholder="0" />' +
      '<span class="collection-price__sep" aria-hidden="true">–</span>' +
      '<input type="number" id="collection-price-max" class="collection-price__input" min="0" step="1" inputmode="numeric" data-i18n-aria="collection_price_to" aria-label="Έως" placeholder="—" />' +
      '<span class="collection-price__cur" aria-hidden="true">€</span>' +
      "</div>" +
      '<button type="button" class="collection-price__apply" id="collection-price-apply" data-i18n="collection_price_apply">Εφαρμογή</button>' +
      saleRow +
      "</div>" +
      '<button type="button" class="collection-filters__clear" id="collection-filters-clear" data-i18n="collection_filters_clear">Καθαρισμός φίλτρων</button>' +
      "</aside>"
    );
  }

  function ensureLayout() {
    if (layoutBuilt || !gridEl) return;
    layoutBuilt = true;

    var bar = document.querySelector(".showcase__bar");
    if (bar && !document.getElementById("collection-filters-toggle")) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "collection-filters-toggle";
      toggle.className = "collection-filters-toggle";
      toggle.setAttribute("aria-controls", "collection-filters");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>' +
        '<span data-i18n="collection_filters_title">' + t("collection_filters_title") + "</span>";
      bar.insertBefore(toggle, bar.firstChild);
    }

    var layout = document.createElement("div");
    layout.className = "collection-catalog__layout";
    layout.innerHTML = sidebarHtml();
    var main = document.createElement("div");
    main.className = "collection-catalog__main";
    gridEl.parentNode.insertBefore(layout, gridEl);
    main.appendChild(gridEl);
    layout.appendChild(main);

    filtersEl = document.getElementById("collection-filters");
    filtersToggleEl = document.getElementById("collection-filters-toggle");
    filtersBackdropEl = document.getElementById("collection-filters-backdrop");
    sortEl = document.getElementById("collection-sort");
    colorsEl = document.getElementById("collection-colors");
    colorsSwatchEl = document.getElementById("collection-colors-swatches");
    priceMinEl = document.getElementById("collection-price-min");
    priceMaxEl = document.getElementById("collection-price-max");
    priceApplyEl = document.getElementById("collection-price-apply");
    saleOnlyEl = document.getElementById("collection-sale-only");
    filtersClearEl = document.getElementById("collection-filters-clear");

    if (sortEl) {
      sortEl.addEventListener("change", function () {
        if (sortEl.value === "bestseller") fetchBestSellerRank();
        render();
      });
    }
    if (priceApplyEl) priceApplyEl.addEventListener("click", applyPriceInputs);
    [priceMinEl, priceMaxEl].forEach(function (el) {
      if (!el) return;
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); applyPriceInputs(); }
      });
      el.addEventListener("change", applyPriceInputs);
    });
    if (saleOnlyEl) {
      saleOnlyEl.addEventListener("change", function () {
        saleOnly = !!saleOnlyEl.checked;
        render();
      });
    }
    if (filtersClearEl) {
      filtersClearEl.addEventListener("click", function () {
        resetFilterState();
        if (sortEl) sortEl.value = "featured";
        render();
      });
    }
    if (filtersToggleEl) {
      filtersToggleEl.addEventListener("click", function () {
        if (filtersEl && filtersEl.classList.contains("is-open")) closeFilters();
        else openFilters();
      });
    }
    var closeBtn = document.getElementById("collection-filters-close");
    if (closeBtn) closeBtn.addEventListener("click", closeFilters);
    if (filtersBackdropEl) filtersBackdropEl.addEventListener("click", closeFilters);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && filtersEl && filtersEl.classList.contains("is-open")) closeFilters();
    });

    /* translate the freshly-injected markup */
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.applyLang === "function") {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }

    fetchBestSellerRank();
  }

  function renderColorFilter(list) {
    if (!colorsEl || !colorsSwatchEl || !window.NostalgiaProducts) return;
    var families = window.NostalgiaProducts.COLOR_FAMILIES || [];
    var counts = {};
    list.forEach(function (p) {
      (p.colors || []).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    var available = families.filter(function (f) { return counts[f.id]; });

    if (available.length < 2) {
      colorsEl.hidden = true;
      colorsSwatchEl.innerHTML = "";
      activeColor = null;
      return;
    }
    if (activeColor && !counts[activeColor]) activeColor = null;

    colorsEl.hidden = false;
    colorsSwatchEl.innerHTML = "";

    function addRow(opts) {
      var li = document.createElement("li");
      li.className = "collection-colors__item";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "collection-color" +
        (opts.active ? " is-active" : "") +
        (opts.all ? " collection-color--all" : "");
      btn.setAttribute("data-color", opts.id || "");
      btn.setAttribute("aria-pressed", opts.active ? "true" : "false");
      if (!opts.all) {
        var dot = document.createElement("span");
        dot.className = "collection-color__dot collection-color__dot--" + opts.id;
        if (opts.hex) dot.style.background = opts.hex;
        btn.appendChild(dot);
      }
      var name = document.createElement("span");
      name.className = "collection-color__name";
      name.textContent = opts.label;
      btn.appendChild(name);
      if (opts.count != null) {
        var count = document.createElement("span");
        count.className = "collection-color__count";
        count.textContent = opts.count;
        btn.appendChild(count);
      }
      btn.addEventListener("click", opts.onClick);
      li.appendChild(btn);
      colorsSwatchEl.appendChild(li);
    }

    addRow({
      all: true, active: !activeColor, label: t("collection_filter_all"),
      count: list.length, onClick: function () { setColor(null); },
    });
    available.forEach(function (f) {
      addRow({
        id: f.id, hex: f.hex, active: activeColor === f.id, label: t(f.key), count: counts[f.id],
        onClick: function () { setColor(activeColor === f.id ? null : f.id); },
      });
    });
  }

  function setColor(id) { activeColor = id; render(); }

  function priceOf(item) {
    var P = window.NostalgiaProducts;
    if (P && typeof P.getEffectivePrice === "function") return P.getEffectivePrice(item);
    return item && item.price != null ? Number(item.price) : null;
  }

  function bestSellerRankOf(item) {
    if (!bestSellerRank) return Infinity;
    var r = bestSellerRank[item.id];
    return r == null ? Infinity : r;
  }

  function applyFilters(list) {
    var out = list.slice();
    var P = window.NostalgiaProducts;
    var sortVal = sortEl ? sortEl.value : "featured";

    if (activeColor) {
      out = out.filter(function (item) { return (item.colors || []).indexOf(activeColor) !== -1; });
    }
    if (saleOnly && P && typeof P.isOnSale === "function") {
      out = out.filter(function (item) { return P.isOnSale(item); });
    }
    if (priceMin != null || priceMax != null) {
      out = out.filter(function (item) {
        var price = priceOf(item);
        if (price == null) return false;
        if (priceMin != null && price < priceMin) return false;
        if (priceMax != null && price > priceMax) return false;
        return true;
      });
    }

    if (sortVal === "name-asc") {
      out.sort(function (a, b) { return pickTitle(a).localeCompare(pickTitle(b)); });
    } else if (sortVal === "price-asc") {
      out.sort(function (a, b) {
        var pa = priceOf(a), pb = priceOf(b);
        return (pa == null ? Infinity : pa) - (pb == null ? Infinity : pb);
      });
    } else if (sortVal === "price-desc") {
      out.sort(function (a, b) {
        var pa = priceOf(a), pb = priceOf(b);
        return (pb == null ? -Infinity : pb) - (pa == null ? -Infinity : pa);
      });
    } else if (sortVal === "bestseller") {
      out.sort(function (a, b) {
        return bestSellerRankOf(a) - bestSellerRankOf(b) || (a._showcaseIndex - b._showcaseIndex);
      });
    } else {
      out.sort(function (a, b) { return a._showcaseIndex - b._showcaseIndex; });
    }
    return out;
  }

  function fetchBestSellerRank() {
    if (bestSellerRank || !window.fetch) return;
    window
      .fetch("/api/products/bestsellers", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        bestSellerRank = {};
        if (data && Array.isArray(data.items)) {
          data.items.forEach(function (it, i) { if (it && it.id) bestSellerRank[it.id] = i; });
        }
        if (sortEl && sortEl.value === "bestseller") render();
      })
      .catch(function () { bestSellerRank = {}; });
  }

  function readPriceInput(el) {
    if (!el) return null;
    var v = String(el.value || "").trim();
    if (v === "") return null;
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : null;
  }

  function applyPriceInputs() {
    priceMin = readPriceInput(priceMinEl);
    priceMax = readPriceInput(priceMaxEl);
    if (priceMin != null && priceMax != null && priceMin > priceMax) {
      var tmp = priceMin; priceMin = priceMax; priceMax = tmp;
      if (priceMinEl) priceMinEl.value = String(priceMin);
      if (priceMaxEl) priceMaxEl.value = String(priceMax);
    }
    render();
  }

  function resetFilterState() {
    activeColor = null;
    priceMin = null;
    priceMax = null;
    saleOnly = false;
    if (priceMinEl) priceMinEl.value = "";
    if (priceMaxEl) priceMaxEl.value = "";
    if (saleOnlyEl) saleOnlyEl.checked = false;
    closeFilters();
  }

  function openFilters() {
    if (!filtersEl) return;
    document.body.classList.add("collection-filters-open");
    filtersEl.classList.add("is-open");
    if (filtersBackdropEl) filtersBackdropEl.hidden = false;
    if (filtersToggleEl) filtersToggleEl.setAttribute("aria-expanded", "true");
  }

  function closeFilters() {
    if (!filtersEl) return;
    document.body.classList.remove("collection-filters-open");
    filtersEl.classList.remove("is-open");
    if (filtersBackdropEl) filtersBackdropEl.hidden = true;
    if (filtersToggleEl) filtersToggleEl.setAttribute("aria-expanded", "false");
  }

  function render() {
    if (!gridEl) return;
    ensureLayout();

    var baseList = getList();
    baseList.forEach(function (p, i) { p._showcaseIndex = i; });
    renderColorFilter(baseList);
    var list = applyFilters(baseList);

    if (countEl) {
      countEl.textContent = t("showcase_items_count").replace("{n}", String(list.length));
    }

    gridEl.innerHTML = "";
    if (!list.length) {
      renderEmpty(baseList.length > 0);
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
