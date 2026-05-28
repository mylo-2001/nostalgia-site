(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;

  var lastY = window.scrollY || document.documentElement.scrollTop || 0;
  var minScroll = 56;
  var delta = 6;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var dy = y - lastY;

    if (y < 36) {
      header.classList.remove("site-header--scroll-hidden");
    } else if (dy > delta && y > minScroll) {
      header.classList.add("site-header--scroll-hidden");
    } else if (dy < -delta) {
      header.classList.remove("site-header--scroll-hidden");
    }

    lastY = y;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
})();
