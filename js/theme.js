(function () {
  var STORAGE_KEY = "nostalgia-theme";
  var root = document.documentElement;

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getSystemTheme() {
    /* Kept for compatibility — site default is always light. */
    return "light";
  }

  var THEME_TOGGLE_ICONS =
    '<span class="theme-toggle__icons" aria-hidden="true">' +
    '<svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" focusable="false">' +
    '<circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" stroke-width="1.65"/>' +
    '<path fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" d="M12 3.25v2.1M12 18.65v2.1M5.05 5.05l1.48 1.48M17.47 17.47l1.48 1.48M3.25 12h2.1M18.65 12h2.1M5.05 18.95l1.48-1.48M17.47 6.53l1.48-1.48"/>' +
    "</svg>" +
    '<svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" focusable="false">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" d="M20.2 14.8a7.35 7.35 0 0 1-9.55-9.55 7.35 7.35 0 1 0 9.55 9.55z"/>' +
    "</svg>" +
    "</span>";

  function ensureThemeToggleMarkup() {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle || toggle.querySelector(".theme-toggle__icons")) return;
    toggle.innerHTML = THEME_TOGGLE_ICONS;
  }

  function iconTargetForTheme(theme) {
    return theme === "dark" ? "sun" : "moon";
  }

  function updateThemeToggleUi(theme, animate) {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    ensureThemeToggleMarkup();
    toggle.setAttribute("data-icon", iconTargetForTheme(theme));
    toggle.setAttribute("aria-label", ariaForCurrentTheme(theme));
    if (animate === false) return;
    toggle.classList.add("is-switching");
    window.clearTimeout(toggle._themeSwitchTimer);
    toggle._themeSwitchTimer = window.setTimeout(function () {
      toggle.classList.remove("is-switching");
    }, 520);
  }

  function ariaForCurrentTheme(theme) {
    var I = window.NostalgiaI18n;
    if (I && typeof I.t === "function") {
      return theme === "dark" ? I.t("theme_aria_to_light") : I.t("theme_aria_to_dark");
    }
    return theme === "dark" ? "Εναλλαγή σε φωτεινό θέμα" : "Εναλλαγή σε σκοτεινό θέμα";
  }

  function applyTheme(theme, opts) {
    opts = opts || {};
    if (theme !== "light" && theme !== "dark") {
      theme = "light";
    }
    root.setAttribute("data-theme", theme);
    updateThemeToggleUi(theme, opts.animateToggle);
  }

  function initMobileNav() {
    if (document.getElementById("side-nav-trigger")) return;
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".mobile-nav-toggle");
    var panel = document.getElementById("mobile-nav-panel");
    if (!header || !toggle || !panel) return;

    function setOpen(open) {
      header.classList.toggle("is-mobile-nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    }

    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-mobile-nav-open"));
    });

    panel.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    });

    if (window.matchMedia) {
      window.matchMedia("(min-width: 641px)").addEventListener("change", function (event) {
        if (event.matches) {
          setOpen(false);
        }
      });
    }
  }

  function initBackToTop() {
    var btn = document.querySelector(".back-to-top");
    var footer = document.querySelector(".site-footer");
    if (!btn) return;

    /* On the home intro curtain, "top" means just past the intro — not y=0,
       which would re-show the curtain and force another scroll to dismiss it. */
    function scrollHomePastIntro() {
      if (document.body.getAttribute("data-page") !== "home") return 0;
      if (!document.getElementById("site-intro")) return 0;
      if (document.documentElement.classList.contains("no-site-intro")) return 0;
      if (window.matchMedia("(max-width: 768px)").matches) return 0;
      var reduce =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !document.documentElement.classList.contains("force-site-motion");
      if (reduce) return 0;
      var spacer = document.querySelector(".site-intro-spacer");
      var intro = document.getElementById("site-intro");
      return Math.max(
        0,
        (spacer && spacer.offsetHeight) ||
          (intro && intro.offsetHeight) ||
          window.innerHeight ||
          0
      );
    }

    function update() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      var nearFooter = footerTop < viewport - 24;
      var homeFloor = scrollHomePastIntro();
      var showAfter = homeFloor > 0 ? homeFloor + 180 : 260;

      btn.classList.toggle("is-visible", y > showAfter && !nearFooter);
      btn.classList.toggle("is-near-footer", nearFooter);
    }

    btn.addEventListener("click", function () {
      window.scrollTo({ top: scrollHomePastIntro(), behavior: "smooth" });
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  window.NostalgiaApplyThemeLabels = function () {
    var theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    updateThemeToggleUi(theme);
  };

  function init() {
    var stored = getStoredTheme();
    applyTheme(stored === "dark" ? "dark" : "light", { animateToggle: false });

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        var next = current === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (e) {}
        applyTheme(next, { animateToggle: true });
      });
    }

    initMobileNav();
    initBackToTop();
    initSeo();
    initSiteChrome();
    initBreadcrumbs();
    initSitePolish();
  }

  function loadScriptOnce(src, attr, attrVal) {
    if (document.querySelector("script[" + attr + '="' + attrVal + '"]')) return;
    var script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, attrVal);
    document.head.appendChild(script);
  }

  function initSeo() {
    loadScriptOnce("js/seo.js?v=1", "data-seo", "1");
  }

  function initBreadcrumbs() {
    if (window.NostalgiaBreadcrumbs && typeof window.NostalgiaBreadcrumbs.refresh === "function") {
      window.NostalgiaBreadcrumbs.refresh();
      return;
    }
    if (document.querySelector('script[data-breadcrumbs="1"]')) return;
    var script = document.createElement("script");
    script.src = "js/breadcrumbs.js?v=7";
    script.async = false;
    script.setAttribute("data-breadcrumbs", "1");
    document.body.appendChild(script);
  }

  function initSitePolish() {
    if (!document.querySelector('link[data-experience-css="1"]')) {
      var exp = document.createElement("link");
      exp.rel = "stylesheet";
      exp.href = "css/experience.css?v=4";
      exp.setAttribute("data-experience-css", "1");
      document.head.appendChild(exp);
    }
    if (!document.querySelector('link[data-polish-css="1"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/polish.css?v=11";
      link.setAttribute("data-polish-css", "1");
      document.head.appendChild(link);
    }
    if (window.NostalgiaPolish) return;
    if (document.querySelector('script[data-site-polish="1"]')) return;
    var script = document.createElement("script");
    script.src = "js/site-polish.js?v=6";
    script.async = false;
    script.setAttribute("data-site-polish", "1");
    document.body.appendChild(script);
  }

  function initSiteChrome() {
    if (window.NostalgiaSiteChrome && typeof window.NostalgiaSiteChrome.init === "function") {
      window.NostalgiaSiteChrome.init();
      return;
    }
    if (document.querySelector('script[data-site-chrome="1"]')) return;
    var script = document.createElement("script");
    script.src = "js/site-chrome.js?v=footer-identity1";
    script.async = false;
    script.setAttribute("data-site-chrome", "1");
    script.onload = function () {
      if (window.NostalgiaSiteChrome && typeof window.NostalgiaSiteChrome.init === "function") {
        window.NostalgiaSiteChrome.init();
      }
    };
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
