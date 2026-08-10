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
  /* Intro curtain: only the first landing on home in a session.
     Any other page (or return to home) skips it. */
  try {
    var mobileNoIntro = window.matchMedia("(max-width: 768px)").matches;
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var isHome =
      path === "/" ||
      path === "/index.html" ||
      path.endsWith("/html/index.html");
    if (!isHome) {
      sessionStorage.setItem("nostalgia-intro-seen", "1");
    }
    if (mobileNoIntro) {
      document.documentElement.classList.add("no-site-intro");
    } else if (sessionStorage.getItem("nostalgia-intro-seen") === "1") {
      document.documentElement.classList.add("intro-resume");
      document.documentElement.classList.add("intro-skipped");
    }
  } catch (e) {}
  /* Arms the pre-paint hidden state for [data-motion] sections so GSAP can
     animate them in without a flash of finished content. Never armed under
     reduced-motion; home-motion.js disarms it if GSAP fails to load, so the
     content can never stay stuck invisible. */
  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.classList.add("has-motion");
    }
  } catch (e) {}
})();
