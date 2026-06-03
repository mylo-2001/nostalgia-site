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

  var VISUALS = {
    home: {
      image: "home%20page%20photo/home%20photo.png",
      titleKey: "side_nav_visual_home_title",
      descKey: "side_nav_visual_home_desc",
      href: "index.html",
      ctaKey: "side_nav_discover",
    },
    collection: {
      image: "home%20page%20photo/home%20collection.png",
      titleKey: "nav_mega_title",
      descKey: "nav_mega_desc",
      href: "collection.html",
      ctaKey: "nav_mega_cta",
    },
    cat1: {
      image: "product%20photo/art%20class%20murano%20candle/product%201.png",
      titleKey: "collection_cat1",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat1",
      ctaKey: "side_nav_discover",
    },
    cat2: {
      image: "product%20photo/driftwood%20beeswax%20flame/product%201.png",
      titleKey: "collection_cat2",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat2",
      ctaKey: "side_nav_discover",
    },
    cat3: {
      image: "product%20photo/liquid%20eternal/product%201.png",
      titleKey: "collection_cat3",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat3",
      ctaKey: "side_nav_discover",
    },
    cat4: {
      image: "product%20photo/unique%20art%20vessel/product%201.png",
      titleKey: "collection_cat4",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat4",
      ctaKey: "side_nav_discover",
    },
    cat5: {
      image: "product%20photo/Ni%20Terra/product%20photo.png",
      titleKey: "collection_cat5",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat5",
      ctaKey: "side_nav_discover",
    },
    cat6: {
      image: "home%20page%20photo/home%20collection.png",
      titleKey: "collection_cat6",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat6",
      ctaKey: "side_nav_discover",
    },
    cat7: {
      image: "home%20page%20photo/home%20collection.png",
      titleKey: "collection_cat7",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat7",
      ctaKey: "side_nav_discover",
    },
    cat8: {
      image: "home%20page%20photo/home%20collection.png",
      titleKey: "collection_cat8",
      descKey: "side_nav_visual_cat_desc",
      href: "collection.html#cat8",
      ctaKey: "side_nav_discover",
    },
    about: {
      image: "home%20page%20photo/about%20photo%20.png",
      titleKey: "nav_about_mega_title",
      descKey: "nav_about_mega_desc",
      href: "about.html",
      ctaKey: "nav_about_mega_cta",
    },
    contact: {
      image: "home%20page%20photo/home%20photo.png",
      titleKey: "side_nav_visual_contact_title",
      descKey: "side_nav_visual_contact_desc",
      href: "contact.html",
      ctaKey: "nav_contact",
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
    link.href = "css/side-nav.css?v=light-nav2";
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
      '            <li><a class="side-nav__link" href="index.html" data-side-nav-preview="home" data-i18n="nav_home">Αρχική</a></li>' +
      '            <li><button type="button" class="side-nav__link side-nav__link--expand" data-side-panel="collection"><span class="side-nav__link-text" data-i18n="nav_collection">Συλλογή</span><span class="side-nav__chev" aria-hidden="true">›</span></button></li>' +
      '            <li><button type="button" class="side-nav__link side-nav__link--expand" data-side-panel="about"><span class="side-nav__link-text" data-i18n="nav_about">Σχετικά</span><span class="side-nav__chev" aria-hidden="true">›</span></button></li>' +
      '            <li><a class="side-nav__link" href="contact.html" data-side-nav-preview="contact" data-i18n="nav_contact">Επικοινωνία</a></li>' +
      "          </ul>" +
      "        </div>" +
      '        <div class="side-nav__divider" aria-hidden="true"></div>' +
      '        <ul class="side-nav__list side-nav__list--secondary">' +
      '          <li><a class="side-nav__link side-nav__link--small" href="account.html?mode=login"><span class="side-nav__link-text" data-i18n="account_my_account">Ο λογαριασμός μου</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="account.html?mode=register"><span class="side-nav__link-text" data-i18n="account_create_prompt">Δημιουργία λογαριασμού</span></a></li>' +
      '          <li><button type="button" class="side-nav__link side-nav__link--small" data-newsletter-open><span class="side-nav__link-text" data-i18n="newsletter_title">Newsletter</span></button></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="cart.html"><span class="side-nav__link-text" data-i18n="cart_heading">Το καλάθι σου</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="wishlist.html"><span class="side-nav__link-text" data-i18n="wishlist_heading">Αγαπημένα</span></a></li>' +
      '          <li><a class="side-nav__link side-nav__link--small" href="privacy.html"><span class="side-nav__link-text" data-i18n="footer_privacy">Προστασία Δεδομένων</span></a></li>' +
      "        </ul>" +
      "      </div>" +
      '      <div class="side-nav__sub-stack">' +
      '        <div class="side-nav__panel side-nav__panel--sub" data-side-sub="collection">' +
      '          <div class="side-nav__sub-head">' +
      '            <button type="button" class="side-nav__back" data-side-nav-back aria-label="Back">‹</button>' +
      '            <p class="side-nav__sub-label" data-i18n="nav_collection">Συλλογή</p>' +
      "          </div>" +
      '          <ul class="side-nav__list side-nav__list--sub">' +
      '            <li class="side-nav__subgroup-label" data-i18n="side_nav_group_candles">Κεριά</li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat1" data-visual="cat1"><span class="side-nav__sublink-text"><span data-i18n="collection_cat1">Art Class Murano Candle</span><span class="side-nav__sublink-count" data-cat-count="cat1" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat2" data-visual="cat2"><span class="side-nav__sublink-text"><span data-i18n="collection_cat2">Driftwood Beeswax Flame</span><span class="side-nav__sublink-count" data-cat-count="cat2" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat3" data-visual="cat3"><span class="side-nav__sublink-text"><span data-i18n="collection_cat3">Liquid Eternal</span><span class="side-nav__sublink-count" data-cat-count="cat3" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat4" data-visual="cat4"><span class="side-nav__sublink-text"><span data-i18n="collection_cat4">Unique Art Objects</span><span class="side-nav__sublink-count" data-cat-count="cat4" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat5" data-visual="cat5"><span class="side-nav__sublink-text"><span data-i18n="collection_cat5">NI Terra</span><span class="side-nav__sublink-count" data-cat-count="cat5" aria-hidden="true"></span></span></a></li>' +
      '            <li class="side-nav__subgroup-divider" aria-hidden="true"></li>' +
      '            <li class="side-nav__subgroup-label" data-i18n="side_nav_group_non_candles">Άλλα προϊόντα</li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat6" data-visual="cat6"><span class="side-nav__sublink-text"><span data-i18n="collection_cat6">Perfume</span><span class="side-nav__sublink-count" data-cat-count="cat6" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat7" data-visual="cat7"><span class="side-nav__sublink-text"><span data-i18n="collection_cat7">Diffusers</span><span class="side-nav__sublink-count" data-cat-count="cat7" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink" href="collection.html#cat8" data-visual="cat8"><span class="side-nav__sublink-text"><span data-i18n="collection_cat8">Gift Sets</span><span class="side-nav__sublink-count" data-cat-count="cat8" aria-hidden="true"></span></span></a></li>' +
      '            <li><a class="side-nav__sublink side-nav__sublink--all" href="collection.html" data-visual="collection" data-i18n="side_nav_all_collections">Όλες οι συλλογές</a></li>' +
      "          </ul>" +
      "        </div>" +
      '        <div class="side-nav__panel side-nav__panel--sub" data-side-sub="about">' +
      '          <div class="side-nav__sub-head">' +
      '            <button type="button" class="side-nav__back" data-side-nav-back aria-label="Back">‹</button>' +
      '            <p class="side-nav__sub-label" data-i18n="nav_about">Σχετικά</p>' +
      "          </div>" +
      '          <ul class="side-nav__list side-nav__list--sub">' +
      '            <li><a class="side-nav__sublink" href="about.html" data-visual="about" data-i18n="side_nav_about_all">Η Nostalgia</a></li>' +
      '            <li><a class="side-nav__sublink" href="about.html#story" data-visual="about"><span data-i18n="about_tab_story">Η Ιστορία NI</span></a></li>' +
      '            <li><a class="side-nav__sublink" href="about.html#soul" data-visual="about"><span data-i18n="about_tab_soul">The Soul of Nostalgia</span></a></li>' +
      '            <li><a class="side-nav__sublink" href="about.html#vision" data-visual="about"><span data-i18n="about_tab_vision">Our Vision</span></a></li>' +
      '            <li><a class="side-nav__sublink side-nav__sublink--all" href="about.html" data-visual="about" data-i18n="side_nav_see_all">Δείτε όλα</a></li>' +
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
      '            <a class="side-nav__cta" id="side-nav-visual-cta" href="collection.html"></a>' +
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
      var src = VISUALS[key].image;
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

    subImg.src = data.image;
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
    var imageChanged = activeVisual !== key;
    activeVisual = key;
    if (imageChanged) swapVisualImage(data.image);
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
    window.location.href = "account.html?mode=login";
  }

  function closeDrawer(opts) {
    opts = opts || {};
    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer || drawer.hidden || drawerClosing) return;
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

    function isMenuTarget(node) {
      if (!node || !(node instanceof Node)) return false;
      if (trigger.contains(node) || drawer.contains(node)) return true;
      if (node.closest) {
        return !!node.closest(".site-header__corner, #site-header-corner, #header-account-btn, #cart-link");
      }
      return false;
    }

    trigger.addEventListener("mouseenter", function () {
      clearMenuHoverTimers();
      if (isDrawerOpen() || drawerClosing) return;
      triggerOpenTimer = window.setTimeout(function () {
        triggerOpenTimer = null;
        openDrawer({ focus: false });
      }, 80);
    });

    trigger.addEventListener("mouseleave", function (e) {
      if (isMenuTarget(e.relatedTarget)) return;
      if (triggerOpenTimer) {
        window.clearTimeout(triggerOpenTimer);
        triggerOpenTimer = null;
      }
      if (isDrawerOpen()) scheduleMenuClose();
    });

    if (drawerBody) {
      drawerBody.addEventListener("mouseenter", function () {
        clearMenuHoverTimers();
        if (!isDrawerOpen()) openDrawer({ focus: false });
      });

      drawerBody.addEventListener("mouseleave", function (e) {
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
          window.location.href = "account.html?mode=login";
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
        openDrawer();
      }
    }

    trigger.addEventListener("click", toggleDrawerFromTrigger);

    if (hamburger) {
      hamburger.addEventListener("click", toggleDrawerFromTrigger);
    }
  }

  function setupHeader() {
    var bar = document.querySelector(".site-header__bar");
    if (!bar || document.getElementById("side-nav-trigger")) return;

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
    if (lang && lang.parentNode !== tools) tools.appendChild(lang);
    if (theme && theme.parentNode !== tools) tools.appendChild(theme);

    bar.insertBefore(trigger, bar.firstChild);

    var logo = bar.querySelector(".site-header__logo--topbar");
    if (logo && logo.parentNode === bar) {
      bar.insertBefore(tools, logo);
    } else if (tools.childNodes.length) {
      bar.insertBefore(tools, trigger.nextSibling);
    }

    bindMenuTrigger(trigger, hamburger);
  }

  function init() {
    ensureStylesheet();
    if (!document.getElementById(DRAWER_ID)) {
      document.body.insertAdjacentHTML("beforeend", buildDrawerHTML());
    }
    preloadImages();
    setupHeader();
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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
