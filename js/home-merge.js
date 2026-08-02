(function () {
  // Scroll-linked "merge": as the section scrolls, --merge-p goes 0 → 1, which
  // (via CSS) slides the statement DOWN and the image UP until they overlap.
  // Fully reversible — scrolling back up runs it in reverse.
  // Runs on the shared scroll bus (js/scroll-bus.js).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.NostalgiaScroll) return;

  var section = document.querySelector(".home-merge");
  if (!section) return;

  section.classList.add("home-merge--scrub");

  window.NostalgiaScroll.add(function (vh) {
    var rect = section.getBoundingClientRect();
    var total = section.offsetHeight - vh;
    if (total <= 0) {
      section.style.setProperty("--merge-p", "0");
      return;
    }
    var p = -rect.top / total;
    if (p < 0) p = 0;
    else if (p > 1) p = 1;
    section.style.setProperty("--merge-p", p.toFixed(4));
  });
})();
