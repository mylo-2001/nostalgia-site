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
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function labelForCurrentTheme(theme) {
    var I = window.NostalgiaI18n;
    if (I && typeof I.t === "function") {
      return theme === "dark" ? I.t("theme_go_light") : I.t("theme_go_dark");
    }
    return theme === "dark" ? "Φωτεινό" : "Σκοτεινό";
  }

  function ariaForCurrentTheme(theme) {
    var I = window.NostalgiaI18n;
    if (I && typeof I.t === "function") {
      return theme === "dark" ? I.t("theme_aria_to_light") : I.t("theme_aria_to_dark");
    }
    return theme === "dark" ? "Εναλλαγή σε φωτεινό θέμα" : "Εναλλαγή σε σκοτεινό θέμα";
  }

  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") {
      theme = getSystemTheme();
    }
    root.setAttribute("data-theme", theme);
    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.textContent = labelForCurrentTheme(theme);
      toggle.setAttribute("aria-label", ariaForCurrentTheme(theme));
    }
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

    function update() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      var viewport = window.innerHeight || document.documentElement.clientHeight;
      var nearFooter = footerTop < viewport - 24;

      btn.classList.toggle("is-visible", y > 260 && !nearFooter);
      btn.classList.toggle("is-near-footer", nearFooter);
    }

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  window.NostalgiaApplyThemeLabels = function () {
    var theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.textContent = labelForCurrentTheme(theme);
      toggle.setAttribute("aria-label", ariaForCurrentTheme(theme));
    }
  };

  function init() {
    var stored = getStoredTheme();
    applyTheme(stored || getSystemTheme());

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        var next = current === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (e) {}
        applyTheme(next);
      });
    }

    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", function () {
          if (!getStoredTheme()) {
            applyTheme(getSystemTheme());
          }
        });
    }

    initMobileNav();
    initBackToTop();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
