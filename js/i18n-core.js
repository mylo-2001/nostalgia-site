(function () {
  var STORAGE_LANG = "nostalgia-lang";
  var STORAGE_COUNTRY = "nostalgia-country";

  function europeCountriesApi() {
    return window.NostalgiaEuropeCountries || null;
  }

  function getCountryCodes() {
    var api = europeCountriesApi();
    return api ? api.codes : ["GR", "CY"];
  }

  var STRINGS = { el: {}, en: {} };

function mergeI18nBundle(bundle) {
  if (!bundle) return;
  ["el", "en"].forEach(function (lang) {
    if (!bundle[lang]) return;
    Object.keys(bundle[lang]).forEach(function (key) {
      STRINGS[lang][key] = bundle[lang][key];
    });
  });
}

window.NostalgiaI18nRegister = function (bundle) {
  mergeI18nBundle(bundle);
};

(window.__nostalgiaI18nQueue || []).forEach(mergeI18nBundle);


  function getStoredLang() {
    try {
      return localStorage.getItem(STORAGE_LANG);
    } catch (e) {
      return null;
    }
  }

  function getLang() {
    var l = document.documentElement.lang || "el";
    return l === "en" ? "en" : "el";
  }

  function t(key) {
    var lang = getLang();
    var pack = STRINGS[lang] || STRINGS.el;
    return pack[key] != null ? pack[key] : key;
  }

  function applyLang(lang, opts) {
    opts = opts || {};
    if (lang !== "el" && lang !== "en") {
      lang = "el";
    }
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_LANG, lang);
    } catch (e) {}

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      var val = STRINGS[lang][key];
      if (val == null) return;
      el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (!key || !STRINGS[lang][key]) return;
      el.setAttribute("aria-label", STRINGS[lang][key]);
    });

    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var altKey = el.getAttribute("data-i18n-alt");
      if (!altKey || !STRINGS[lang][altKey]) return;
      el.setAttribute("alt", STRINGS[lang][altKey]);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var phKey = el.getAttribute("data-i18n-placeholder");
      if (!phKey || !STRINGS[lang][phKey]) return;
      el.setAttribute("placeholder", STRINGS[lang][phKey]);
    });

    var page = document.body && document.body.getAttribute("data-page");
    var metaKey = "meta_title_home";
    if (page === "about") metaKey = "meta_title_about";
    else if (page === "collection") metaKey = "meta_title_collection";
    else if (page === "contact") metaKey = "meta_title_contact";
    else if (page === "cart") metaKey = "meta_title_cart";
    else if (page === "wishlist") metaKey = "meta_title_wishlist";
    else if (page === "product") metaKey = "meta_title_product";
    else if (page === "checkout") metaKey = "meta_title_checkout";
    else if (page === "privacy") metaKey = "meta_title_privacy";
    else if (page === "faq") metaKey = "meta_title_faq";
    else if (page === "shipping") metaKey = "meta_title_shipping";
    else if (page === "payments") metaKey = "meta_title_payments";
    else if (page === "terms") metaKey = "meta_title_terms";
    else if (page === "journal") metaKey = "meta_title_journal";
    else if (page === "scent-finder") metaKey = "meta_title_scent_finder";
    else if (page === "gift") metaKey = "meta_title_gift";
    document.title = STRINGS[lang][metaKey];

    updateLocaleTrigger();
    syncCountryFields(lang);

    if (typeof window.NostalgiaApplyThemeLabels === "function") {
      window.NostalgiaApplyThemeLabels();
    }

    if (typeof window.NostalgiaOnLangApplied === "function") {
      window.NostalgiaOnLangApplied(lang);
    }

    if (opts.restartStory) {
      resetAboutStoryAnimation();
    }
  }

  function triggerAboutParagraphs(story) {
    story.classList.add("is-visible");
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    var split = storyPanel && storyPanel.querySelector(".about-split");
    if (split) {
      split.classList.add("is-visible");
    }
    var paragraphs = story.querySelectorAll(".about-story__p");
    paragraphs.forEach(function (p, i) {
      window.setTimeout(function () {
        p.classList.add("is-visible");
      }, 220 + i * 170);
    });
  }

  function aboutStoryInView(story) {
    var r = story.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * 0.92 && r.bottom > vh * 0.08;
  }

  function resetAboutStoryAnimation() {
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    if (!storyPanel || storyPanel.hidden) return;
    var story = storyPanel.querySelector(".about-story");
    if (!story) return;
    story.classList.remove("is-visible");
    var split = storyPanel.querySelector(".about-split");
    if (split) {
      split.classList.remove("is-visible");
    }
    story.querySelectorAll(".about-story__p").forEach(function (p) {
      p.classList.remove("is-visible");
    });
    window.requestAnimationFrame(function () {
      if (aboutStoryInView(story)) {
        triggerAboutParagraphs(story);
      } else if (typeof window.NostalgiaObserveAboutStory === "function") {
        window.NostalgiaObserveAboutStory();
      }
    });
  }

  window.resetAboutStoryAnimation = resetAboutStoryAnimation;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getStoredCountry() {
    try {
      var c = localStorage.getItem(STORAGE_COUNTRY);
      var api = europeCountriesApi();
      if (api && api.isValid(c)) return c;
      if (getCountryCodes().indexOf(c) !== -1) return c;
    } catch (e) {}
    return "GR";
  }

  function getCountry() {
    return getStoredCountry();
  }

  function countryName(code, lang) {
    var api = europeCountriesApi();
    if (api) return api.getName(code, lang);
    if (code === "CY") return STRINGS[lang].contact_country_cy;
    return STRINGS[lang].contact_country_gr;
  }

  function countryCheckoutValue(code, lang) {
    return countryName(code, lang) + " (" + code + ")";
  }

  function setCountry(code) {
    var api = europeCountriesApi();
    if (api && !api.isValid(code)) code = "GR";
    else if (!api && getCountryCodes().indexOf(code) === -1) code = "GR";
    try {
      localStorage.setItem(STORAGE_COUNTRY, code);
    } catch (e) {}
    updateLocaleTrigger();
    syncCountryFields(getLang());
    window.dispatchEvent(new CustomEvent("nostalgia-locale-updated"));
  }

  function syncCountryFields(lang) {
    var checkoutCountry = document.getElementById("checkout-country");
    if (checkoutCountry) {
      checkoutCountry.value = countryCheckoutValue(getCountry(), lang);
    }
  }

  function updateLocaleTrigger() {
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.classList.add("locale-trigger");
    var label = btn.querySelector(".locale-trigger__label");
    if (!label) {
      btn.innerHTML = '<span class="locale-trigger__label" aria-hidden="true"></span>';
      label = btn.querySelector(".locale-trigger__label");
    }
    var inDrawer = !!btn.closest("#side-nav-utils-locale");
    if (inDrawer) {
      label.textContent = t("locale_drawer_prefix") + ": " + countryName(getCountry(), getLang()) + " | €";
    } else {
      label.textContent = getCountry() + " | €";
    }
    btn.setAttribute("aria-label", t("locale_aria"));
    btn.setAttribute("aria-expanded", btn.getAttribute("aria-expanded") || "false");
    btn.setAttribute("aria-controls", "locale-drawer");
  }

  var localeDrawerEl;
  var localeCountrySelect;
  var localeLangSelect;

  function closeOtherOverlays() {
    if (window.NostalgiaSideNav && typeof window.NostalgiaSideNav.close === "function") {
      window.NostalgiaSideNav.close({ restoreFocus: false });
    }
    if (window.NostalgiaSearchDrawer && typeof window.NostalgiaSearchDrawer.close === "function") {
      window.NostalgiaSearchDrawer.close();
    }
    if (window.NostalgiaCart && typeof window.NostalgiaCart.closeDrawer === "function") {
      window.NostalgiaCart.closeDrawer();
    }
  }

  function setLocaleDrawerOpen(open) {
    if (!localeDrawerEl) return;
    localeDrawerEl.hidden = !open;
    localeDrawerEl.setAttribute("aria-hidden", open ? "false" : "true");
    localeDrawerEl.classList.toggle("is-open", open);
    document.body.classList.toggle("locale-drawer-open", open);
    var btn = document.getElementById("lang-toggle");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function fillLocaleSelectOptions() {
    if (!localeCountrySelect || !localeLangSelect) return;
    var lang = getLang();
    var api = europeCountriesApi();
    var entries = api ? api.sorted(lang) : [{ code: "GR", el: "Ελλάδα", en: "Greece" }, { code: "CY", el: "Κύπρος", en: "Cyprus" }];
    localeCountrySelect.innerHTML = entries
      .map(function (entry) {
        return (
          '<option value="' +
          entry.code +
          '">' +
          escapeHtml(entry[lang] || entry.en || countryName(entry.code, lang)) +
          "</option>"
        );
      })
      .join("");
    localeLangSelect.innerHTML =
      '<option value="el">' +
      escapeHtml(STRINGS[lang].locale_lang_el) +
      '</option><option value="en">' +
      escapeHtml(STRINGS[lang].locale_lang_en) +
      "</option>";
  }

  function syncLocaleDrawerFields() {
    if (!localeCountrySelect || !localeLangSelect) return;
    localeCountrySelect.value = getCountry();
    localeLangSelect.value = getLang();
    refreshLocaleCustomSelects();
  }

  function refreshLocaleCustomSelects() {
    [localeCountrySelect, localeLangSelect].forEach(function (sel) {
      if (sel && typeof sel._syncCustomLabel === "function") sel._syncCustomLabel();
    });
  }

  // Replace the native <select> popup with a themed dropdown so hover/selected
  // states follow the site palette instead of the OS blue highlight.
  function enhanceLocaleSelect(select) {
    if (!select || select.getAttribute("data-enhanced") === "1") return;
    var wrap = select.closest(".locale-drawer__select-wrap");
    if (!wrap) return;
    select.setAttribute("data-enhanced", "1");
    wrap.classList.add("locale-select", "is-enhanced");

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "locale-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    var valueSpan = document.createElement("span");
    valueSpan.className = "locale-select__value";
    trigger.appendChild(valueSpan);

    var list = document.createElement("ul");
    list.className = "locale-select__list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    wrap.appendChild(trigger);
    wrap.appendChild(list);

    function syncLabel() {
      var opt = select.options[select.selectedIndex];
      valueSpan.textContent = opt ? opt.textContent : "";
    }

    function buildList() {
      list.innerHTML = "";
      Array.prototype.forEach.call(select.options, function (opt, i) {
        var li = document.createElement("li");
        li.className = "locale-select__option";
        li.setAttribute("role", "option");
        var isSel = i === select.selectedIndex;
        li.setAttribute("aria-selected", isSel ? "true" : "false");
        if (isSel) li.classList.add("is-selected");
        li.textContent = opt.textContent;
        li.addEventListener("click", function () {
          select.value = opt.value;
          if (typeof Event === "function") {
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          syncLabel();
          close();
          trigger.focus();
        });
        list.appendChild(li);
      });
    }

    function open() {
      buildList();
      list.hidden = false;
      wrap.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      var sel = list.querySelector(".is-selected");
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
    }

    function close() {
      list.hidden = true;
      wrap.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (wrap.classList.contains("is-open")) close();
      else open();
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!wrap.classList.contains("is-open")) open();
      } else if (e.key === "Escape") {
        close();
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });

    select._syncCustomLabel = syncLabel;
    syncLabel();
  }

  function ensureLocaleDrawer() {
    if (localeDrawerEl) return;

    var lang = getLang();
    localeDrawerEl = document.createElement("aside");
    localeDrawerEl.id = "locale-drawer";
    localeDrawerEl.className = "locale-drawer";
    localeDrawerEl.hidden = true;
    localeDrawerEl.setAttribute("aria-hidden", "true");
    localeDrawerEl.innerHTML =
      '<div class="locale-drawer__backdrop" data-locale-close tabindex="-1"></div>' +
      '<div class="locale-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="locale-drawer-title">' +
      '  <button type="button" class="locale-drawer__close" data-locale-close aria-label="' +
      escapeHtml(STRINGS[lang].toast_close_aria) +
      '">×</button>' +
      '  <p class="locale-drawer__intro" id="locale-drawer-title" data-i18n="locale_drawer_intro">' +
      escapeHtml(STRINGS[lang].locale_drawer_intro) +
      "</p>" +
      '  <div class="locale-drawer__field">' +
      '    <label class="locale-drawer__label" for="locale-drawer-country" data-i18n="locale_country_label">' +
      escapeHtml(STRINGS[lang].locale_country_label) +
      "</label>" +
      '    <div class="locale-drawer__select-wrap">' +
      '      <select id="locale-drawer-country" class="locale-drawer__select"></select>' +
      "    </div>" +
      "  </div>" +
      '  <div class="locale-drawer__field">' +
      '    <label class="locale-drawer__label" for="locale-drawer-lang" data-i18n="locale_language_label">' +
      escapeHtml(STRINGS[lang].locale_language_label) +
      "</label>" +
      '    <div class="locale-drawer__select-wrap">' +
      '      <select id="locale-drawer-lang" class="locale-drawer__select"></select>' +
      "    </div>" +
      "  </div>" +
      '  <div class="locale-drawer__field">' +
      '    <span class="locale-drawer__label" data-i18n="locale_currency_label">' +
      escapeHtml(STRINGS[lang].locale_currency_label) +
      "</span>" +
      '    <p class="locale-drawer__currency" data-i18n="locale_currency_value">' +
      escapeHtml(STRINGS[lang].locale_currency_value) +
      "</p>" +
      "  </div>" +
      '  <button type="button" class="locale-drawer__confirm btn-shop btn-shop--primary" data-locale-confirm data-i18n="locale_confirm">' +
      escapeHtml(STRINGS[lang].locale_confirm) +
      "</button>" +
      "</div>";
    document.body.appendChild(localeDrawerEl);

    localeCountrySelect = document.getElementById("locale-drawer-country");
    localeLangSelect = document.getElementById("locale-drawer-lang");
    fillLocaleSelectOptions();
    enhanceLocaleSelect(localeCountrySelect);
    enhanceLocaleSelect(localeLangSelect);
    syncLocaleDrawerFields();

    localeDrawerEl.querySelectorAll("[data-locale-close]").forEach(function (el) {
      el.addEventListener("click", closeLocaleDrawer);
    });

    localeDrawerEl.querySelector("[data-locale-confirm]").addEventListener("click", function () {
      var nextCountry = localeCountrySelect ? localeCountrySelect.value : "GR";
      var nextLang = localeLangSelect ? localeLangSelect.value : "el";
      var langChanged = nextLang !== getLang();
      setCountry(nextCountry);
      applyLang(nextLang === "en" ? "en" : "el", { restartStory: langChanged });
      closeLocaleDrawer();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && localeDrawerEl && localeDrawerEl.classList.contains("is-open")) {
        closeLocaleDrawer();
      }
    });
  }

  function openLocaleDrawer() {
    ensureLocaleDrawer();
    closeOtherOverlays();
    fillLocaleSelectOptions();
    syncLocaleDrawerFields();
    setLocaleDrawerOpen(true);
    window.setTimeout(function () {
      var closeBtn = localeDrawerEl.querySelector(".locale-drawer__close");
      if (closeBtn) closeBtn.focus();
    }, 420);
  }

  function closeLocaleDrawer() {
    if (!localeDrawerEl) return;
    var returnFocus = document.getElementById("lang-toggle");
    var active = document.activeElement;
    if (returnFocus) {
      returnFocus.focus();
    } else if (active && localeDrawerEl.contains(active)) {
      active.blur();
    }
    window.requestAnimationFrame(function () {
      setLocaleDrawerOpen(false);
    });
  }

  function initLocaleTrigger() {
    var btn = document.getElementById("lang-toggle");
    if (!btn || btn.getAttribute("data-locale-bound") === "1") return;
    btn.setAttribute("data-locale-bound", "1");
    btn.type = "button";
    updateLocaleTrigger();
    btn.addEventListener("click", function () {
      if (localeDrawerEl && localeDrawerEl.classList.contains("is-open")) closeLocaleDrawer();
      else openLocaleDrawer();
    });
  }

  function initAboutStoryObserver() {
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    if (!storyPanel) return;
    var story = storyPanel.querySelector(".about-story");
    if (!story) return;

    if (typeof IntersectionObserver === "undefined") {
      triggerAboutParagraphs(story);
      return;
    }

    window.NostalgiaObserveAboutStory = function () {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            obs.disconnect();
            triggerAboutParagraphs(story);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      obs.observe(story);
    };

    window.NostalgiaObserveAboutStory();
  }

  function shopBundleLoaded() {
    return !!(STRINGS.el && STRINGS.el.cart_empty_title);
  }

  function ensureShopBundle() {
    if (shopBundleLoaded()) return;
    if (document.querySelector('script[data-i18n-shop="1"], script[src*="i18n-bundles/shop.js"]')) {
      return;
    }
    var script = document.createElement("script");
    script.src = "js/i18n-bundles/shop.js?v=3";
    script.defer = true;
    script.setAttribute("data-i18n-shop", "1");
    script.onload = function () {
      var lang = getLang();
      applyLang(lang, { restartStory: false });
      window.dispatchEvent(new CustomEvent("nostalgia-i18n-updated", { detail: { lang: lang } }));
    };
    document.head.appendChild(script);
  }

  function init() {
    ensureShopBundle();
    var stored = getStoredLang();
    applyLang(stored === "en" || stored === "el" ? stored : "el", {
      restartStory: false,
    });
    initLocaleTrigger();
    ensureLocaleDrawer();
    initAboutStoryObserver();
  }

  window.NostalgiaLocale = {
    open: openLocaleDrawer,
    close: closeLocaleDrawer,
    getCountry: getCountry,
    setCountry: setCountry,
    refreshTrigger: updateLocaleTrigger,
  };

  window.NostalgiaI18n = {
    strings: STRINGS,
    t: t,
    applyLang: applyLang,
    getLang: getLang,
    getCountry: getCountry,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
