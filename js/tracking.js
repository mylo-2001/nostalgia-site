/*
 * Nostalgia — consent-gated tracking loader.
 *
 * Scripts load ONLY after the visitor accepts the matching cookie category
 * (analytics → Google Analytics, marketing → Meta Pixel + Klaviyo). Nothing
 * loads until you fill in the IDs below AND the visitor consents.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Google Analytics 4 is configured from the server: set        │
 * │  GA_MEASUREMENT_ID in .env (single source of truth). The id    │
 * │  is fetched from /api/public-config at runtime — no need to    │
 * │  edit this file. Meta Pixel / Klaviyo (marketing) are still    │
 * │  filled in below (leave "" to keep a tool off).                │
 * └─────────────────────────────────────────────────────────────┘
 */
(function () {
  var CONFIG = {
    ga4: "",        // GA4 Measurement ID — normally left "" (comes from server / .env GA_MEASUREMENT_ID)
    metaPixel: "",  // Meta / Facebook Pixel — ID, e.g. "1234567890123456"
    klaviyo: "",    // Klaviyo — Public API key (company id), e.g. "ABC123"
  };

  var loaded = { ga: false, meta: false, klaviyo: false };

  function consent() {
    try {
      return (window.NostalgiaCookies && window.NostalgiaCookies.readConsent()) || {};
    } catch (e) {
      return {};
    }
  }

  /* ---- Google Analytics 4 (analytics) ---- */
  function loadGA() {
    if (loaded.ga || !CONFIG.ga4) return;
    loaded.ga = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.ga4);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.ga4, { anonymize_ip: true });
  }

  /* ---- Meta / Facebook Pixel (marketing) ---- */
  function loadMeta() {
    if (loaded.meta || !CONFIG.metaPixel) return;
    loaded.meta = true;
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CONFIG.metaPixel);
    window.fbq("track", "PageView");
  }

  /* ---- Klaviyo on-site (marketing) ---- */
  function loadKlaviyo() {
    if (loaded.klaviyo || !CONFIG.klaviyo) return;
    loaded.klaviyo = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=" + encodeURIComponent(CONFIG.klaviyo);
    document.head.appendChild(s);
  }

  function apply() {
    var c = consent();
    if (c.analytics) {
      if (CONFIG.ga4) window["ga-disable-" + CONFIG.ga4] = false;
      if (window.gtag) window.gtag("consent", "update", { analytics_storage: "granted" });
      loadGA();
    } else {
      if (CONFIG.ga4) window["ga-disable-" + CONFIG.ga4] = true;
      if (window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
    }
    if (c.marketing) {
      if (window.fbq) window.fbq("consent", "grant");
      loadMeta();
      loadKlaviyo();
    } else if (window.fbq) {
      window.fbq("consent", "revoke");
    }
  }

  /* Pull the GA4 Measurement ID from the server (.env GA_MEASUREMENT_ID) unless
     one was hardcoded above. Consent still gates whether GA actually loads. */
  function init() {
    fetch("/api/public-config", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok && !CONFIG.ga4 && data.gaMeasurementId) {
          CONFIG.ga4 = data.gaMeasurementId;
        }
      })
      .catch(function () {})
      .then(apply);
  }

  document.addEventListener("nostalgia-cookie-consent-set", apply);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.NostalgiaTracking = { apply: apply, config: CONFIG };
})();
