(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7", "cat8", "cat9"];
  var customTrail = null;
  var navEl = null;

  var PAGE_TRAILS = {
    about: ["nav_about"],
    contact: ["nav_contact"],
    cart: ["cart_heading"],
    checkout: ["cart_heading", "checkout_breadcrumb"],
    wishlist: ["wishlist_heading"],
    account: ["account_my_account"],
    faq: ["footer_faq"],
    payments: ["payments_heading"],
    shipping: ["shipping_heading"],
    "how-it-works": ["of_heading"],
    privacy: ["privacy_title"],
    terms: ["footer_terms"],
    journal: ["footer_journal"],
    reviews: ["reviews_page_title"],
    review: ["reviews_page_title", "reviews_single_hero"],
    "scent-finder": ["scent_finder_title"],
    gift: ["nav_gift"],
    seasonal: ["seasonal_title"],
  };

  var LINK_KEYS = {
    nav_collection: "/collection",
    nav_about: "/about",
    nav_contact: "/contact",
    cart_heading: "/cart",
    footer_faq: "/faq",
    payments_heading: "/payments",
    shipping_heading: "/shipping-returns",
    of_heading: "/how-it-works",
    privacy_title: "/privacy",
    footer_terms: "/terms",
    footer_journal: "/journal",
    wishlist_heading: "/wishlist",
    account_my_account: "/account",
    reviews_page_title: "/reviews",
    scent_finder_title: "/scent-finder",
  };

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function hrefForKey(key) {
    if (LINK_KEYS[key]) return LINK_KEYS[key];
    if (key.indexOf("collection_") === 0 && key !== "collection_heading") {
      var cat = key.replace("collection_", "");
      if (CAT_IDS.indexOf(cat) !== -1) return "/collection#" + cat;
    }
    return null;
  }

  function buildFromKeys(keys) {
    var items = [{ labelKey: "nav_home", href: "/" }];
    keys.forEach(function (key, index) {
      var isLast = index === keys.length - 1;
      items.push({
        labelKey: key,
        href: isLast ? null : hrefForKey(key),
      });
    });
    return items;
  }

  function getCollectionTrail() {
    var hash = (location.hash || "").replace(/^#/, "");
    if (CAT_IDS.indexOf(hash) !== -1) {
      return buildFromKeys(["nav_collection", "collection_" + hash]);
    }
    return buildFromKeys(["nav_collection"]);
  }

  function getProductTrailFromPage() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "";
    if (!id) return null;

    var product = null;
    if (window.NostalgiaProducts && typeof window.NostalgiaProducts.getById === "function") {
      product = window.NostalgiaProducts.getById(id);
    }

    var items = [
      { labelKey: "nav_home", href: "/" },
      { labelKey: "nav_collection", href: "/collection" },
    ];

    if (product && product.catId) {
      items.push({
        labelKey: "collection_" + product.catId,
        href: "/collection#" + product.catId,
      });
      items.push({ text: product.title || id, href: null });
    } else {
      items.push({ text: id, href: null });
    }

    return items;
  }

  function getDefaultTrail() {
    var page = document.body && document.body.getAttribute("data-page");
    if (!page || page === "home") return null;
    if (page === "collection") return getCollectionTrail();
    if (page === "product") return getProductTrailFromPage();
    if (page === "showcase") {
      /* sale and new-arrivals share data-page="showcase" — tell them apart by path. */
      return buildFromKeys(
        (location.pathname || "").indexOf("sale") !== -1
          ? ["nav_sale"]
          : ["nav_new_arrivals"]
      );
    }
    var keys = PAGE_TRAILS[page];
    if (!keys) return null;
    return buildFromKeys(keys);
  }

  function labelForItem(item) {
    if (item.text) return item.text;
    if (item.labelKey) return t(item.labelKey);
    return "";
  }

  function renderTrail(trail) {
    if (!navEl && !ensureNav()) return;

    if (!trail || trail.length < 2) {
      navEl.setAttribute("hidden", "");
      navEl.innerHTML = "";
      return;
    }

    navEl.removeAttribute("hidden");
    var html = "";
    trail.forEach(function (item, index) {
      if (index > 0) {
        html += '<span class="site-breadcrumb__sep" aria-hidden="true">›</span>';
      }
      var label = labelForItem(item);
      var href = item.href;
      if (href && index < trail.length - 1) {
        html += '<a href="' + href + '">' + escapeHtml(label) + "</a>";
      } else {
        html += '<span class="site-breadcrumb__current">' + escapeHtml(label) + "</span>";
      }
    });
    navEl.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function removeLegacyBreadcrumbs() {
    document.querySelectorAll(".legal-breadcrumb, .collection-breadcrumb").forEach(function (el) {
      el.remove();
    });
  }

  /* First full-width hero block directly under <main> (any *-hero section). */
  function findPageHero(main) {
    if (!main) return null;

    var known = main.querySelector(":scope > .editorial-hero, :scope > .gift-hero");
    if (known) return known;

    var child = main.firstElementChild;
    while (child) {
      if (child.id === "site-breadcrumb") {
        child = child.nextElementSibling;
        continue;
      }
      if (child.tagName === "SECTION") {
        var cls = child.className || "";
        if (/(^|\s)([a-z0-9-]*hero[a-z0-9-]*)(\s|$)/i.test(cls)) return child;
      }
      child = child.nextElementSibling;
    }

    return null;
  }

  function placementAfterHero(main) {
    var hero = findPageHero(main);
    if (!hero || !hero.parentNode) return null;
    return { parent: hero.parentNode, before: hero.nextSibling };
  }

  /* Returns { parent, before, catalog } describing exactly where the breadcrumb
     nav should live. The title now sits ON the hero image, so the breadcrumb is
     placed BELOW the hero (as a sibling in <main>), never on the overlay. */
  function getBreadcrumbPlacement() {
    var main = document.querySelector("main");
    if (!main) return null;
    var page = document.body && document.body.getAttribute("data-page");

    if (page === "account") {
      var panel = main.querySelector(".account-page__panel");
      if (panel) return { parent: panel, before: panel.firstChild };
    }

    if (page === "product") {
      var productRoot = document.getElementById("product-page-root");
      if (productRoot) return { parent: productRoot, before: productRoot.firstChild };
    }

    if (page === "collection" && document.body.classList.contains("collection-products-open")) {
      var catalogInner = document.querySelector(".collection-catalog__inner");
      if (catalogInner) return { parent: catalogInner, before: catalogInner.firstChild, catalog: true };
    }

    if (page === "contact") {
      var contactSection = main.querySelector(".contact-section");
      if (contactSection) return { parent: contactSection, before: contactSection.firstChild };
    }

    var afterHero = placementAfterHero(main);
    if (afterHero) return afterHero;

    if (page === "collection") {
      var section = main.querySelector(".collection-section");
      if (section) return { parent: section, before: section.firstChild };
    }

    var legalPage = main.querySelector(".legal-page");
    if (legalPage) return { parent: legalPage, before: legalPage.firstChild };

    return { parent: main, before: main.firstChild };
  }

  function getBreadcrumbMount() {
    var placement = getBreadcrumbPlacement();
    return placement ? placement.parent : null;
  }

  function syncBreadcrumbPlacement() {
    if (!navEl) return;
    var placement = getBreadcrumbPlacement();
    if (!placement || !placement.parent) return;

    navEl.classList.toggle("site-breadcrumb--catalog", !!placement.catalog);

    /* Already sitting exactly where it should. */
    if (placement.before === navEl) return;
    if (navEl.parentNode !== placement.parent || navEl.nextSibling !== placement.before) {
      placement.parent.insertBefore(navEl, placement.before || null);
    }
  }

  function ensureNav() {
    var mount = getBreadcrumbMount();
    if (!mount) return null;

    navEl = document.getElementById("site-breadcrumb");
    if (!navEl) {
      navEl = document.createElement("nav");
      navEl.id = "site-breadcrumb";
      navEl.className = "site-breadcrumb";
      navEl.setAttribute("aria-label", "Breadcrumb");
      navEl.setAttribute("data-i18n-aria", "breadcrumb_aria");
    }

    syncBreadcrumbPlacement();
    return navEl;
  }

  function refresh() {
    ensureNav();
    if (customTrail) {
      renderTrail(customTrail);
      return;
    }
    renderTrail(getDefaultTrail());
  }

  function update(trail) {
    customTrail = trail;
    refresh();
  }

  function reset() {
    customTrail = null;
    refresh();
  }

  function init() {
    removeLegacyBreadcrumbs();
    ensureNav();
    refresh();

    window.addEventListener("hashchange", function () {
      if (document.body.getAttribute("data-page") === "collection" && !customTrail) {
        syncBreadcrumbPlacement();
        refresh();
      }
    });

    window.addEventListener("load", refresh);

    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        refresh();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaBreadcrumbs = {
    refresh: refresh,
    update: update,
    reset: reset,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
