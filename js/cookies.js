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
      var parsed = raw ? JSON.parse(raw) : null;
      return consentExpired(parsed) ? null : parsed;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(data) {
    var previous = readConsent();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: !!data.analytics,
          marketing: !!data.marketing,
          timestamp: Date.now(),
        })
      );
    } catch (e) {}
    var revoked = !!(previous &&
      ((previous.analytics && !data.analytics) || (previous.marketing && !data.marketing)));
    document.dispatchEvent(new CustomEvent("nostalgia-cookie-consent-set", {
      detail: { analytics: !!data.analytics, marketing: !!data.marketing, revoked: revoked },
    }));
    if (revoked) {
      window.setTimeout(function () { window.location.reload(); }, 50);
    }
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
  var lastFocused;

  function focusDialog(root) {
    if (!root) return;
    if (!lastFocused ||
        !(bannerEl && bannerEl.contains(document.activeElement)) &&
        !(settingsEl && settingsEl.contains(document.activeElement))) {
      lastFocused = document.activeElement;
    }
    var first = root.querySelector("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (first) window.setTimeout(function () { first.focus(); }, 0);
  }

  function trapFocus(event, root) {
    if (event.key !== "Tab" || !root || root.hidden) return;
    var focusable = Array.prototype.filter.call(root.querySelectorAll(
      "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), " +
      "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"), function (element) {
        return element.offsetParent !== null;
      });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
      '<div class="cookie-banner__backdrop"></div>' +
      '<div class="cookie-banner__panel">' +
      '  <div class="cookie-banner__brand">' +
      '    <img class="cookie-banner__logo" src="logo/logo%20light.png?v=2" width="200" height="58" alt="Nostalgia Collection" />' +
      "  </div>" +
      '  <button type="button" class="cookie-banner__skip" data-cookie-continue-without data-i18n="cookie_continue_without">Συνέχεια χωρίς αποδοχή</button>' +
      '  <h2 class="cookie-banner__title" id="cookie-banner-title" data-i18n="cookie_banner_title">Καλώς ήρθατε στη Nostalgia Collection</h2>' +
      '  <p class="cookie-banner__text">' +
      '    <span data-i18n="cookie_banner_text">Η Nostalgia Collection χρησιμοποιεί cookies πρώτου και τρίτου μέρους, καθώς και παρόμοιες τεχνολογίες παρακολούθησης, για τη σωστή λειτουργία του ιστότοπου, την ανάλυση της επισκεψιμότητας και την εξατομίκευση της εμπειρίας σας.</span> ' +
      '    <a href="/privacy#cookies" data-i18n="cookie_privacy_policy">Πολιτική Απορρήτου</a>.' +
      "  </p>" +
      '  <div class="cookie-banner__actions">' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--secondary" data-cookie-manage data-i18n="cookie_manage">Διαχείριση cookies</button>' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--primary" data-cookie-accept data-i18n="cookie_accept_all">Αποδοχή όλων</button>' +
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
      '  <h2 class="cookie-settings__title" id="cookie-settings-title" data-i18n="cookie_settings_title">Κέντρο Προτιμήσεων Απορρήτου</h2>' +
      '  <p class="cookie-settings__lead">' +
      '    <span data-i18n="cookie_settings_lead">Χρησιμοποιούμε cookies για να βελτιώνουμε την εμπειρία σας, να αναλύουμε την επισκεψιμότητα και να εξατομικεύουμε το περιεχόμενο. Μπορείτε να επιλέξετε ποιες κατηγορίες επιθυμείτε να ενεργοποιήσετε.</span> ' +
      '    <a href="/privacy#cookies" data-i18n="cookie_more_info">Περισσότερες πληροφορίες</a>.' +
      "  </p>" +
      '  <button type="button" class="cookie-settings__allow-all" data-cookie-accept-all data-i18n="cookie_allow_all">Αποδοχή όλων</button>' +
      '  <h3 class="cookie-settings__section-title" data-i18n="cookie_manage_section">Διαχείριση προτιμήσεων</h3>' +
      '  <ul class="cookie-settings__list">' +
      '    <li class="cookie-settings__item">' +
      '      <details class="cookie-settings__accordion">' +
      '        <summary class="cookie-settings__summary">' +
      '          <span class="cookie-settings__chevron" aria-hidden="true">+</span>' +
      '          <span class="cookie-settings__item-name" data-i18n="cookie_essential_title">Απολύτως απαραίτητα</span>' +
      "        </summary>" +
      '        <p class="cookie-settings__item-desc" data-i18n="cookie_essential_desc">Απαιτούνται για τη βασική λειτουργία του ιστότοπου: καλάθι αγορών, προτιμήσεις γλώσσας και εμφάνισης, καθώς και αποθήκευση των επιλογών σας σχετικά με τα cookies.</p>' +
      "      </details>" +
      '      <span class="cookie-settings__badge" data-i18n="cookie_always_on">Πάντα ενεργά</span>' +
      "    </li>" +
      '    <li class="cookie-settings__item">' +
      '      <details class="cookie-settings__accordion">' +
      '        <summary class="cookie-settings__summary">' +
      '          <span class="cookie-settings__chevron" aria-hidden="true">+</span>' +
      '          <span class="cookie-settings__item-name" data-i18n="cookie_analytics_title">Cookies ανάλυσης</span>' +
      "        </summary>" +
      '        <p class="cookie-settings__item-desc" data-i18n="cookie_analytics_desc">Μας επιτρέπουν να κατανοούμε, με ανώνυμο τρόπο, πώς χρησιμοποιείται ο ιστότοπος, ώστε να βελτιώνουμε συνεχώς την εμπειρία σας. Η ενεργοποίησή τους είναι προαιρετική.</p>' +
      "      </details>" +
      '      <label class="cookie-settings__toggle">' +
      '        <input type="checkbox" id="cookie-analytics-toggle" />' +
      '        <span class="cookie-settings__switch" aria-hidden="true"></span>' +
      "      </label>" +
      "    </li>" +
      '    <li class="cookie-settings__item">' +
      '      <details class="cookie-settings__accordion">' +
      '        <summary class="cookie-settings__summary">' +
      '          <span class="cookie-settings__chevron" aria-hidden="true">+</span>' +
      '          <span class="cookie-settings__item-name" data-i18n="cookie_marketing_title">Cookies marketing</span>' +
      "        </summary>" +
      '        <p class="cookie-settings__item-desc" data-i18n="cookie_marketing_desc">Χρησιμοποιούνται για την προβολή σχετικών προσφορών και διαφημίσεων (π.χ. Meta Pixel, Klaviyo) και τη μέτρηση της αποτελεσματικότητάς τους. Η ενεργοποίησή τους είναι προαιρετική.</p>' +
      "      </details>" +
      '      <label class="cookie-settings__toggle">' +
      '        <input type="checkbox" id="cookie-marketing-toggle" />' +
      '        <span class="cookie-settings__switch" aria-hidden="true"></span>' +
      "      </label>" +
      "    </li>" +
      "  </ul>" +
      '  <div class="cookie-settings__actions">' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--outline" data-cookie-refuse data-i18n="cookie_reject_all">Απόρριψη όλων</button>' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--outline" data-cookie-save data-i18n="cookie_confirm_choices">Επιβεβαίωση επιλογών</button>' +
      "  </div>" +
      "</div>";

    document.body.appendChild(bannerEl);
    document.body.appendChild(settingsEl);

    bannerEl.querySelector("[data-cookie-accept]").addEventListener("click", function () {
      saveConsent({ analytics: true, marketing: true });
      hideAll();
    });

    bannerEl.querySelector("[data-cookie-manage]").addEventListener("click", openSettings);

    bannerEl.querySelector("[data-cookie-continue-without]").addEventListener("click", function () {
      saveConsent({ analytics: false, marketing: false });
      hideAll();
    });

    settingsEl.querySelector("[data-cookie-accept-all]").addEventListener("click", function () {
      var a = document.getElementById("cookie-analytics-toggle");
      var m = document.getElementById("cookie-marketing-toggle");
      if (a) a.checked = true;
      if (m) m.checked = true;
      saveConsent({ analytics: true, marketing: true });
      hideAll();
    });

    settingsEl.querySelector("[data-cookie-refuse]").addEventListener("click", function () {
      var a = document.getElementById("cookie-analytics-toggle");
      var m = document.getElementById("cookie-marketing-toggle");
      if (a) a.checked = false;
      if (m) m.checked = false;
      saveConsent({ analytics: false, marketing: false });
      hideAll();
    });

    settingsEl.querySelector("[data-cookie-save]").addEventListener("click", function () {
      var a = document.getElementById("cookie-analytics-toggle");
      var m = document.getElementById("cookie-marketing-toggle");
      saveConsent({
        analytics: a ? a.checked : false,
        marketing: m ? m.checked : false,
      });
      hideAll();
    });

    settingsEl.querySelectorAll("[data-cookie-settings-close]").forEach(function (el) {
      el.addEventListener("click", closeSettings);
    });

    document.addEventListener("keydown", function (e) {
      trapFocus(e, settingsEl && !settingsEl.hidden ? settingsEl : bannerEl);
      if (e.key === "Escape") {
        if (settingsEl && !settingsEl.hidden) closeSettings();
        else if (bannerEl && !bannerEl.hidden) closeSettings();
      }
    });
  }

  function applyCookieI18nOnly() {
    if (!window.NostalgiaI18n) return;
    [bannerEl, settingsEl].forEach(function (root) {
      if (!root) return;
      root.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (!key) return;
        var val = t(key);
        if (val != null && val !== key) el.textContent = val;
      });
    });
  }

  function applyI18n() {
    applyCookieI18nOnly();
  }

  function showBanner() {
    ensureUI();
    applyI18n();
    bannerEl.hidden = false;
    document.body.classList.add("cookie-banner-open");
    focusDialog(bannerEl);
  }

  function hideAll() {
    if (bannerEl) bannerEl.hidden = true;
    if (settingsEl) settingsEl.hidden = true;
    document.body.classList.remove("cookie-banner-open", "cookie-settings-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function openSettings() {
    ensureUI();
    var consent = readConsent();
    var toggle = document.getElementById("cookie-analytics-toggle");
    if (toggle) toggle.checked = !!(consent && consent.analytics);
    var mtoggle = document.getElementById("cookie-marketing-toggle");
    if (mtoggle) mtoggle.checked = !!(consent && consent.marketing);
    if (bannerEl) bannerEl.hidden = true;
    settingsEl.hidden = false;
    document.body.classList.remove("cookie-banner-open");
    document.body.classList.add("cookie-settings-open");
    applyI18n();
    focusDialog(settingsEl);
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
