(function () {
  // Scroll-linked "merge": as the section scrolls, --merge-p goes 0 → 1, which
  // (via CSS) slides the statement DOWN and the image UP until they overlap.
  // Fully reversible — scrolling back up runs it in reverse.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var section = document.querySelector(".home-merge");
  if (!section) return;

  section.classList.add("home-merge--scrub");

  var ticking = false;

  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var total = section.offsetHeight - vh;
    if (total <= 0) {
      section.style.setProperty("--merge-p", "0");
      return;
    }
    var p = -rect.top / total;
    if (p < 0) p = 0;
    else if (p > 1) p = 1;
    section.style.setProperty("--merge-p", p.toFixed(4));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();
