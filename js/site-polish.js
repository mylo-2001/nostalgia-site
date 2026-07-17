(function () {
  var REVEAL_SEL = ".home-reveal, .site-reveal";
  var revealObserver = null;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function revealAll() {
    document.querySelectorAll(REVEAL_SEL).forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  function observeRevealElements(nodes) {
    if (!revealObserver) return;
    (nodes || document.querySelectorAll(REVEAL_SEL)).forEach(function (el) {
      if (!el.classList.contains("is-visible")) {
        revealObserver.observe(el);
      }
    });
  }

  function initReveal() {
    if (prefersReducedMotion()) {
      revealAll();
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: [0, 0.06, 0.12], rootMargin: "0px 0px -2% 0px" }
    );

    observeRevealElements();
  }

  function autoTagReveal() {
    var tags = [
      { sel: "main > .page-intro", cls: ["site-reveal"] },
      { sel: ".legal-page .legal-content > h2", cls: ["site-reveal"] },
      { sel: ".legal-page .legal-content > p", cls: ["site-reveal"] },
      { sel: ".legal-page .faq-group", cls: ["site-reveal"] },
      { sel: ".legal-page .legal-section", cls: ["site-reveal"] },
      { sel: ".cart-page", cls: ["site-reveal"] },
      { sel: ".cart-item", cls: ["site-reveal"] },
      { sel: ".wishlist-page__head", cls: ["site-reveal"] },
      { sel: ".wishlist-card", cls: ["site-reveal"] },
      { sel: ".checkout-page__layout", cls: ["site-reveal"] },
      { sel: ".checkout-step", cls: ["site-reveal"] },
      { sel: ".about-tabs", cls: ["site-reveal"] },
      { sel: ".about-split", cls: ["site-reveal"] },
      { sel: ".contact-split", cls: ["site-reveal"] },
      { sel: ".contact-card", cls: ["site-reveal"] },
      { sel: ".contact-form-card", cls: ["site-reveal"] },
      { sel: ".site-promise", cls: ["site-reveal"] },
      { sel: ".site-follow", cls: ["site-reveal"] },
      { sel: "main > .editorial-hero", cls: ["site-reveal"] },
      { sel: ".collection-category", cls: ["site-reveal"] },
      { sel: ".collection-catalog__head", cls: ["site-reveal"] },
      { sel: ".journal-card", cls: ["site-reveal"] },
      { sel: ".home-seasonal", cls: ["site-reveal"] },
      { sel: ".home-ritual", cls: ["site-reveal"] },
      { sel: ".home-scent-teaser", cls: ["site-reveal"] },
      { sel: ".gift-card", cls: ["site-reveal"] },
      { sel: ".checkout-trust", cls: ["site-reveal"] },
      { sel: ".cart-empty", cls: ["site-reveal"] },
      { sel: ".wishlist-empty", cls: ["site-reveal"] },
    ];

    tags.forEach(function (tag) {
      document.querySelectorAll(tag.sel).forEach(function (el, i) {
        if (el.classList.contains("home-reveal")) return;
        tag.cls.forEach(function (c) {
          el.classList.add(c);
        });
        if (tag.cls.indexOf("site-reveal") !== -1 && !el.classList.contains("site-reveal--d1")) {
          el.classList.add("site-reveal--d" + ((i % 4) + 1));
        }
      });
    });

    observeRevealElements();
  }

  function enhanceOrnaments() {
    document.querySelectorAll(".page-intro .section-rule").forEach(function (rule) {
      var parent = rule.parentElement;
      if (!parent) return;
      if (parent.querySelector(".section-ornament")) return;
      var orn = document.createElement("span");
      orn.className = "section-ornament site-reveal";
      orn.setAttribute("aria-hidden", "true");
      parent.insertBefore(orn, rule);
    });
    observeRevealElements(document.querySelectorAll(".section-ornament.site-reveal"));
  }

  function initKenBurns() {
    document.querySelectorAll(".about-split__photo").forEach(function (wrap) {
      wrap.classList.add("hero-ken-burns");
      var img = wrap.querySelector("img");
      if (img) img.classList.add("hero-ken-burns__img");
    });

    var contactPhoto = document.querySelector(".contact-split__photo");
    if (contactPhoto) {
      contactPhoto.classList.add("hero-ken-burns");
      var cImg = contactPhoto.querySelector("img");
      if (cImg) cImg.classList.add("hero-ken-burns__img");
    }
  }

  function clearTransitionUiState() {
    document.documentElement.classList.remove("page-is-leaving", "page-is-entering");
    document.body.classList.remove("has-quick-view-open");
    document.body.style.overflow = "";
    closeQuickView();
    closeLightbox();
  }

  function initPageEnter() {
    clearTransitionUiState();
  }

  function initPageTransition() {
    window.addEventListener("pageshow", function () {
      clearTransitionUiState();
    });
  }

  function initStickyHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var threshold = document.body.classList.contains("has-side-nav") ? 6 : 28;
      header.classList.toggle("site-header--scrolled", y > threshold);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initScrollProgress() {
    var page = document.body && document.body.getAttribute("data-page");
    var legalPages = ["faq", "payments", "shipping", "privacy", "terms", "journal"];
    if (legalPages.indexOf(page) === -1) return;

    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    function update() {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var max = doc.scrollHeight - doc.clientHeight;
      var p = max > 0 ? scrollTop / max : 0;
      bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initFaqAccordion() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var p = item.querySelector("p");
      if (p && !p.parentElement.classList.contains("faq-item__body")) {
        var wrap = document.createElement("div");
        wrap.className = "faq-item__body";
        p.parentNode.insertBefore(wrap, p);
        wrap.appendChild(p);
      }

      item.addEventListener("toggle", function () {
        if (!item.open) return;
        var group = item.closest(".faq-group") || item.parentElement;
        if (!group) return;
        group.querySelectorAll(".faq-item[open]").forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  function initMicroAnimations() {
    window.addEventListener("nostalgia-cart-updated", function () {
      var badge = document.getElementById("cart-badge");
      if (badge) {
        badge.classList.remove("is-bounce");
        void badge.offsetWidth;
        badge.classList.add("is-bounce");
      }
    });

    window.addEventListener("nostalgia-wishlist-updated", function () {
      var btn = document.getElementById("product-toggle-wishlist");
      if (!btn) return;
      btn.classList.remove("is-heart-pulse");
      void btn.offsetWidth;
      btn.classList.add("is-heart-pulse");
    });

    document.addEventListener(
      "click",
      function (e) {
        var addBtn = e.target.closest("#product-add-cart, [data-wishlist-add], .wishlist-card__add");
        if (!addBtn) return;
        addBtn.classList.remove("is-glow-pulse");
        void addBtn.offsetWidth;
        addBtn.classList.add("is-glow-pulse");
      },
      true
    );
  }

  var lightboxEl = null;

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement("div");
    lightboxEl.className = "product-lightbox";
    lightboxEl.setAttribute("role", "dialog");
    lightboxEl.setAttribute("aria-modal", "true");
    lightboxEl.hidden = true;
    lightboxEl.innerHTML =
      '<button type="button" class="product-lightbox__close" aria-label="Close">×</button>' +
      '<img class="product-lightbox__img" alt="" />';
    document.body.appendChild(lightboxEl);

    lightboxEl.querySelector(".product-lightbox__close").addEventListener("click", closeLightbox);
    lightboxEl.addEventListener("click", function (e) {
      if (e.target === lightboxEl) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightboxEl.classList.contains("is-open")) closeLightbox();
    });
    return lightboxEl;
  }

  function openLightbox(src, alt) {
    var lb = ensureLightbox();
    lb.querySelector(".product-lightbox__img").src = src;
    lb.querySelector(".product-lightbox__img").alt = alt || "";
    lb.hidden = false;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove("is-open");
    lightboxEl.hidden = true;
    document.body.style.overflow = "";
  }

  function initProductLightbox() {
    if (document.body.getAttribute("data-page") !== "product") return;

    document.addEventListener("click", function (e) {
      var img = e.target.closest(".product-gallery__img");
      if (!img) return;
      e.preventDefault();
      openLightbox(img.src, img.alt);
    });

    var gallery = document.querySelector(".product-gallery");
    if (gallery && !gallery.querySelector(".product-gallery__zoom-hint")) {
      var hint = document.createElement("span");
      hint.className = "product-gallery__zoom-hint site-reveal";
      hint.setAttribute("data-i18n", "product_zoom_hint");
      hint.textContent = t("product_zoom_hint");
      gallery.appendChild(hint);
      observeRevealElements([hint]);
    }
  }

  var quickViewEl = null;

  function ensureQuickView() {
    if (quickViewEl) return quickViewEl;
    quickViewEl = document.createElement("div");
    quickViewEl.className = "quick-view";
    quickViewEl.setAttribute("role", "dialog");
    quickViewEl.setAttribute("aria-hidden", "true");
    quickViewEl.setAttribute("aria-modal", "true");
    quickViewEl.innerHTML =
      '<div class="quick-view__panel">' +
      '  <button type="button" class="quick-view__close" aria-label="Close">×</button>' +
      '  <div class="quick-view__media"><img alt="" /></div>' +
      '  <div class="quick-view__info">' +
      '    <h2 class="quick-view__title"></h2>' +
      '    <div class="quick-view__actions"></div>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(quickViewEl);

    quickViewEl.querySelector(".quick-view__close").addEventListener("click", closeQuickView);
    quickViewEl.addEventListener("click", function (e) {
      if (e.target === quickViewEl) closeQuickView();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && quickViewEl.classList.contains("is-open")) closeQuickView();
    });
    return quickViewEl;
  }

  function openQuickView(productId) {
    if (!window.NostalgiaProducts) return;
    var product = window.NostalgiaProducts.getById(productId);
    if (!product) return;

    var qv = ensureQuickView();
    var url = window.NostalgiaProducts.getProductUrl(product.id);
    var titleText =
      document.documentElement.lang === "en" && product.titleEn && String(product.titleEn).trim()
        ? product.titleEn
        : product.title;
    qv.querySelector(".quick-view__media img").src = product.image;
    qv.querySelector(".quick-view__media img").alt = titleText;
    qv.querySelector(".quick-view__title").textContent = titleText;

    var actions = qv.querySelector(".quick-view__actions");
    actions.innerHTML =
      '<a class="btn-shop btn-shop--primary" href="' +
      url +
      '" data-i18n="product_view_details">' +
      escapeHtml(t("product_view_details")) +
      "</a>" +
      '<button type="button" class="btn-shop btn-shop--ghost" data-quick-add="' +
      escapeHtml(product.id) +
      '" data-i18n="product_add_cart">' +
      escapeHtml(t("product_add_cart")) +
      "</button>";

    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }

    actions.querySelector("[data-quick-add]").addEventListener("click", function () {
      if (window.NostalgiaCart) window.NostalgiaCart.addAndNotify(product.id, 1);
      var btn = actions.querySelector("[data-quick-add]");
      btn.classList.remove("is-glow-pulse");
      void btn.offsetWidth;
      btn.classList.add("is-glow-pulse");
    });

    var detailsLink = actions.querySelector("a[href]");
    if (detailsLink) {
      detailsLink.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var target = detailsLink.getAttribute("href");
        closeQuickView();
        clearTransitionUiState();
        if (target) window.location.href = target;
      });
    }

    qv.removeAttribute("hidden");
    qv.setAttribute("aria-hidden", "false");
    qv.classList.add("is-open");
    document.body.classList.add("has-quick-view-open");
    document.body.style.overflow = "hidden";
  }

  function closeQuickView() {
    if (!quickViewEl) return;
    quickViewEl.classList.remove("is-open");
    quickViewEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-quick-view-open");
    document.body.style.overflow = "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initQuickViewDelegation() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-quick-view]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute("data-quick-view");
      if (id) openQuickView(id);
    });
  }

  function watchDynamicGrids() {
    var grid = document.getElementById("collection-products-grid");
    if (!grid || typeof MutationObserver === "undefined") return;

    var mo = new MutationObserver(function () {
      grid.querySelectorAll(".collection-product:not([data-reveal-tagged])").forEach(function (el, i) {
        el.setAttribute("data-reveal-tagged", "1");
        el.classList.add("site-reveal", "site-reveal--d" + ((i % 4) + 1));
        observeRevealElements([el]);
      });
    });
    mo.observe(grid, { childList: true });
  }

  function init() {
    initPageEnter();
    initReveal();
    autoTagReveal();
    enhanceOrnaments();
    initKenBurns();
    initPageTransition();
    initStickyHeader();
    initScrollProgress();
    initFaqAccordion();
    initMicroAnimations();
    initProductLightbox();
    watchDynamicGrids();

    window.NostalgiaPolish.refreshReveal = function () {
      autoTagReveal();
      observeRevealElements();
    };
  }

  window.NostalgiaPolish = window.NostalgiaPolish || {};
  window.NostalgiaPolish.openQuickView = openQuickView;
  window.NostalgiaPolish.closeQuickView = closeQuickView;
  window.NostalgiaPolish.clearUiState = clearTransitionUiState;

  initQuickViewDelegation();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("pageshow", clearTransitionUiState);
})();
