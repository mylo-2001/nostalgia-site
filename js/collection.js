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

  var categoriesEl;
  var productsEl;
  var productsGridEl;
  var productsTitleEl;
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

  function renderProducts(catId) {
    if (!productsGridEl) return;
    productsGridEl.innerHTML = "";
    var images = (window.NostalgiaProducts && window.NostalgiaProducts.CAT_IMAGES[catId]) || [];
    for (var i = 1; i <= images.length; i++) {
      var productId = catId + "-" + i;
      var titleText = window.NostalgiaProducts
        ? window.NostalgiaProducts.getTitle(catId, i)
        : t("collection_" + catId) + " · " + i;
      var productUrl = window.NostalgiaProducts
        ? window.NostalgiaProducts.getProductUrl(productId)
        : "product.html?id=" + encodeURIComponent(productId);

      var article = document.createElement("article");
      article.className = "collection-card collection-card--product";
      article.setAttribute("data-category", catId);
      article.setAttribute("data-product-id", productId);
      article.setAttribute("role", "listitem");
      article.setAttribute("aria-label", titleText);

      var visual = document.createElement("a");
      visual.className = "collection-card__visual collection-card__visual--link";
      visual.href = productUrl;
      visual.setAttribute("aria-hidden", "true");
      visual.tabIndex = -1;

      var img = document.createElement("img");
      img.src = images[i - 1];
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      visual.appendChild(img);

      var copy = document.createElement("div");
      copy.className = "collection-card__copy collection-card__copy--product";

      var titleLink = document.createElement("a");
      titleLink.className = "collection-card__title collection-card__title--link";
      titleLink.href = productUrl;
      titleLink.textContent = titleText;
      copy.appendChild(titleLink);

      var footer = document.createElement("div");
      footer.className = "collection-card__footer collection-card__footer--shop";

      var viewBtn = document.createElement("a");
      viewBtn.className = "btn-ghost btn-ghost--select";
      viewBtn.href = productUrl;
      viewBtn.textContent = t("product_view");

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-shop btn-shop--primary collection-card__add";
      addBtn.setAttribute("data-add-cart", productId);
      addBtn.textContent = t("product_add_cart");

      footer.appendChild(viewBtn);
      footer.appendChild(addBtn);
      copy.appendChild(footer);
      article.appendChild(visual);
      article.appendChild(copy);
      productsGridEl.appendChild(article);
    }

    productsGridEl.querySelectorAll("[data-add-cart]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-add-cart");
        if (window.NostalgiaCart) {
          window.NostalgiaCart.addAndNotify(id, 1);
        }
      });
    });
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
