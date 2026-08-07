(function () {
  /**
   * Home "Best sellers" strip.
   *
   * Ranking source, in order of preference:
   *   1. Real monthly sales from the backend (GET /api/products/bestsellers) —
   *      the products most people actually bought THIS calendar month. This is
   *      what shows in production; it resets automatically each month.
   *   2. A curated list the owner can pin (window.NostalgiaBestSellers = ["catN-i", ...]).
   *   3. Auto fallback: priced, in-stock products — so the section still looks
   *      right before any orders exist (which is the case right now).
   *
   * Each card shows price, availability (so nobody orders a sold-out item) and a
   * quick "add to cart" button, plus links through to the product page.
   */

  var LIMIT = 5;
  var gridEl;
  var sectionEl;
  var bestSellerIds = null; // filled from the backend once fetched

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function money(value) {
    return "€" + Number(value).toFixed(2);
  }

  function isOutOfStock(p) {
    return p.stock === 0;
  }

  function availability(p) {
    if (isOutOfStock(p)) return { text: t("bs_out_of_stock"), cls: "is-out" };
    if (typeof p.stock === "number" && p.stock > 0 && p.stock <= 5) {
      return { text: t("bs_low_stock").replace("{n}", String(p.stock)), cls: "is-low" };
    }
    return { text: t("bs_in_stock"), cls: "is-in" };
  }

  /* Choose which products to show: real best sellers first, then fill. Every
     product shown here is treated as a best seller, so all cards get the badge. */
  function pickProducts() {
    var P = window.NostalgiaProducts;
    if (!P) return [];
    var all = P.getAll();
    var chosen = [];
    var seen = {};

    function add(p) {
      if (p && !seen[p.id]) {
        chosen.push(p);
        seen[p.id] = true;
      }
    }

    (bestSellerIds || []).forEach(function (id) { add(P.getById(id)); });

    var curated = Array.isArray(window.NostalgiaBestSellers) ? window.NostalgiaBestSellers : [];
    curated.forEach(function (id) { if (chosen.length < LIMIT) add(P.getById(id)); });

    // fill with priced, in-stock products
    all.forEach(function (p) {
      if (chosen.length < LIMIT && p.price != null && !isOutOfStock(p)) add(p);
    });
    // last resort: any remaining product, so the layout is never half-empty
    all.forEach(function (p) {
      if (chosen.length < LIMIT) add(p);
    });

    return chosen.slice(0, LIMIT);
  }

  /* A short "top notes" line, derived from the product's scent family so every
     card reads like the fragrance cards on the collection pages. The bs_notes_*
     strings live in the home i18n bundle (the only one loaded on this page). */
  function scentLine(p) {
    var s = p && p.scent;
    if (!s) return "";
    var group = s.family || s.temp;
    if (!group) return "";
    var raw = t("bs_notes_" + group);
    return raw && raw !== "bs_notes_" + group ? raw : "";
  }

  function buildImage(p) {
    if (window.NostalgiaImages && typeof window.NostalgiaImages.create === "function") {
      return window.NostalgiaImages.create(p.image, {
        alt: "",
        loading: "lazy",
        sizes: "(max-width: 640px) 50vw, 240px",
      });
    }
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  function buildPrice(p) {
    var wrap = document.createElement("p");
    wrap.className = "bestseller-card__price";
    var onSale = window.NostalgiaProducts && window.NostalgiaProducts.isOnSale(p);
    if (onSale) {
      var was = document.createElement("span");
      was.className = "bestseller-card__was";
      was.textContent = money(p.price);
      var now = document.createElement("span");
      now.className = "bestseller-card__now";
      now.textContent = money(p.salePrice);
      wrap.appendChild(was);
      wrap.appendChild(now);
    } else if (p.price != null) {
      wrap.textContent = money(p.price);
    } else {
      wrap.className += " bestseller-card__price--ask";
      wrap.textContent = t("bs_price_ask");
    }
    return wrap;
  }

  /* ♥ wishlist toggle, pinned to the top-right of the visual. */
  function buildWish(p) {
    var wished = window.NostalgiaWishlist && window.NostalgiaWishlist.has(p.id);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bestseller-card__wish";
    btn.setAttribute("data-wish-id", p.id);
    btn.setAttribute("aria-pressed", wished ? "true" : "false");
    btn.setAttribute("aria-label", t(wished ? "wishlist_remove" : "wishlist_add"));
    btn.innerHTML = "<span aria-hidden='true'>" + (wished ? "♥" : "♡") + "</span>";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.NostalgiaWishlist) window.NostalgiaWishlist.toggle(p.id, btn);
    });
    return btn;
  }

  /* Colour swatches, only when the product actually has colour variants. */
  function buildDots(p) {
    var colours = Array.isArray(p.variantGroup) ? p.variantGroup : null;
    if (!colours || colours.length < 2) return null;
    var wrap = document.createElement("span");
    wrap.className = "bestseller-card__dots";
    wrap.setAttribute("aria-hidden", "true");
    colours.slice(0, 4).forEach(function (c) {
      var dot = document.createElement("i");
      dot.style.background = c.hex || "#cccccc";
      wrap.appendChild(dot);
    });
    return wrap;
  }

  function buildCard(p, i) {
    var url = window.NostalgiaProducts
      ? window.NostalgiaProducts.getProductUrl(p.id)
      : "/product/" + encodeURIComponent(p.id);
    var avail = availability(p);
    var out = isOutOfStock(p);

    var card = document.createElement("li");
    card.className = "bestseller-card";
    card.style.setProperty("--bs-i", String(i));
    card.setAttribute("data-product-id", p.id);

    var link = document.createElement("a");
    link.className = "bestseller-card__link";
    link.href = url;
    link.setAttribute("aria-label", p.title);

    var visual = document.createElement("div");
    visual.className = "bestseller-card__visual candle-hover";

    var flags = document.createElement("div");
    flags.className = "bestseller-card__flags";
    if (window.NostalgiaProducts && window.NostalgiaProducts.isOnSale(p)) {
      var sale = document.createElement("span");
      sale.className = "bestseller-card__sale";
      sale.textContent = "-" + window.NostalgiaProducts.discountPercent(p) + "%";
      flags.appendChild(sale);
    }
    // Everything in this strip is a best seller, so every card carries the badge.
    var best = document.createElement("span");
    best.className = "bestseller-card__badge";
    best.innerHTML =
      "<span class='bestseller-card__badge-star' aria-hidden='true'>★</span>" +
      "<span>" + t("bs_badge") + "</span>";
    flags.appendChild(best);
    visual.appendChild(flags);

    visual.appendChild(buildWish(p));
    visual.appendChild(buildImage(p));

    var name = document.createElement("h3");
    name.className = "bestseller-card__name";
    name.textContent = p.title;

    link.appendChild(visual);
    link.appendChild(name);

    var notesText = scentLine(p);
    if (notesText) {
      var notes = document.createElement("p");
      notes.className = "bestseller-card__notes";
      notes.textContent = notesText;
      link.appendChild(notes);
    }

    var dots = buildDots(p);
    if (dots) link.appendChild(dots);

    var avEl = document.createElement("span");
    avEl.className = "bestseller-card__avail " + avail.cls;
    avEl.textContent = avail.text;
    link.appendChild(avEl);

    link.appendChild(buildPrice(p));

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bestseller-card__add";
    if (out) {
      btn.disabled = true;
      btn.textContent = t("bs_out_of_stock");
    } else {
      btn.textContent = t("bs_quick_add");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.NostalgiaCart && typeof window.NostalgiaCart.addAndNotify === "function") {
          window.NostalgiaCart.addAndNotify(p.id, 1);
        }
      });
    }

    card.appendChild(link);
    card.appendChild(btn);
    return card;
  }

  function render() {
    if (!gridEl || !sectionEl) return;
    var list = pickProducts();
    if (!list.length) {
      sectionEl.hidden = true;
      return;
    }
    gridEl.innerHTML = "";
    list.forEach(function (p, i) {
      gridEl.appendChild(buildCard(p, i));
    });
    sectionEl.hidden = false;
    armMarkDraw();
    if (window.NostalgiaHomeCarousels && typeof window.NostalgiaHomeCarousels.refresh === "function") {
      window.NostalgiaHomeCarousels.refresh("home-bestsellers-carousel");
    }
  }

  /* Draw the N monogram once when the strip enters the viewport. */
  var markObserver = null;
  var markDrawn = false;

  function playMarkDraw() {
    var mark = sectionEl && sectionEl.querySelector(".home-bestsellers__mark");
    if (!mark || markDrawn) return;
    markDrawn = true;
    mark.classList.remove("is-drawn");
    void mark.offsetWidth;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mark.classList.add("is-drawn");
      return;
    }
    mark.classList.add("is-drawn");
  }

  function armMarkDraw() {
    var mark = sectionEl && sectionEl.querySelector(".home-bestsellers__mark");
    if (!mark || markDrawn) return;
    if (markObserver) return;

    if (typeof IntersectionObserver === "undefined") {
      playMarkDraw();
      return;
    }

    markObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          playMarkDraw();
          if (markObserver) {
            markObserver.disconnect();
            markObserver = null;
          }
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );
    markObserver.observe(sectionEl);
  }

  /* Keep the ♥ buttons in sync when the wishlist changes elsewhere, without
     rebuilding the cards (which would replay the reveal animation). */
  function syncWishlist() {
    if (!gridEl) return;
    gridEl.querySelectorAll("[data-wish-id]").forEach(function (btn) {
      var wished = window.NostalgiaWishlist && window.NostalgiaWishlist.has(btn.getAttribute("data-wish-id"));
      btn.setAttribute("aria-pressed", wished ? "true" : "false");
      btn.setAttribute("aria-label", t(wished ? "wishlist_remove" : "wishlist_add"));
      var glyph = btn.firstChild;
      if (glyph) glyph.textContent = wished ? "♥" : "♡";
    });
  }

  function fetchBestSellers() {
    if (!window.fetch) return;
    fetch("/api/products/bestsellers", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && Array.isArray(data.items)) {
          bestSellerIds = data.items.map(function (it) { return it.id; });
          render();
        }
      })
      .catch(function () { /* offline / no backend — fallback already shown */ });
  }

  function init() {
    sectionEl = document.getElementById("home-bestsellers");
    gridEl = document.getElementById("home-bestsellers-grid");
    if (!sectionEl || !gridEl) return;

    if (!window.NostalgiaProducts) {
      document.addEventListener("nostalgia-products-updated", render, { once: true });
    } else {
      render();
    }
    document.addEventListener("nostalgia-products-updated", render);
    document.addEventListener("nostalgia-stock-updated", render);
    window.addEventListener("nostalgia-wishlist-updated", syncWishlist);

    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        render();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);

    fetchBestSellers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
