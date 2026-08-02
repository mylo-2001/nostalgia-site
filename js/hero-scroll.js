(function () {
  // Dramatic, unmistakable hero scroll effect (Aupale / Apple style):
  // as you scroll away from the hero, the image zooms in and the headline
  // lifts up and fades out. Full-screen, so it is impossible to miss.
  // Runs on the shared scroll bus (js/scroll-bus.js).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.NostalgiaScroll) return;

  var hero = document.querySelector(".hero-home");
  if (!hero) return;
  var media = hero.querySelector(".hero-home__media");
  var inner = hero.querySelector(".hero-home__inner");
  if (!media && !inner) return;
  var isHome = document.body && document.body.getAttribute("data-page") === "home";

  window.NostalgiaScroll.add(function () {
    var h = hero.offsetHeight || window.innerHeight;

    // While the intro overlay is still the active view, leave the hero alone.
    if (isHome && !document.body.classList.contains("intro-past")) {
      if (media) media.style.transform = "";
      if (inner) {
        inner.style.transform = "";
        inner.style.opacity = "";
      }
      return;
    }

    // Progress relative to the hero's own position (works no matter what sits
    // above it — e.g. the intro section), not the absolute scroll offset.
    var scrolledPast = -hero.getBoundingClientRect().top;

    // Progress 0 → 1 over (most of) one hero height.
    var p = scrolledPast / (h * 0.9);
    if (p < 0) p = 0;
    else if (p > 1) p = 1;

    if (media) {
      // Strong zoom — clearly visible.
      media.style.transform = "scale(" + (1 + p * 0.22).toFixed(3) + ")";
    }
    if (inner) {
      inner.style.transform = "translate3d(0," + (-(p * 140)).toFixed(1) + "px,0)";
      inner.style.opacity = (1 - p * 1.25 < 0 ? 0 : 1 - p * 1.25).toFixed(3);
    }
  });
})();
