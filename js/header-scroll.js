(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;

  var intro = document.getElementById("site-intro");
  var hero = document.querySelector(".hero-home");
  var lastY = window.scrollY || document.documentElement.scrollTop || 0;
  var minScroll = 56;
  var delta = 6;

  function introHeight() {
    if (!intro) return 0;
    if (document.documentElement.classList.contains("no-site-intro")) return 0;
    try {
      if (window.matchMedia("(max-width: 768px)").matches) return 0;
    } catch (e) {}
    var h = intro.offsetHeight || 0;
    return h > 0 ? h : 0;
  }

  function heroHeight() {
    return hero ? hero.offsetHeight || window.innerHeight || 0 : 0;
  }

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var dy = y - lastY;
    var keepVisibleUntil = introHeight() + (document.body.getAttribute("data-page") === "home" ? heroHeight() * 0.85 : 8);

    /* Don't auto-hide the header while the home intro/hero is still the active view. */
    if (y < Math.max(36, keepVisibleUntil)) {
      header.classList.remove("site-header--scroll-hidden");
    } else if (dy > delta && y > minScroll) {
      header.classList.add("site-header--scroll-hidden");
    } else if (dy < -delta) {
      header.classList.remove("site-header--scroll-hidden");
    }

    lastY = y;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
