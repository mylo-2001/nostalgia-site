(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7", "cat8"];
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
    privacy: ["privacy_title"],
    terms: ["footer_terms"],
    journal: ["footer_journal"],
  };

  var LINK_KEYS = {
    nav_collection: "collection.html",
    nav_about: "about.html",
    nav_contact: "contact.html",
    cart_heading: "cart.html",
    footer_faq: "faq.html",
    payments_heading: "payments.html",
    shipping_heading: "shipping-returns.html",
    privacy_title: "privacy.html",
    footer_terms: "terms.html",
    footer_journal: "journal.html",
    wishlist_heading: "wishlist.html",
    account_my_account: "account.html",
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
      if (CAT_IDS.indexOf(cat) !== -1) return "collection.html#" + cat;
    }
    return null;
  }

  function buildFromKeys(keys) {
    var items = [{ labelKey: "nav_home", href: "index.html" }];
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
      { labelKey: "nav_home", href: "index.html" },
      { labelKey: "nav_collection", href: "collection.html" },
    ];

    if (product && product.catId) {
      items.push({
        labelKey: "collection_" + product.catId,
        href: "collection.html#" + product.catId,
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

  function getBreadcrumbMount() {
    var main = document.querySelector("main");
    if (!main) return null;
    var page = document.body && document.body.getAttribute("data-page");

    if (page === "account") {
      var panel = main.querySelector(".account-page__panel");
      if (panel) return panel;
    }

    if (page === "product") {
      var productRoot = document.getElementById("product-page-root");
      if (productRoot) return productRoot;
    }

    if (page === "collection") {
      if (document.body.classList.contains("collection-products-open")) {
        var catalogInner = document.querySelector(".collection-catalog__inner");
        if (catalogInner) return catalogInner;
      }
      var section = main.querySelector(".collection-section");
      if (section) return section;
    }

    if (page === "contact") {
      var contactSection = main.querySelector(".contact-section");
      if (contactSection) return contactSection;
    }

    var legalPage = main.querySelector(".legal-page");
    if (legalPage) return legalPage;

    return main;
  }

  function syncBreadcrumbPlacement() {
    if (!navEl) return;
    var mount = getBreadcrumbMount();
    if (!mount) return;

    var inCatalog = mount.classList && mount.classList.contains("collection-catalog__inner");
    navEl.classList.toggle("site-breadcrumb--catalog", inCatalog);

    if (navEl.parentNode !== mount) {
      mount.insertBefore(navEl, mount.firstChild);
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
