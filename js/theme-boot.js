/**
 * Anti-FOUC boot script — sets the theme + language on <html> before first paint
 * so there is no flash of the wrong theme. Must load as a SYNCHRONOUS classic
 * script in <head> (no defer/async), and stay external so the Content-Security-Policy
 * can forbid inline scripts (script-src 'self', no 'unsafe-inline').
 */
(function () {
  // Clear any stale page-transition state (e.g. after a bfcache restore).
  // No-op on a fresh load; mirrors the cleanup in site-polish.js.
  try {
    document.documentElement.classList.remove("page-is-leaving", "page-is-entering");
  } catch (e) {}
  try {
    var t = localStorage.getItem("nostalgia-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
  try {
    var l = localStorage.getItem("nostalgia-lang");
    if (l === "en" || l === "el") {
      document.documentElement.lang = l;
    }
  } catch (e) {}
})();
