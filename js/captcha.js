/*
 * Cloudflare Turnstile helper — entirely optional.
 *
 * If the backend has no TURNSTILE_SITE_KEY configured, `isEnabled()` stays
 * false, `mount()` is a no-op and `getToken()` returns "" — so every login /
 * register form works exactly as before. The moment a site key is set in the
 * environment, widgets render and tokens are collected automatically.
 */
(function () {
  "use strict";

  var siteKey = null;
  var scriptPromise = null;

  var readyPromise = fetch("/api/public-config", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      siteKey = (d && d.turnstileSiteKey) || null;
      if (siteKey) loadScript();
      return siteKey;
    })
    .catch(function () { return null; });

  function loadScript() {
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  function whenReady(cb) {
    if (window.turnstile && window.turnstile.render) return cb();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.turnstile && window.turnstile.render) {
        clearInterval(timer);
        cb();
      } else if (tries > 80) {
        clearInterval(timer); /* ~8s — give up quietly */
      }
    }, 100);
  }

  window.NostalgiaCaptcha = {
    ready: function () { return readyPromise; },
    isEnabled: function () { return !!siteKey; },

    /* Render a widget into `container` (an empty element). Returns a handle
       to pass to getToken()/reset(). Safe to call when disabled or before the
       site key has loaded — rendering is deferred until the config fetch and
       the Turnstile script are both ready. */
    mount: function (container) {
      var handle = { widgetId: null, token: "" };
      if (!container) return handle;
      readyPromise.then(function (key) {
        if (!key) return; // CAPTCHA disabled (no site key configured)
        loadScript().then(function () {
          whenReady(function () {
            /* The config fetch and the script load both take a moment, and the
               panel can be rebuilt in the meantime. Without this the widget
               renders into an element that has already been discarded — and
               since it has no id yet, remove() had nothing to clean up. */
            if (handle.cancelled || !container.isConnected) return;
            try {
              handle.widgetId = window.turnstile.render(container, {
                sitekey: key,
                callback: function (tok) { handle.token = tok; },
                "error-callback": function () { handle.token = ""; },
                "expired-callback": function () { handle.token = ""; },
              });
            } catch (e) { /* already rendered / invalid container */ }
          });
        });
      });
      return handle;
    },

    getToken: function (handle) {
      if (handle && handle.token) return handle.token;
      try {
        if (handle && handle.widgetId != null && window.turnstile) {
          return window.turnstile.getResponse(handle.widgetId) || "";
        }
      } catch (e) {}
      return "";
    },

    reset: function (handle) {
      try {
        if (handle && handle.widgetId != null && window.turnstile) {
          window.turnstile.reset(handle.widgetId);
        }
      } catch (e) {}
      if (handle) handle.token = "";
    },

    /* Call before the container is thrown away. Turnstile keeps its own
       registry of widgets and goes on polling for one whose element has been
       removed — which is what fills the console with "Cannot find Widget
       cf-chl-widget-…". Every re-render leaks another one. */
    remove: function (handle) {
      if (!handle) return;
      /* Set first: a mount that has not resolved yet has no widgetId to remove,
         so the only way to stop it is to tell it not to render at all. */
      handle.cancelled = true;
      try {
        if (handle.widgetId != null && window.turnstile && window.turnstile.remove) {
          window.turnstile.remove(handle.widgetId);
        }
      } catch (e) {}
      handle.widgetId = null;
      handle.token = "";
    },
  };
})();
