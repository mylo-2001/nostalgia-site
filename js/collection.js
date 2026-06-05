(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7", "cat8"];

  function muranoImg(n) {
    return "product%20photo/art%20class%20murano%20candle/product%20" + n + ".png";
  }
  function driftwoodImg(name) {
    return "product%20photo/driftwood%20beeswax%20flame/" + name;
  }
  function liquidImg(n) {
    return "product%20photo/liquid%20eternal/product%20" + n + ".png";
  }
  function vesselImg(n) {
    return "product%20photo/unique%20art%20vessel/product%20" + n + ".png";
  }

  var CAT_PRODUCTS = {
    cat1: [
      muranoImg(1), muranoImg(2), muranoImg(3),
      muranoImg(4), muranoImg(5), muranoImg(6),
      muranoImg(7), muranoImg(8), muranoImg(9)
    ],
    cat2: [
      driftwoodImg("product%201.png"),
      driftwoodImg("product%202.png"),
      driftwoodImg("product%203.png"),
      driftwoodImg("product%204%20.png"),
      driftwoodImg("product%205.png"),
      driftwoodImg("product%206%20.png"),
      driftwoodImg("product%207.png"),
      driftwoodImg("product%208.png"),
      driftwoodImg("product%209.png"),
      driftwoodImg("product%2010.png"),
      driftwoodImg("product%2011.png"),
      driftwoodImg("product%2012.png"),
      driftwoodImg("product%2013.png")
    ],
    cat3: [
      liquidImg(1), liquidImg(2), liquidImg(3), liquidImg(4),
      liquidImg(5), liquidImg(6), liquidImg(7), liquidImg(8),
      liquidImg(9), liquidImg(10), liquidImg(11), liquidImg(12),
      liquidImg(13), liquidImg(14), liquidImg(15), liquidImg(16),
      liquidImg(17)
    ],
    cat4: [
      vesselImg(1), vesselImg(2), vesselImg(3), vesselImg(4),
      vesselImg(5), vesselImg(6), vesselImg(7), vesselImg(8)
    ]
  };

  var CAT_HERO = {
    cat1: "product%20photo/art%20class%20murano%20candle/product%20photo%20home%20page%20.png",
    cat2: "product%20photo/driftwood%20beeswax%20flame/product%20photo%20home%20page%20.png",
    cat3: "product%20photo/liquid%20eternal/product%203.png",
    cat4: "product%20photo/unique%20art%20vessel/product%204.png",
    cat5: "product%20photo/Ni%20Terra/product%20photo.png",
    cat6: "home%20page%20photo/home%20collection.png",
    cat7: "home%20page%20photo/home%20collection.png",
    cat8: "home%20page%20photo/home%20collection.png",
  };

  var CAT_HERO_META = {
    cat1: { fit: "cover", position: "center 38%" },
    cat2: { fit: "cover", position: "center center" },
    cat3: { fit: "cover", position: "center 45%" },
    cat4: { fit: "contain", position: "center center" },
    cat5: { fit: "cover", position: "center 45%" },
    cat6: { fit: "cover", position: "center center" },
    cat7: { fit: "cover", position: "center center" },
    cat8: { fit: "cover", position: "center center" },
  };

  var categoriesEl;
  var productsEl;
  var productsGridEl;
  var productsTitleEl;
  var productsCountEl;
  var heroImgEl;
  var heroWrapEl;
  var heroZoomEl;
  var backBtn;
  var productsLeadEl;
  var sortEl;
  var searchEl;
  var activeCategory = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function getCategoryButtons() {
    return document.querySelectorAll(".collection-card--category .collection-card__open");
  }

  function buildProductKey(catId, index, field) {
    return "collection_" + catId + "_prod" + index + "_" + field;
  }

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getLeadKey(catId) {
    if (catId === "cat5") return "collection_lead_cat5";
    if (catId === "cat6") return "collection_lead_cat6";
    if (catId === "cat7") return "collection_lead_cat7";
    if (catId === "cat8") return "collection_lead_cat8";
    return "collection_catalog_lead";
  }

  function updateLead(catId) {
    if (!productsLeadEl) return;
    productsLeadEl.textContent = t(getLeadKey(catId));
  }

  function applyHeroMeta(catId) {
    var meta = CAT_HERO_META[catId] || { fit: "cover", position: "center center" };
    if (heroWrapEl) {
      heroWrapEl.classList.toggle("collection-catalog__hero--contain", meta.fit === "contain");
    }
    if (heroImgEl) {
      heroImgEl.style.objectPosition = meta.position;
    }
  }

  function restartHeroAnimation() {
    if (!heroZoomEl) return;
    heroZoomEl.classList.remove("is-animating");
    void heroZoomEl.offsetWidth;
    heroZoomEl.classList.add("is-animating");
  }

  function updateCategoryHero(catId) {
    if (!heroImgEl || !CAT_HERO[catId]) return;
    var src = CAT_HERO[catId];
    var label = t("collection_" + catId);
    applyHeroMeta(catId);

    function reveal() {
      heroImgEl.src = src;
      heroImgEl.alt = label;
      if (window.NostalgiaImages && typeof window.NostalgiaImages.upgrade === "function") {
        window.NostalgiaImages.upgrade(heroImgEl, {
          priority: true,
          sizes: "100vw",
        });
        heroImgEl = document.getElementById("collection-catalog-hero-img");
      }
      if (heroWrapEl) {
        heroWrapEl.setAttribute("data-hero-cat", catId);
      }
      restartHeroAnimation();
    }

    if (heroImgEl.getAttribute("src") === src) {
      heroImgEl.alt = label;
      restartHeroAnimation();
      return;
    }

    var preload = new Image();
    preload.onload = reveal;
    preload.onerror = reveal;
    preload.src = src;
    if (preload.complete) reveal();
  }

  function renderProducts(catId) {
    if (!productsGridEl) return;
    productsGridEl.innerHTML = "";
    var images = (window.NostalgiaProducts && window.NostalgiaProducts.CAT_IMAGES[catId]) || [];
    var products = [];

    for (var i = 1; i <= images.length; i++) {
      products.push({
        id: catId + "-" + i,
        catId: catId,
        index: i,
        image: images[i - 1],
        title: window.NostalgiaProducts
          ? window.NostalgiaProducts.getTitle(catId, i)
          : t("collection_" + catId) + " · " + i,
      });
    }

    products = applyFilters(products);

    if (productsCountEl) {
      productsCountEl.textContent = t("collection_items_count").replace("{n}", String(products.length));
    }

    if (!products.length) {
      var empty = document.createElement("section");
      empty.className = "collection-coming";
      empty.setAttribute("role", "listitem");

      var eyebrow = document.createElement("p");
      eyebrow.className = "collection-coming__eyebrow";
      eyebrow.textContent = t("coming_soon");

      var title = document.createElement("h3");
      title.className = "collection-coming__title";
      title.textContent = t("collection_" + catId);

      var lead = document.createElement("p");
      lead.className = "collection-coming__lead";
      lead.textContent = t("collection_no_results");

      empty.appendChild(eyebrow);
      empty.appendChild(title);
      empty.appendChild(lead);
      productsGridEl.appendChild(empty);
      return;
    }

    products.forEach(function (item, i) {
      var productId = item.id;
      var titleText = item.title;
      var productUrl = window.NostalgiaProducts
        ? window.NostalgiaProducts.getProductUrl(productId)
        : "product.html?id=" + encodeURIComponent(productId);

      var article = document.createElement("article");
      article.className = "collection-product site-reveal site-reveal--d" + ((i % 4) + 1);
      article.setAttribute("data-category", catId);
      article.setAttribute("data-product-id", productId);
      article.setAttribute("data-reveal-tagged", "1");
      article.setAttribute("role", "listitem");

      var link = document.createElement("a");
      link.className = "collection-product__link";
      link.setAttribute("data-polish-no-transition", "1");
      link.href = productUrl;
      link.setAttribute("aria-label", titleText);

      var visual = document.createElement("div");
      visual.className = "collection-product__visual";

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
      link.appendChild(visual);
      link.appendChild(meta);
      article.appendChild(link);

      var quickBtn = document.createElement("button");
      quickBtn.type = "button";
      quickBtn.className = "collection-product__quick";
      quickBtn.setAttribute("data-quick-view", productId);
      quickBtn.setAttribute("data-i18n", "product_quick_view");
      quickBtn.textContent = t("product_quick_view");
      article.appendChild(quickBtn);

      productsGridEl.appendChild(article);
    });

    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.refreshReveal === "function") {
      window.NostalgiaPolish.refreshReveal();
    }
  }

  function showProducts(catId) {
    activeCategory = catId;
    document.body.classList.add("collection-products-open");
    if (categoriesEl) {
      categoriesEl.hidden = true;
      categoriesEl.setAttribute("aria-hidden", "true");
    }
    if (productsEl) {
      productsEl.hidden = false;
      productsEl.setAttribute("aria-hidden", "false");
    }
    if (productsTitleEl) {
      productsTitleEl.textContent = t("collection_" + catId);
      productsTitleEl.setAttribute("data-active-cat", catId);
    }
    updateLead(catId);
    updateCategoryHero(catId);
    renderProducts(catId);
    if (window.NostalgiaBreadcrumbs) {
      window.NostalgiaBreadcrumbs.refresh();
    } else {
      window.setTimeout(function () {
        if (window.NostalgiaBreadcrumbs) window.NostalgiaBreadcrumbs.refresh();
      }, 0);
    }
    try {
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search + "#" + catId);
      } else {
        location.hash = catId;
      }
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCategories(opts) {
    opts = opts || {};
    document.body.classList.remove("collection-products-open");
    if (categoriesEl) {
      categoriesEl.hidden = false;
      categoriesEl.setAttribute("aria-hidden", "false");
    }
    if (productsEl) {
      productsEl.hidden = true;
      productsEl.setAttribute("aria-hidden", "true");
    }
    if (productsTitleEl) {
      productsTitleEl.textContent = "";
      productsTitleEl.removeAttribute("data-active-cat");
    }
    if (!opts.keepHash) {
      try {
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search);
        } else {
          location.hash = "";
        }
      } catch (e) {}
    }
    if (window.NostalgiaBreadcrumbs) window.NostalgiaBreadcrumbs.refresh();
  }

  function onHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (CAT_IDS.indexOf(h) !== -1) {
      showProducts(h);
    } else if (h.indexOf("story-cat") === 0) {
      showCategories({ keepHash: true });
      var storyTarget = document.getElementById(h);
      if (storyTarget) {
        storyTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      showCategories();
    }
  }

  function bind() {
    categoriesEl = $("#collection-categories");
    productsEl = $("#collection-products");
    productsGridEl = $("#collection-products-grid");
    productsTitleEl = $("#collection-products-title");
    productsCountEl = $("#collection-products-count");
    productsLeadEl = document.querySelector(".collection-catalog__lead");
    heroImgEl = $("#collection-catalog-hero-img");
    heroWrapEl = $("#collection-catalog-hero");
    heroZoomEl = $("#collection-catalog-hero-zoom");
    backBtn = $("#collection-back");
    sortEl = $("#collection-sort");
    searchEl = $("#collection-search");

    getCategoryButtons().forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-category");
        if (!cat) return;
        showProducts(cat);
      });
    });

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        showCategories();
      });
    }

    if (sortEl) {
      sortEl.addEventListener("change", function () {
        if (activeCategory) renderProducts(activeCategory);
      });
    }

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        if (activeCategory) renderProducts(activeCategory);
      });
    }

    window.addEventListener("hashchange", onHash);

    document.addEventListener(
      "click",
      function (e) {
        var quickBtn = e.target.closest("[data-quick-view]");
        if (quickBtn) {
          e.preventDefault();
          e.stopPropagation();
          openQuickViewForProduct(quickBtn.getAttribute("data-quick-view"));
          return;
        }
        var productLink = e.target.closest(".collection-product__link");
        if (productLink) {
          clearNavUiLock();
        }
      },
      true
    );

    window.NostalgiaOnLangApplied = function () {
      var active = productsTitleEl && productsTitleEl.getAttribute("data-active-cat");
      if (active && productsEl && !productsEl.hidden) {
        productsTitleEl.textContent = t("collection_" + active);
        updateLead(active);
        updateCategoryHero(active);
        if (window.NostalgiaBreadcrumbs) window.NostalgiaBreadcrumbs.refresh();
        renderProducts(active);
      }
    };

    onHash();
  }

  function clearNavUiLock() {
    document.documentElement.classList.remove("page-is-leaving", "page-is-entering");
    document.body.classList.remove("has-quick-view-open");
    document.body.style.overflow = "";
    var qv = document.querySelector(".quick-view.is-open");
    if (qv) {
      qv.classList.remove("is-open");
      qv.setAttribute("aria-hidden", "true");
    }
    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.closeQuickView === "function") {
      window.NostalgiaPolish.closeQuickView();
    }
  }

  function openQuickViewForProduct(id) {
    if (!id) return;
    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.openQuickView === "function") {
      window.NostalgiaPolish.openQuickView(id);
      return;
    }
    var tries = 0;
    (function retry() {
      if (window.NostalgiaPolish && typeof window.NostalgiaPolish.openQuickView === "function") {
        window.NostalgiaPolish.openQuickView(id);
        return;
      }
      if (++tries < 60) {
        window.setTimeout(retry, 50);
        return;
      }
      if (window.NostalgiaProducts && typeof window.NostalgiaProducts.getProductUrl === "function") {
        window.location.href = window.NostalgiaProducts.getProductUrl(id);
      }
    })();
  }

  function applyFilters(list) {
    var out = list.slice();
    var sortVal = sortEl ? sortEl.value : "featured";
    var q = searchEl ? searchEl.value.trim().toLowerCase() : "";

    if (q) {
      out = out.filter(function (item) {
        return item.title.toLowerCase().indexOf(q) !== -1;
      });
    }

    if (sortVal === "name-asc") {
      out.sort(function (a, b) { return a.title.localeCompare(b.title); });
    } else {
      out.sort(function (a, b) { return a.index - b.index; });
    }

    return out;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
