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
    /* Default is always light. Dark only if the visitor chose it. */
    document.documentElement.setAttribute(
      "data-theme",
      t === "dark" ? "dark" : "light"
    );
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
  try {
    var l = localStorage.getItem("nostalgia-lang");
    if (l === "en" || l === "el") {
      document.documentElement.lang = l;
    }
  } catch (e) {}
  /* Temporarily hide curtain until home JS scrolls past it on return visits. */
  try {
    if (sessionStorage.getItem("nostalgia-intro-seen") === "1") {
      document.documentElement.classList.add("intro-resume");
    }
  } catch (e) {}
})();
