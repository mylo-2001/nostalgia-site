(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4"];

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
  };

  var CAT_HERO_META = {
    cat1: { fit: "cover", position: "center 38%" },
    cat2: { fit: "cover", position: "center center" },
    cat3: { fit: "cover", position: "center 45%" },
    cat4: { fit: "contain", position: "center center" },
  };

  var categoriesEl;
  var productsEl;
  var productsGridEl;
  var productsTitleEl;
  var productsCountEl;
  var breadcrumbCurrentEl;
  var heroImgEl;
  var heroWrapEl;
  var heroZoomEl;
  var backBtn;

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

    if (productsCountEl) {
      productsCountEl.textContent = t("collection_items_count").replace("{n}", String(images.length));
    }

    for (var i = 1; i <= images.length; i++) {
      var productId = catId + "-" + i;
      var titleText = window.NostalgiaProducts
        ? window.NostalgiaProducts.getTitle(catId, i)
        : t("collection_" + catId) + " · " + i;
      var productUrl = window.NostalgiaProducts
        ? window.NostalgiaProducts.getProductUrl(productId)
        : "product.html?id=" + encodeURIComponent(productId);

      var article = document.createElement("article");
      article.className = "collection-product";
      article.setAttribute("data-category", catId);
      article.setAttribute("data-product-id", productId);
      article.setAttribute("role", "listitem");

      var link = document.createElement("a");
      link.className = "collection-product__link";
      link.href = productUrl;
      link.setAttribute("aria-label", titleText);

      var visual = document.createElement("div");
      visual.className = "collection-product__visual";

      var img = document.createElement("img");
      img.src = images[i - 1];
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      visual.appendChild(img);

      var meta = document.createElement("div");
      meta.className = "collection-product__meta";

      var name = document.createElement("h3");
      name.className = "collection-product__name";
      name.textContent = titleText;

      meta.appendChild(name);
      link.appendChild(visual);
      link.appendChild(meta);
      article.appendChild(link);
      productsGridEl.appendChild(article);
    }
  }

  function showProducts(catId) {
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
    if (breadcrumbCurrentEl) {
      breadcrumbCurrentEl.textContent = t("collection_" + catId);
    }
    updateCategoryHero(catId);
    renderProducts(catId);
    try {
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search + "#" + catId);
      } else {
        location.hash = catId;
      }
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCategories() {
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
    try {
      if (history.replaceState) {
        history.replaceState(null, "", location.pathname + location.search);
      } else {
        location.hash = "";
      }
    } catch (e) {}
  }

  function onHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (CAT_IDS.indexOf(h) !== -1) {
      showProducts(h);
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
    breadcrumbCurrentEl = $("#collection-breadcrumb-current");
    heroImgEl = $("#collection-catalog-hero-img");
    heroWrapEl = $("#collection-catalog-hero");
    heroZoomEl = $("#collection-catalog-hero-zoom");
    backBtn = $("#collection-back");

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

    window.addEventListener("hashchange", onHash);

    window.NostalgiaOnLangApplied = function () {
      var active = productsTitleEl && productsTitleEl.getAttribute("data-active-cat");
      if (active && productsEl && !productsEl.hidden) {
        productsTitleEl.textContent = t("collection_" + active);
        if (breadcrumbCurrentEl) breadcrumbCurrentEl.textContent = t("collection_" + active);
        updateCategoryHero(active);
        renderProducts(active);
      }
    };

    onHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
