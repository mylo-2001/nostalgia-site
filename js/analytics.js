(function () {
  var loaded = false;
  var measurementId = null;

  function readConsent() {
    try {
      var raw = localStorage.getItem("nostalgia-cookie-consent");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function analyticsAllowed() {
    var consent = readConsent();
    return !!(consent && consent.analytics);
  }

  function loadGtag(id) {
    if (loaded || !id) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip: true });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function tryInit() {
    if (!measurementId || !analyticsAllowed()) return;
    loadGtag(measurementId);
  }

  function fetchConfig() {
    fetch("/api/public-config")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        measurementId = data.gaMeasurementId || null;
        tryInit();
      })
      .catch(function () {});
  }

  document.addEventListener("nostalgia-cookie-consent-set", tryInit);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchConfig);
  } else {
    fetchConfig();
  }
})();
