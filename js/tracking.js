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
  /* All three come from the server (.env) — leave them "" here. A hardcoded id
     would ship in the bundle and could then only be changed by editing and
     redeploying this file, which is exactly what made Klaviyo impossible to
     switch off without a code change. */
  var CONFIG = {
    ga4: "",        // ← .env GA_MEASUREMENT_ID
    metaPixel: "",  // ← .env META_PIXEL_ID
    klaviyo: "",    // ← .env KLAVIYO_COMPANY_ID
  };

  var loaded = { ga: false, meta: false, klaviyo: false };

  function expireCookie(name) {
    var expires = "=; Max-Age=0; path=/; SameSite=Lax";
    document.cookie = name + expires;
    var parts = window.location.hostname.split(".");
    if (parts.length > 1) document.cookie = name + expires + "; domain=." + parts.slice(-2).join(".");
  }

  function clearOptionalTrackingStorage(category) {
    String(document.cookie || "").split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      var analytics = /^(_ga|_gid|_gat)/.test(name);
      var marketing = /^(_fbp|_fbc|__kla)/.test(name);
      if ((category === "analytics" && analytics) || (category === "marketing" && marketing)) {
        expireCookie(name);
      }
    });
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i) || "";
        var analyticsKey = /^_ga/i.test(key);
        var marketingKey = /^(klaviyo|__kla|_fbp)/i.test(key);
        if ((category === "analytics" && analyticsKey) || (category === "marketing" && marketingKey)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }

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
      clearOptionalTrackingStorage("analytics");
    }
    if (c.marketing) {
      if (window.fbq) window.fbq("consent", "grant");
      loadMeta();
      loadKlaviyo();
    } else if (window.fbq) {
      window.fbq("consent", "revoke");
    }
    if (!c.marketing) clearOptionalTrackingStorage("marketing");
  }

  /* Pull every tracker id from the server (.env) unless one was hardcoded
     above. Consent still gates whether anything actually loads — this only
     decides which tools exist at all. */
  function init() {
    fetch("/api/public-config", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) return;
        if (!CONFIG.ga4 && data.gaMeasurementId) CONFIG.ga4 = data.gaMeasurementId;
        if (!CONFIG.klaviyo && data.klaviyoCompanyId) CONFIG.klaviyo = data.klaviyoCompanyId;
        if (!CONFIG.metaPixel && data.metaPixelId) CONFIG.metaPixel = data.metaPixelId;
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
