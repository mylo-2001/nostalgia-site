(function () {
  var DRAWER_ID = "side-nav";
  var activePanel = null;
  var activeVisual = "collection";
  var hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hoverLeaveTimer = null;
  var hoverOpenTimer = null;
  var triggerOpenTimer = null;
  var menuCloseTimer = null;
  var imageCache = {};
  var visibleImgIndex = 0;
  var drawerClosing = false;
  var menuPinnedOpen = false;
  var hoverMenuMq = window.matchMedia("(min-width: 901px)");

  function hoverMenuEnabled() {
    return hoverCapable && hoverMenuMq.matches;
  }

  var MENU_HOVER_DIR = "collections-hero/menu-hover-photo/";

  function menuHoverImage(filename) {
    return MENU_HOVER_DIR + filename;
  }

  function menuHoverImageWidth() {
    var visual = document.querySelector(".side-nav__visual");
    var colW = visual && visual.getBoundingClientRect().width > 0 ? visual.getBoundingClientRect().width : 320;
    var need = Math.ceil(colW * (window.devicePixelRatio || 1));
    if (need <= 520) return 480;
    if (need <= 980) return 960;
    return 1440;
  }

  function resolveVisualSrc(pngSrc, width) {
    var w = width || menuHoverImageWidth();
    if (window.NostalgiaImages && typeof window.NostalgiaImages.webp === "function") {
      return window.NostalgiaImages.webp(pngSrc, w);
    }
    var base = pngSrc.replace(/\.png$/i, "");
    return base + "-" + w + "w.webp";
  }

  var VISUALS = {
    home: {
      image: menuHoverImage("menu-arxiki-photo.png"),
      titleKey: "side_nav_visual_home_title",
      descKey: "side_nav_visual_home_desc",
      href: "/",
      ctaKey: "side_nav_discover",
    },
    collection: {
      image: menuHoverImage("collection-menu-hover-photo.png"),
      titleKey: "nav_mega_title",
      descKey: "nav_mega_desc",
      href: "/collection",
      ctaKey: "nav_mega_cta",
    },
    cat1: {
      image: menuHoverImage("Art Class Murano Candle-menu-hover.png"),
      titleKey: "collection_cat1",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat1",
      ctaKey: "side_nav_discover",
    },
    cat2: {
      image: menuHoverImage("Driftwood Beeswax Flame-menu-hover-photo.png"),
      titleKey: "collection_cat2",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat2",
      ctaKey: "side_nav_discover",
    },
    cat3: {
      image: menuHoverImage("Liquid Eternal-menu-hover-photo.png"),
      titleKey: "collection_cat3",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat3",
      ctaKey: "side_nav_discover",
    },
    cat4: {
      image: menuHoverImage("Unique Art Objects-menu-hover-photo.png"),
      titleKey: "collection_cat4",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat4",
      ctaKey: "side_nav_discover",
    },
    cat5: {
      image: menuHoverImage("NI Terra-menu-hover-photo.png"),
      titleKey: "collection_cat5",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat5",
      ctaKey: "side_nav_discover",
    },
    cat9: {
      image: "collections-hero/collection-photo/Nostalgia Exclusive Mirror Candles-photo.png",
      titleKey: "collection_cat9",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat9",
      ctaKey: "side_nav_discover",
    },
    cat6: {
      image: menuHoverImage("Perfume-menu-hover-photo.png"),
      titleKey: "collection_cat6",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat6",
      ctaKey: "side_nav_discover",
    },
    cat7: {
      image: menuHoverImage("Diffusers-menu-hover-photo.png"),
      titleKey: "collection_cat7",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat7",
      ctaKey: "side_nav_discover",
    },
    cat8: {
      image: menuHoverImage("Gift Sets-menu-hover-photo.png"),
      titleKey: "collection_cat8",
      descKey: "side_nav_visual_cat_desc",
      href: "/collection#cat8",
      ctaKey: "side_nav_discover",
    },
    about: {
      image: menuHoverImage("Σχετικά-menu-hover-photo.png"),
      titleKey: "nav_about_mega_title",
      descKey: "nav_about_mega_desc",
      href: "/about",
      ctaKey: "nav_about_mega_cta",
    },
    contact: {
      image: menuHoverImage("Επικοινωνία-menu-hover-photo.png"),
      titleKey: "side_nav_visual_contact_title",
      descKey: "side_nav_visual_contact_desc",
      href: "/contact",
      ctaKey: "nav_contact",
    },
    scent: {
      image: menuHoverImage("Εύρεση Αρώματος-menu-hover-photo.png"),
      titleKey: "nav_scent_finder",
      descKey: "nav_scent_desc",
      href: "/scent-finder",
      ctaKey: "nav_scent_cta",
    },
    gift: {
      image: menuHoverImage("Εμπειρία Δώρου-menu-hover-photo.png"),
      titleKey: "nav_gift",
      descKey: "nav_gift_desc",
      href: "/gift-experience",
      ctaKey: "nav_gift_cta",
    },
    new: {
      image: menuHoverImage("new-product-menu-hover-photo.png"),
      titleKey: "new_arrivals_title",
      descKey: "new_arrivals_lead",
      href: "/new-arrivals",
      ctaKey: "side_nav_discover",
    },
    sale: {
      image: menuHoverImage("offer-menu-hover-photo.png"),
      titleKey: "sale_title",
      descKey: "sale_lead",
      href: "/sale",
      ctaKey: "side_nav_discover",
    },
    seasonal: {
      image: menuHoverImage("Seasonal-menu-hover.png"),
      titleKey: "side_nav_visual_seasonal_title",
      descKey: "side_nav_visual_seasonal_desc",
      href: "/seasonal",
      ctaKey: "side_nav_discover",
    },
  };

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getCategoryCount(catId) {
    if (window.NostalgiaProducts) {
      if (catId === "all" && typeof window.NostalgiaProducts.getTotalCount === "function") {
        return window.NostalgiaProducts.getTotalCount();
      }
      if (typeof window.NostalgiaProducts.getCountByCategory === "function") {
        return window.NostalgiaProducts.getCountByCategory(catId);
      }
    }
    return 0;
  }

  function updateCategoryCounts() {
    document.querySelectorAll("[data-cat-count]").forEach(function (el) {
      var catId = el.getAttribute("data-cat-count");
      var count = getCategoryCount(catId);
      el.textContent = count > 0 ? " (" + count + ")" : "";
    });
  }

  function ensureStylesheet() {
    if (document.querySelector('link[href*="side-nav.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/side-nav.css?v=dark-theme";
    document.head.appendChild(link);
  }

  function buildDrawerHTML() {
    return (
      '<div class="side-nav" id="' +
      DRAWER_ID +
      '" hidden aria-hidden="true">' +
      '  <div class="side-nav__backdrop" data-side-nav-close tabindex="-1"></div>' +
      '  <div class="side-nav__drawer" role="dialog" aria-modal="true" aria-labelledby="side-nav-title">' +
      '    <span class="visually-hidden" id="side-nav-title" data-i18n="nav_menu">Μενού</span>' +
      '    <div class="side-nav__columns">' +
      '      <div class="side-nav__nav-column">' +
      '        <button type="button" class="side-nav__close" data-side-nav-close aria-label="Close">×</button>' +
      '        <div class="side-nav__panel side-nav__panel--main">' +
      '          <ul class="side-nav__list side-nav__list--primary">' +
      '            <li><a class="side-nav__link" href="/" data-side-nav-preview="home" data-i18n="nav_home">Αρχική</a></li>' +
      '            <li><button type="button" class="side-nav__link side-nav__link--expand" data-side-panel="collection"><span class="side-nav__link-text" data-i18n="nav_collection">Συλλογή</span><span class="side-nav__chev" aria-hidden="true">›</span></button></li>' +
      '            <li><a class="side-nav__link" href="/new-arrivals" data-side-nav-preview="new" data-i18n="nav_new_arrivals">Νέα Προϊόντα</a></li>' +
      '            <li><a class="side-nav__link" href="/sale" data-side-nav-preview="sale" data-i18n="nav_sale">Εκπτώσεις</a></li>' +
      '            <li><a class="side-nav__link" href="/scent-finder" data-side-nav-preview="scent" data-i18n="nav_scent_finder">Scent Finder</a></li>' +
      '            <li><a class="side-nav__link" href="/gift-experience" data-side-nav-preview="gift" data-i18n="nav_gift">Gift Experience</a></li>' +
      '            <li><a class="side-nav__link" href="/seasonal" data-side-nav-preview="seasonal">Seasonal Editions</a></li>' +
      '            <li><button type="button" class="side-nav__link side-nav__link--expand" data-side-panel="about"><span class="side-nav__link-text" data-i18n="nav_about">Σχετικά</span><span class="side-nav__chev" aria-hidden="true">›</span></button></li>' +
      '            <li><a class="side-nav__link" href="/contact" data-side-nav-preview="contact" data-i18n="nav_contact">Επικοινωνία</a></li>' +
      "          </ul>" +
      "        </div>" +
      '        <div class="side-nav__divider" aria-hidden="true"></div>' +
      '        <ul class="side-nav__list side-nav__list--secondary">' +
      '          <li><a class="side-nav__link side-nav__link--small" href="/account"><span class="side-nav__link-text" data-i18n="account_my_account">Ο λογαριασμός μου</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="/account/register"><span class="side-nav__link-text" data-i18n="account_create_prompt">Δημιουργία λογαριασμού</span></a></li>' +
      '          <li><button type="button" class="side-nav__link side-nav__link--small" data-newsletter-open><span class="side-nav__link-text" data-i18n="newsletter_title">Newsletter</span></button></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="/cart"><span class="side-nav__link-text" data-i18n="cart_heading">Το καλάθι σου</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="/wishlist"><span class="side-nav__link-text" data-i18n="wishlist_heading">Αγαπημένα</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="/privacy"><span class="side-nav__link-text" data-i18n="footer_privacy">Προστασία Δεδομένων</span></a></li>' +
      "        </ul>" +
      '        <div class="side-nav__utils" id="side-nav-utils" hidden>' +
      '          <div class="side-nav__utils-row" id="side-nav-utils-row">' +
      '            <div class="side-nav__utils-locale" id="side-nav-utils-locale"></div>' +
      '            <div class="side-nav__utils-theme" id="side-nav-utils-theme"></div>' +
      "          </div>" +
      "        </div>" +
      "      </div>" +
      '      <div class="side-nav__sub-stack">' +
      '        <div class="side-nav__panel side-nav__panel--sub" data-side-sub="collection">' +
      '          <div class="side-nav__sub-head">' +
      '            <button type="button" class="side-nav__back" data-side-nav-back aria-label="Back">‹</button>' +
      '            <p class="side-nav__sub-label" data-i18n="nav_collection">Συλλογή</p>' +
      "          </div>" +
      '          <ul class="side-nav__list side-nav__list--sub">' +
      '            <li class="side-nav__subgroup-label" data-i18n="side_nav_group_candles">Κεριά</li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat1" data-visual="cat1"><span class="side-nav__sublink-text"><span data-i18n="collection_cat1">Art Class Murano Candle</span><span class="side-nav__sublink-count" data-cat-count="cat1" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat2" data-visual="cat2"><span class="side-nav__sublink-text"><span data-i18n="collection_cat2">Driftwood Beeswax Flame</span><span class="side-nav__sublink-count" data-cat-count="cat2" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat3" data-visual="cat3"><span class="side-nav__sublink-text"><span data-i18n="collection_cat3">Liquid Eternal</span><span class="side-nav__sublink-count" data-cat-count="cat3" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat4" data-visual="cat4"><span class="side-nav__sublink-text"><span data-i18n="collection_cat4">Vintage Unique Objects</span><span class="side-nav__sublink-count" data-cat-count="cat4" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat5" data-visual="cat5"><span class="side-nav__sublink-text"><span data-i18n="collection_cat5">NI Terra</span><span class="side-nav__sublink-count" data-cat-count="cat5" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat9" data-visual="cat9"><span class="side-nav__sublink-text"><span data-i18n="collection_cat9">Nostalgia Exclusive Mirror Candles</span><span class="side-nav__sublink-count" data-cat-count="cat9" aria-hidden="true"></span></span></a></li>' +
      '            <li class="side-nav__subgroup-divider" aria-hidden="true"></li>' +
      '            <li class="side-nav__subgroup-label" data-i18n="side_nav_group_non_candles">Άλλα προϊόντα</li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat6" data-visual="cat6"><span class="side-nav__sublink-text"><span data-i18n="collection_cat6">Perfume</span><span class="side-nav__sublink-count" data-cat-count="cat6" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat7" data-visual="cat7"><span class="side-nav__sublink-text"><span data-i18n="collection_cat7">Diffusers</span><span class="side-nav__sublink-count" data-cat-count="cat7" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/collection#cat8" data-visual="cat8"><span class="side-nav__sublink-text"><span data-i18n="collection_cat8">Gift Sets</span><span class="side-nav__sublink-count" data-cat-count="cat8" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink side-nav__sublink--all" href="/collection" data-visual="collection" data-i18n="side_nav_all_collections">Όλες οι συλλογές</a></li>' +
      "          </ul>" +
      "        </div>" +
      '        <div class="side-nav__panel side-nav__panel--sub" data-side-sub="about">' +
      '          <div class="side-nav__sub-head">' +
      '            <button type="button" class="side-nav__back" data-side-nav-back aria-label="Back">‹</button>' +
      '            <p class="side-nav__sub-label" data-i18n="nav_about">Σχετικά</p>' +
      "          </div>" +
      '          <ul class="side-nav__list side-nav__list--sub">' +
      '            <li><a class="side-nav__sublink" href="/about" data-visual="about" data-i18n="side_nav_about_all">Η Nostalgia</a></li>' +
      '            <li><a class="side-nav__sublink" href="/about#story" data-visual="about"><span data-i18n="about_tab_story">Η Ιστορία NI</span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/about#soul" data-visual="about"><span data-i18n="about_tab_soul">The Soul of Nostalgia</span></a></li>' +
      '            <li><a class="side-nav__sublink" href="/about#vision" data-visual="about"><span data-i18n="about_tab_vision">Our Vision</span></a></li>' +
      '            <li><a class="side-nav__sublink side-nav__sublink--all" href="/about" data-visual="about" data-i18n="side_nav_see_all">Δείτε όλα</a></li>' +
      "          </ul>" +
      "        </div>" +
      '        <figure class="side-nav__sub-feature" id="side-nav-sub-feature" hidden aria-hidden="true">' +
      '          <div class="side-nav__sub-feature-media">' +
      '            <img class="side-nav__sub-feature-img" id="side-nav-sub-feature-img" src="" alt="" decoding="async" />' +
      "          </div>" +
      '          <figcaption class="side-nav__sub-feature-caption">' +
      '            <p class="side-nav__sub-feature-title" id="side-nav-sub-feature-title"></p>' +
      '            <a class="side-nav__sub-feature-cta" id="side-nav-sub-feature-cta" href=""></a>' +
      "          </figcaption>" +
      "        </figure>" +
      "      </div>" +
      '      <aside class="side-nav__visual" aria-live="polite">' +
      '        <figure class="side-nav__figure">' +
      '          <img class="side-nav__img is-visible" id="side-nav-img-a" src="" alt="" decoding="async" fetchpriority="high" />' +
      '          <img class="side-nav__img" id="side-nav-img-b" src="" alt="" decoding="async" />' +
      '          <figcaption class="side-nav__caption">' +
      '            <p class="side-nav__visual-title" id="side-nav-visual-title"></p>' +
      '            <p class="side-nav__visual-desc" id="side-nav-visual-desc"></p>' +
      '            <a class="side-nav__cta" id="side-nav-visual-cta" href="/collection"></a>' +
      "          </figcaption>" +
      "        </figure>" +
      "      </aside>" +
      "    </div>" +
      "  </div>" +
      "</div>"
    );
  }

  function preloadImages() {
    Object.keys(VISUALS).forEach(function (key) {
      var src = resolveVisualSrc(VISUALS[key].image);
      if (imageCache[src]) return;
      var img = new Image();
      img.decoding = "async";
      img.src = src;
      imageCache[src] = img;
    });
  }

  function swapVisualImage(src) {
    var current = document.getElementById(visibleImgIndex === 0 ? "side-nav-img-a" : "side-nav-img-b");
    var next = document.getElementById(visibleImgIndex === 0 ? "side-nav-img-b" : "side-nav-img-a");
    if (!current || !next) return;

    var cached = imageCache[src];
    function reveal() {
      current.classList.remove("is-visible");
      current.classList.add("is-leaving");

      next.classList.remove("is-leaving");
      void next.offsetWidth;
      next.classList.add("is-visible");

      window.setTimeout(function () {
        current.classList.remove("is-leaving");
      }, 680);

      visibleImgIndex = visibleImgIndex === 0 ? 1 : 0;
      pulseVisualCaption();
    }

    if (cached && cached.complete && cached.naturalWidth > 0) {
      next.src = cached.src;
      reveal();
      return;
    }

    next.onload = function () {
      next.onload = null;
      reveal();
    };
    next.src = src;
    if (next.complete && next.naturalWidth > 0) reveal();
  }

  function pulseVisualCaption() {
    var visual = document.querySelector(".side-nav__visual");
    if (!visual) return;
    visual.classList.remove("is-image-changing");
    void visual.offsetWidth;
    visual.classList.add("is-image-changing");
    window.setTimeout(function () {
      visual.classList.remove("is-image-changing");
    }, 700);
  }

  function setSubFeature(key, data) {
    var subFeature = document.getElementById("side-nav-sub-feature");
    var subImg = document.getElementById("side-nav-sub-feature-img");
    var subTitle = document.getElementById("side-nav-sub-feature-title");
    var subCta = document.getElementById("side-nav-sub-feature-cta");
    if (!subFeature || !subImg) return;

    subImg.src = resolveVisualSrc(data.image);
    subImg.alt = t(data.titleKey);
    if (subTitle) subTitle.textContent = t(data.titleKey);
    if (subCta) {
      subCta.href = data.href;
      subCta.textContent = t(data.ctaKey);
    }

    subImg.classList.remove("is-changing");
    void subImg.offsetWidth;
    subImg.classList.add("is-changing");
    window.setTimeout(function () {
      subImg.classList.remove("is-changing");
    }, 680);
  }

  function toggleSubFeature(show) {
    var subFeature = document.getElementById("side-nav-sub-feature");
    if (!subFeature) return;
    subFeature.hidden = !show;
    subFeature.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function setVisual(key) {
    var data = VISUALS[key] || VISUALS.collection;
    var src = resolveVisualSrc(data.image);
    var imageChanged = activeVisual !== key;
    activeVisual = key;
    if (imageChanged) {
      swapVisualImage(src);
    } else {
      // First paint: the currently visible <img> still has an empty src
      // (activeVisual starts as "collection", so the initial setVisual call
      // is a no-op change). Prime it directly so the image shows immediately.
      var visibleImg = document.getElementById(
        visibleImgIndex === 0 ? "side-nav-img-a" : "side-nav-img-b"
      );
      if (visibleImg && !visibleImg.getAttribute("src")) {
        visibleImg.src = src;
      }
    }
    var altText = t(data.titleKey);
    ["side-nav-img-a", "side-nav-img-b"].forEach(function (id) {
      var img = document.getElementById(id);
      if (img) img.alt = altText;
    });
    var title = document.getElementById("side-nav-visual-title");
    var desc = document.getElementById("side-nav-visual-desc");
    var cta = document.getElementById("side-nav-visual-cta");
    if (title) title.textContent = t(data.titleKey);
    if (desc) desc.textContent = t(data.descKey);
    if (cta) {
      cta.href = data.href;
      cta.textContent = t(data.ctaKey);
    }
    setSubFeature(key, data);
  }

  function highlightPanelTrigger(name) {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.querySelectorAll("[data-side-panel]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-side-panel") === name);
    });
  }

  function clearPanelHighlight() {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.querySelectorAll("[data-side-panel]").forEach(function (btn) {
      btn.classList.remove("is-active");
    });
  }

  function openSubPanel(name) {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    activePanel = name;
    drawer.querySelectorAll("[data-side-sub]").forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-side-sub") === name);
    });
    drawer.classList.add("is-sub-open");
    drawer.classList.toggle("is-account-open", name === "account");
    highlightPanelTrigger(name);
    if (name === "account") {
      toggleSubFeature(false);
      if (window.NostalgiaAccount && window.NostalgiaAccount.renderPanel) {
        window.NostalgiaAccount.renderPanel();
      }
    } else {
      toggleSubFeature(true);
      setVisual(name === "about" ? "about" : "collection");
    }
  }

  function closeSubPanel() {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    activePanel = null;
    drawer.querySelectorAll("[data-side-sub]").forEach(function (panel) {
      panel.classList.remove("is-active");
    });
    drawer.classList.remove("is-sub-open", "is-account-open");
    clearPanelHighlight();
    toggleSubFeature(false);
    setVisual("collection");
  }

  function isDrawerOpen() {
    var drawer = document.getElementById(DRAWER_ID);
    return !!(drawer && !drawer.hidden && !drawerClosing);
  }

  function clearMenuHoverTimers() {
    if (triggerOpenTimer) {
      window.clearTimeout(triggerOpenTimer);
      triggerOpenTimer = null;
    }
    if (menuCloseTimer) {
      window.clearTimeout(menuCloseTimer);
      menuCloseTimer = null;
    }
  }

  function scheduleMenuClose() {
    if (menuPinnedOpen) return;
    if (menuCloseTimer) window.clearTimeout(menuCloseTimer);
    menuCloseTimer = window.setTimeout(function () {
      if (isDrawerOpen()) closeDrawer({ restoreFocus: false });
    }, 400);
  }
  function openDrawer(opts) {
    opts = opts || {};
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    if (drawerClosing) {
      drawerClosing = false;
      drawer.classList.remove("is-closing");
    }
    if (opts.pinned) menuPinnedOpen = true;
    clearMenuHoverTimers();
    drawer.classList.remove("is-closing");
    drawer.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("side-nav-open");
    if (opts.panel) {
      openSubPanel(opts.panel);
    } else if (!opts.keepPanel) {
      closeSubPanel();
      setVisual("collection");
    }
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
    var trigger = document.getElementById("side-nav-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (opts.focus !== false) {
      var closeBtn = drawer.querySelector(".side-nav__close");
      if (closeBtn) closeBtn.focus();
    }
  }

  function openForAccount() {
    window.location.href = "/account";
  }

  function closeDrawer(opts) {
    opts = opts || {};
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer || drawer.hidden || drawerClosing) return;
    menuPinnedOpen = false;
    clearMenuHoverTimers();
    drawerClosing = true;
    drawer.classList.add("is-closing");
    window.setTimeout(function () {
      drawer.hidden = true;
      drawer.setAttribute("aria-hidden", "true");
      drawer.classList.remove("is-closing");
      document.body.classList.remove("side-nav-open");
      closeSubPanel();
      drawerClosing = false;
      var trigger = document.getElementById("side-nav-trigger");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
        if (opts.restoreFocus !== false) trigger.focus();
      }
    }, 380);
  }

  function clearHoverTimers() {
    if (hoverOpenTimer) {
      window.clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
    }
    if (hoverLeaveTimer) {
      window.clearTimeout(hoverLeaveTimer);
      hoverLeaveTimer = null;
    }
  }

  function scheduleOpenSubPanel(name, delay) {
    clearHoverTimers();
    hoverOpenTimer = window.setTimeout(function () {
      openSubPanel(name);
    }, delay || 0);
  }

  function bindTriggerHover() {
    if (!hoverCapable) return;
    var trigger = document.getElementById("side-nav-trigger");
    var drawer = document.getElementById(DRAWER_ID);
    if (!trigger || !drawer) return;
    var drawerBody = drawer.querySelector(".side-nav__drawer");

    function canHoverOpen() {
      return hoverMenuEnabled();
    }

    function isMenuTarget(node) {
      if (!node || !(node instanceof Node)) return false;
      if (trigger.contains(node) || drawer.contains(node)) return true;
      if (node.closest) {
        return !!node.closest(".site-header__corner, #site-header-corner, #header-account-btn, #cart-link");
      }
      return false;
    }

    trigger.addEventListener("mouseenter", function () {
      if (!canHoverOpen()) return;
      clearMenuHoverTimers();
      if (isDrawerOpen() || drawerClosing) return;
      triggerOpenTimer = window.setTimeout(function () {
        triggerOpenTimer = null;
        openDrawer({ focus: false });
      }, 80);
    });

    trigger.addEventListener("mouseleave", function (e) {
      if (!canHoverOpen()) return;
      if (isMenuTarget(e.relatedTarget)) return;
      if (triggerOpenTimer) {
        window.clearTimeout(triggerOpenTimer);
        triggerOpenTimer = null;
      }
      if (isDrawerOpen()) scheduleMenuClose();
    });

    if (drawerBody) {
      drawerBody.addEventListener("mouseenter", function () {
        if (!canHoverOpen()) return;
        clearMenuHoverTimers();
        if (!isDrawerOpen()) openDrawer({ focus: false });
      });

      drawerBody.addEventListener("mouseleave", function (e) {
        if (!canHoverOpen()) return;
        if (!isMenuTarget(e.relatedTarget)) scheduleMenuClose();
      });
    }

    drawer.querySelectorAll("[data-side-nav-close]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        clearMenuHoverTimers();
      });
    });
  }

  function highlightCategoryLink(link) {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    drawer.querySelectorAll(".side-nav__sublink.is-preview").forEach(function (el) {
      el.classList.remove("is-preview");
    });
    if (link && link.classList.contains("side-nav__sublink")) {
      link.classList.add("is-preview");
    }
  }

  function bindHoverNavigation() {
    if (!hoverCapable) return;
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    var drawerBody = drawer.querySelector(".side-nav__drawer");
    if (!drawerBody) return;

    drawer.querySelectorAll("[data-side-panel]").forEach(function (btn) {
      btn.addEventListener("mouseenter", function () {
        scheduleOpenSubPanel(btn.getAttribute("data-side-panel"), 60);
      });
    });

    drawer.querySelectorAll("[data-side-nav-preview]").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        clearHoverTimers();
        closeSubPanel();
        setVisual(link.getAttribute("data-side-nav-preview"));
      });
    });

    drawer.querySelectorAll("[data-visual]").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        clearHoverTimers();
        highlightCategoryLink(link);
        setVisual(link.getAttribute("data-visual"));
      });
    });

    drawerBody.addEventListener("mouseleave", function () {
      hoverLeaveTimer = window.setTimeout(function () {
        if (activePanel !== "account") closeSubPanel();
      }, 420);
    });

    drawerBody.addEventListener("mouseenter", function () {
      if (hoverLeaveTimer) {
        window.clearTimeout(hoverLeaveTimer);
        hoverLeaveTimer = null;
      }
    });
  }

  function bindDrawerEvents() {
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;

    drawer.querySelectorAll("[data-side-nav-close]").forEach(function (el) {
      el.addEventListener("click", closeDrawer);
    });

    drawer.querySelectorAll("[data-side-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panel = btn.getAttribute("data-side-panel");
        if (panel === "account") {
          window.location.href = "/account";
          return;
        }
        openSubPanel(panel);
      });
    });

    drawer.querySelectorAll("[data-side-nav-back]").forEach(function (btn) {
      btn.addEventListener("click", closeSubPanel);
    });

    drawer.querySelectorAll("[data-visual]").forEach(function (link) {
      function previewVisual() {
        highlightCategoryLink(link);
        setVisual(link.getAttribute("data-visual"));
      }
      link.addEventListener("focus", previewVisual);
      if (!hoverCapable) {
        link.addEventListener("touchstart", previewVisual, { passive: true });
      }
    });

    drawer.querySelectorAll("[data-side-nav-preview]").forEach(function (link) {
      link.addEventListener("focus", function () {
        closeSubPanel();
        setVisual(link.getAttribute("data-side-nav-preview"));
      });
    });

    drawer.querySelectorAll("a.side-nav__link, a.side-nav__sublink").forEach(function (link) {
      link.addEventListener("click", function () {
        closeDrawer();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !drawer.hidden) {
        if (activePanel) closeSubPanel();
        else closeDrawer();
      }
    });
  }

  function neutralizeLegacyMobileNav(panel, hamburger) {
    if (panel) {
      panel.setAttribute("aria-hidden", "true");
      panel.style.cssText =
        "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);pointer-events:none;visibility:hidden;margin:-1px;padding:0;border:0;";
    }
    if (hamburger) {
      hamburger.hidden = true;
      hamburger.setAttribute("aria-hidden", "true");
      hamburger.tabIndex = -1;
      hamburger.style.pointerEvents = "none";
    }
  }

  function bindMenuTrigger(trigger, hamburger) {
    if (!trigger) return;

    var toggleLock = false;

    function toggleDrawerFromTrigger(event) {
      if (toggleLock) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      toggleLock = true;
      window.setTimeout(function () {
        toggleLock = false;
      }, 350);
      clearMenuHoverTimers();
      if (isDrawerOpen()) {
        closeDrawer();
      } else {
        openDrawer({ pinned: true });
      }
    }

    trigger.addEventListener("click", toggleDrawerFromTrigger);

    if (hamburger) {
      hamburger.addEventListener("click", toggleDrawerFromTrigger);
    }
  }

  var mobileHeaderMq = window.matchMedia("(max-width: 900px)");

  function isMobileHeader() {
    return mobileHeaderMq.matches;
  }

  function placeHeaderUtilities() {
    var tools = document.querySelector(".site-header__tools");
    var utilsLocale = document.getElementById("side-nav-utils-locale");
    var utilsTheme = document.getElementById("side-nav-utils-theme");
    var utilsWrap = document.getElementById("side-nav-utils");
    var lang = document.getElementById("lang-toggle");
    var theme = document.getElementById("theme-toggle");

    if (!tools) return;

    if (isMobileHeader()) {
      if (utilsLocale && lang && lang.parentNode !== utilsLocale) utilsLocale.appendChild(lang);
      if (utilsTheme && theme && theme.parentNode !== utilsTheme) utilsTheme.appendChild(theme);
      if (utilsWrap) utilsWrap.hidden = false;
      document.body.classList.add("has-side-nav-mobile-utils");
      if (window.NostalgiaLocale && typeof window.NostalgiaLocale.refreshTrigger === "function") {
        window.NostalgiaLocale.refreshTrigger();
      }
    } else {
      if (lang) tools.appendChild(lang);
      if (theme) tools.appendChild(theme);
      if (utilsWrap) utilsWrap.hidden = true;
      document.body.classList.remove("has-side-nav-mobile-utils");
      if (window.NostalgiaLocale && typeof window.NostalgiaLocale.refreshTrigger === "function") {
        window.NostalgiaLocale.refreshTrigger();
      }
    }
  }

  function ensureHeaderSearchSlot() {
    var bar = document.querySelector(".site-header__bar");
    var trigger = document.getElementById("side-nav-trigger");
    if (!bar || !trigger || document.getElementById("site-header-search-slot")) return;
    var searchSlot = document.createElement("div");
    searchSlot.className = "site-header__search-slot";
    searchSlot.id = "site-header-search-slot";
    bar.insertBefore(searchSlot, trigger.nextSibling);
  }

  function setupHeader() {
    var bar = document.querySelector(".site-header__bar");
    if (!bar) return;

    if (document.getElementById("side-nav-trigger")) {
      ensureHeaderSearchSlot();
      if (window.NostalgiaSiteChrome && typeof window.NostalgiaSiteChrome.setupSearch === "function") {
        window.NostalgiaSiteChrome.setupSearch();
      }
      return;
    }

    document.body.classList.add("has-side-nav");

    var panel = document.getElementById("mobile-nav-panel");
    var hamburger = document.querySelector(".mobile-nav-toggle");
    neutralizeLegacyMobileNav(panel, hamburger);

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "side-nav-trigger";
    trigger.id = "side-nav-trigger";
    trigger.setAttribute("aria-controls", DRAWER_ID);
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", t("nav_menu"));
    trigger.innerHTML =
      '<span class="side-nav-trigger__icon" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '<span class="side-nav-trigger__label" data-i18n="nav_menu">Μενού</span>';

    var tools = document.querySelector(".site-header__tools") || document.createElement("div");
    tools.className = "site-header__tools";

    var lang = document.getElementById("lang-toggle");
    var theme = document.getElementById("theme-toggle");
    if (
      lang &&
      lang.parentNode !== tools &&
      lang.parentNode !== document.getElementById("side-nav-utils-locale")
    ) {
      tools.appendChild(lang);
    }
    if (
      theme &&
      theme.parentNode !== tools &&
      theme.parentNode !== document.getElementById("side-nav-utils-theme")
    ) {
      tools.appendChild(theme);
    }

    bar.insertBefore(trigger, bar.firstChild);

    ensureHeaderSearchSlot();

    var logo = bar.querySelector(".site-header__logo--topbar");
    if (logo && logo.parentNode === bar) {
      bar.insertBefore(tools, logo);
    } else if (tools.childNodes.length) {
      bar.insertBefore(tools, trigger.nextSibling);
    }

    placeHeaderUtilities();
    if (typeof mobileHeaderMq.addEventListener === "function") {
      mobileHeaderMq.addEventListener("change", placeHeaderUtilities);
    } else if (typeof mobileHeaderMq.addListener === "function") {
      mobileHeaderMq.addListener(placeHeaderUtilities);
    }

    bindMenuTrigger(trigger, hamburger);

    if (window.NostalgiaSiteChrome && typeof window.NostalgiaSiteChrome.setupSearch === "function") {
      window.NostalgiaSiteChrome.setupSearch();
    }
  }

  function ensureDrawerUtils() {
    if (document.getElementById("side-nav-utils")) return;
    var navColumn = document.querySelector(".side-nav__nav-column");
    if (!navColumn) return;
    var wrap = document.createElement("div");
    wrap.className = "side-nav__utils";
    wrap.id = "side-nav-utils";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="side-nav__utils-row" id="side-nav-utils-row">' +
      '<div class="side-nav__utils-locale" id="side-nav-utils-locale"></div>' +
      '<div class="side-nav__utils-theme" id="side-nav-utils-theme"></div>' +
      "</div>";
    navColumn.appendChild(wrap);
  }

  function init() {
    ensureStylesheet();
    if (!document.getElementById(DRAWER_ID)) {
      document.body.insertAdjacentHTML("beforeend", buildDrawerHTML());
    }
    ensureDrawerUtils();
    preloadImages();
    setupHeader();
    ensureHeaderSearchSlot();
    placeHeaderUtilities();
    if (window.NostalgiaSiteChrome && typeof window.NostalgiaSiteChrome.setupSearch === "function") {
      window.NostalgiaSiteChrome.setupSearch();
    }
    bindDrawerEvents();
    bindTriggerHover();
    bindHoverNavigation();
    setVisual("collection");
    updateCategoryCounts();

    document.dispatchEvent(new CustomEvent("nostalgia-side-nav-ready"));

    if (window.NostalgiaAccount && window.NostalgiaAccount.ensureHeaderAccount) {
      window.NostalgiaAccount.ensureHeaderAccount();
    }
    if (window.NostalgiaCart && window.NostalgiaCart.refreshHeaderCart) {
      window.NostalgiaCart.refreshHeaderCart();
    }

    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        setVisual(activeVisual || "collection");
        updateCategoryCounts();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaSideNav = {
    open: openDrawer,
    close: closeDrawer,
    openPanel: openSubPanel,
    openForAccount: openForAccount,
    isOpen: isDrawerOpen,
    placeHeaderUtilities: placeHeaderUtilities,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
