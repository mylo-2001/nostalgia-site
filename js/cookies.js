(function () {
  var STORAGE_KEY = "nostalgia-cookie-consent";
  var CONSENT_DAYS = 365;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(data) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: !!data.analytics,
          timestamp: Date.now(),
        })
      );
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("nostalgia-cookie-consent-set"));
  }

  function consentExpired(consent) {
    if (!consent || !consent.timestamp) return true;
    return Date.now() - consent.timestamp > CONSENT_DAYS * 24 * 60 * 60 * 1000;
  }

  function shouldShowBanner() {
    var consent = readConsent();
    return !consent || consentExpired(consent);
  }

  var bannerEl;
  var settingsEl;

  function ensureUI() {
    if (bannerEl) return;

    bannerEl = document.createElement("div");
    bannerEl.className = "cookie-banner";
    bannerEl.id = "cookie-banner";
    bannerEl.setAttribute("role", "dialog");
    bannerEl.setAttribute("aria-modal", "true");
    bannerEl.setAttribute("aria-labelledby", "cookie-banner-title");
    bannerEl.hidden = true;
    bannerEl.innerHTML =
      '<div class="cookie-banner__panel">' +
      '  <h2 class="cookie-banner__title" id="cookie-banner-title" data-i18n="cookie_banner_title">Οι επιλογές σας για τα cookies</h2>' +
      '  <p class="cookie-banner__text"><span data-i18n="cookie_banner_text">Η Nostalgia Collection χρησιμοποιεί cookies για να βελτιώσει την εμπειρία σας.</span> <a href="privacy.html#cookies" data-i18n="cookie_learn_more">Μάθετε περισσότερα</a>.</p>' +
      '  <div class="cookie-banner__actions">' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" data-cookie-manage data-i18n="cookie_manage">Ρυθμίσεις</button>' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--primary" data-cookie-accept data-i18n="cookie_accept">Αποδοχή</button>' +
      "  </div>" +
      "</div>";

    settingsEl = document.createElement("div");
    settingsEl.className = "cookie-settings";
    settingsEl.id = "cookie-settings";
    settingsEl.hidden = true;
    settingsEl.setAttribute("role", "dialog");
    settingsEl.setAttribute("aria-modal", "true");
    settingsEl.setAttribute("aria-labelledby", "cookie-settings-title");
    settingsEl.innerHTML =
      '<div class="cookie-settings__backdrop" data-cookie-settings-close></div>' +
      '<div class="cookie-settings__panel">' +
      '  <button type="button" class="cookie-settings__close" data-cookie-settings-close aria-label="Close">×</button>' +
      '  <h2 class="cookie-settings__title" id="cookie-settings-title" data-i18n="cookie_settings_title">Διαχείριση cookies</h2>' +
      '  <p class="cookie-settings__lead" data-i18n="cookie_settings_lead">Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απολύτως απαραίτητα cookies παραμένουν πάντα ενεργά, καθώς είναι αναγκαία για τη λειτουργία του ιστότοπου.</p>' +
      '  <ul class="cookie-settings__list">' +
      '    <li class="cookie-settings__item">' +
      '      <div class="cookie-settings__item-head">' +
      '        <span class="cookie-settings__item-name" data-i18n="cookie_essential_title">Απολύτως απαραίτητα</span>' +
      '        <span class="cookie-settings__badge" data-i18n="cookie_always_on">Πάντα ενεργά</span>' +
      "      </div>" +
      '      <p class="cookie-settings__item-desc" data-i18n="cookie_essential_desc">Απαιτούνται για τη βασική λειτουργία του ιστότοπου: καλάθι αγορών, προτιμήσεις γλώσσας και εμφάνισης, καθώς και αποθήκευση των επιλογών σας σχετικά με τα cookies.</p>' +
      "    </li>" +
      '    <li class="cookie-settings__item">' +
      '      <label class="cookie-settings__toggle">' +
      '        <span class="cookie-settings__item-name" data-i18n="cookie_analytics_title">Cookies ανάλυσης</span>' +
      '        <input type="checkbox" id="cookie-analytics-toggle" />' +
      '        <span class="cookie-settings__switch" aria-hidden="true"></span>' +
      "      </label>" +
      '      <p class="cookie-settings__item-desc" data-i18n="cookie_analytics_desc">Μας επιτρέπουν να κατανοούμε, με ανώνυμο τρόπο, πώς χρησιμοποιείται ο ιστότοπος, ώστε να βελτιώνουμε συνεχώς την εμπειρία σας. Η ενεργοποίησή τους είναι προαιρετική.</p>' +
      "    </li>" +
      "  </ul>" +
      '  <div class="cookie-settings__actions">' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" data-cookie-refuse data-i18n="cookie_refuse">Απόρριψη μη απαραίτητων</button>' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" data-cookie-save data-i18n="cookie_save">Αποθήκευση επιλογών</button>' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--primary" data-cookie-accept-all data-i18n="cookie_accept_all">Αποδοχή όλων</button>' +
      "  </div>" +
      "</div>";

    document.body.appendChild(bannerEl);
    document.body.appendChild(settingsEl);

    bannerEl.querySelector("[data-cookie-accept]").addEventListener("click", function () {
      saveConsent({ analytics: true });
      hideAll();
    });

    bannerEl.querySelector("[data-cookie-manage]").addEventListener("click", openSettings);

    settingsEl.querySelector("[data-cookie-accept-all]").addEventListener("click", function () {
      var toggle = document.getElementById("cookie-analytics-toggle");
      if (toggle) toggle.checked = true;
      saveConsent({ analytics: true });
      hideAll();
    });

    settingsEl.querySelector("[data-cookie-refuse]").addEventListener("click", function () {
      var toggle = document.getElementById("cookie-analytics-toggle");
      if (toggle) toggle.checked = false;
      saveConsent({ analytics: false });
      hideAll();
    });

    settingsEl.querySelector("[data-cookie-save]").addEventListener("click", function () {
      var toggle = document.getElementById("cookie-analytics-toggle");
      saveConsent({ analytics: toggle ? toggle.checked : false });
      hideAll();
    });

    settingsEl.querySelectorAll("[data-cookie-settings-close]").forEach(function (el) {
      el.addEventListener("click", closeSettings);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (settingsEl && !settingsEl.hidden) closeSettings();
      }
    });
  }

  function applyI18n() {
    if (!window.NostalgiaI18n || !window.NostalgiaI18n.applyLang) return;
    window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
  }

  function showBanner() {
    ensureUI();
    applyI18n();
    bannerEl.hidden = false;
    document.body.classList.add("cookie-banner-open");
  }

  function hideAll() {
    if (bannerEl) bannerEl.hidden = true;
    if (settingsEl) settingsEl.hidden = true;
    document.body.classList.remove("cookie-banner-open", "cookie-settings-open");
  }

  function openSettings() {
    ensureUI();
    var consent = readConsent();
    var toggle = document.getElementById("cookie-analytics-toggle");
    if (toggle) toggle.checked = !!(consent && consent.analytics);
    if (bannerEl) bannerEl.hidden = true;
    settingsEl.hidden = false;
    document.body.classList.add("cookie-settings-open");
    applyI18n();
  }

  function closeSettings() {
    if (settingsEl) settingsEl.hidden = true;
    document.body.classList.remove("cookie-settings-open");
    if (shouldShowBanner() && bannerEl) {
      bannerEl.hidden = false;
      document.body.classList.add("cookie-banner-open");
    } else {
      hideAll();
    }
  }

  function init() {
    ensureUI();
    if (shouldShowBanner()) {
      window.setTimeout(showBanner, 600);
    }
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        applyI18n();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaCookies = {
    openSettings: openSettings,
    readConsent: readConsent,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
