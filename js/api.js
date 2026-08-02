(function () {
  /**
   * Nostalgia API client.
   * If the backend (server/server.js) is running, the site uses it for
   * accounts, orders, newsletter, contact and live stock. If not, every
   * feature silently falls back to the old localStorage/mailto behaviour,
   * so the static site keeps working on its own.
   */

  var SESSION_KEY = "nostalgia-session";
  var available = null; // null = unknown, true/false once probed

  function healthCheck() {
    return fetch("/api/health", { method: "GET", cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        return !!(data && data.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function probe() {
    return healthCheck().then(function (ok) {
      if (ok) {
        available = true;
        return true;
      }
      // A failed first check could mean "no backend at all" (static
      // preview) or just one dropped request against a real, running
      // backend. Retry once before deciding — this is the only signal
      // registerUser/loginUser use to allow the weak localStorage-only
      // fallback login, so a single network blip must never be enough
      // to switch a live site into that mode.
      return new Promise(function (resolve) {
        setTimeout(function () {
          healthCheck().then(function (ok2) {
            available = ok2;
            resolve(ok2);
          });
        }, 800);
      });
    });
  }

  var readyPromise = probe();

  function request(method, path, body, customHeaders) {
    /** @type {Record<string, string>} */
    var headers = {};
    if (body) headers["Content-Type"] = "application/json";
    Object.keys(customHeaders || {}).forEach(function (key) {
      headers[key] = customHeaders[key];
    });
    return fetch(path, {
      method: method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    }).then(function (res) {
      return res.json().then(function (data) {
        data = data || {};
        data.status = res.status;
        return data;
      });
    });
  }

  function syncSession() {
    return request("GET", "/api/auth/me")
      .then(function (data) {
        if (!data.ok) return null;
        try {
          if (data.user) {
            localStorage.setItem(
              SESSION_KEY,
              JSON.stringify({
                email: data.user.email,
                firstname: data.user.firstname,
                lastname: data.user.lastname,
              })
            );
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        } catch (e) {}
        document.dispatchEvent(
          new CustomEvent("nostalgia-api-session", { detail: data.user || null })
        );
        return data.user || null;
      })
      .catch(function () {
        return null;
      });
  }

  function syncCatalog() {
    return request("GET", "/api/catalog")
      .then(function (data) {
        if (!data.ok) return;
        function apply() {
          if (
            window.NostalgiaProducts &&
            typeof window.NostalgiaProducts.applyServerCatalog === "function"
          ) {
            window.NostalgiaProducts.applyServerCatalog(data);
            return true;
          }
          return false;
        }
        if (!apply()) {
          document.addEventListener("DOMContentLoaded", apply);
        }
      })
      .catch(function () {});
  }

  readyPromise.then(function (ok) {
    if (!ok) return;
    syncSession();
    syncCatalog();
  });

  window.NostalgiaAPI = {
    /** Resolves true/false once the backend has been probed. */
    ready: function () {
      return readyPromise;
    },
    isAvailable: function () {
      return available === true;
    },
    get: function (path) {
      return request("GET", path);
    },
    getWithHeaders: function (path, headers) {
      return request("GET", path, null, headers || {});
    },
    post: function (path, body) {
      return request("POST", path, body || {});
    },
    postWithHeaders: function (path, body, headers) {
      return request("POST", path, body || {}, headers || {});
    },
    patch: function (path, body) {
      return request("PATCH", path, body || {});
    },
    put: function (path, body) {
      return request("PUT", path, body || {});
    },
    syncSession: syncSession,
  };
})();
