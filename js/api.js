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

  function probe() {
    return fetch("/api/health", { method: "GET", cache: "no-store" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        available = !!(data && data.ok);
        return available;
      })
      .catch(function () {
        available = false;
        return false;
      });
  }

  var readyPromise = probe();

  function request(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
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
    post: function (path, body) {
      return request("POST", path, body || {});
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
