(function () {
  var STORAGE_KEY = "nostalgia-cookie-consent";
  var VISITOR_KEY = "nostalgia-visitor-id";
  var CONSENT_DAYS = 365;
  /* Bump whenever the banner wording or the categories change, so the stored
     records stay honest about what each visitor was actually shown. */
  var POLICY_VERSION = "2026-08-06";

  /* A random id this browser gives itself. Not derived from anything about the
     person and never tied to an account — it exists only so a consent record
     can be matched to the browser that produced it if the choice is ever
     disputed. */
  function visitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      var id;
      if (window.crypto && window.crypto.randomUUID) {
        id = window.crypto.randomUUID();
      } else {
        id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
      }
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    } catch (e) {
      return "";
    }
  }

  /* Mirrors the choice to the server so we can demonstrate consent later
     (GDPR art. 7(1)) — localStorage alone is the visitor's copy, not ours.
     Fire-and-forget with keepalive: a banner click is often followed
     immediately by a navigation, and the record must survive it. Failure here
     must never block the visitor's choice from taking effect locally. */
  function recordConsent(data, source) {
    var id = visitorId();
    if (!id) return;
    try {
      fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: id,
          analytics: !!data.analytics,
          marketing: !!data.marketing,
          policyVersion: POLICY_VERSION,
          source: source || "banner",
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  /* Simple line-style cookie icon (currentColor) — no emoji. */
  var COOKIE_ICON =
    '<svg class="cookie-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M20.5 12.8a8.5 8.5 0 11-9.3-9.3c-.15.9.55 1.75 1.5 1.75a2 2 0 002-2c0-.2-.02-.4-.06-.58A8.5 8.5 0 0120.5 12.8z" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="9" cy="9.5" r="1.15" fill="currentColor"/>' +
    '<circle cx="14.5" cy="8.5" r="1.15" fill="currentColor"/>' +
    '<circle cx="8.5" cy="14.5" r="1.15" fill="currentColor"/>' +
    '<circle cx="13.5" cy="15.5" r="1.15" fill="currentColor"/>' +
    '<circle cx="16" cy="12" r="1.15" fill="currentColor"/>' +
    "</svg>";

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
    /* "settings" when they are changing an earlier answer, "revoked" when that
        change withdraws something — the distinction is what makes the log
        readable as a history rather than a pile of rows. */
    recordConsent(data, revoked ? "revoked" : previous ? "settings" : "banner");
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
      '    <img class="cookie-banner__logo" src="images/logo/logo%20light.png?v=2" width="200" height="58" alt="Nostalgia Collection" />' +
      "  </div>" +
      '  <h2 class="cookie-banner__title" id="cookie-banner-title">' + COOKIE_ICON +
      '<span data-i18n="cookie_banner_title">Καλώς ήρθατε στη Nostalgia Collection</span></h2>' +
      '  <p class="cookie-banner__text">' +
      '    <span data-i18n="cookie_banner_text">Η Nostalgia Collection χρησιμοποιεί cookies πρώτου και τρίτου μέρους, καθώς και παρόμοιες τεχνολογίες παρακολούθησης, για τη σωστή λειτουργία του ιστότοπου, την ανάλυση της επισκεψιμότητας και την εξατομίκευση της εμπειρίας σας.</span> ' +
      '    <a href="/privacy#cookies" data-i18n="cookie_privacy_policy">Πολιτική Απορρήτου</a>.' +
      "  </p>" +
      '  <div class="cookie-banner__actions">' +
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--secondary" data-cookie-continue-without data-i18n="cookie_reject_all">Αποδοχή μόνο των απαραίτητων</button>' +
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
      '  <h2 class="cookie-settings__title" id="cookie-settings-title">' + COOKIE_ICON +
      '<span data-i18n="cookie_settings_title">Κέντρο Προτιμήσεων Απορρήτου</span></h2>' +
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
      '        <p class="cookie-settings__item-desc" data-i18n="cookie_analytics_desc">Μας επιτρέπουν να κατανοούμε, με ψευδωνυμοποιημένη μέτρηση, πώς χρησιμοποιείται ο ιστότοπος, ώστε να βελτιώνουμε συνεχώς την εμπειρία σας. Η ενεργοποίησή τους είναι προαιρετική.</p>' +
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
      '    <button type="button" class="cookie-banner__btn cookie-banner__btn--outline" data-cookie-refuse data-i18n="cookie_reject_all">Αποδοχή μόνο των απαραίτητων</button>' +
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
