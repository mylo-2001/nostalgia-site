(function () {
  // Lenis inertia/smooth scroll — the foundation of the "premium" scroll feel.
  // Drives the real window scroll, so IntersectionObserver reveals, the parallax
  // layers, the sticky header and back-to-top all keep working unchanged.
  if (typeof window.Lenis === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var lenis = new window.Lenis({
    lerp: 0.09, // lower = smoother/heavier glide
    smoothWheel: true,
    wheelMultiplier: 1
    // smoothTouch stays off (default): native touch scroll feels better on phones.
  });
  window.__lenis = lenis;

  // ScrollTrigger must be told when Lenis moves, and must drive Lenis' rAF
  // instead of running a second loop of its own. Without this, triggers read a
  // stale scroll position and scrubbed animations lag a frame behind.
  var st = window.ScrollTrigger;
  if (st && window.gsap) {
    lenis.on("scroll", st.update);
    window.gsap.ticker.add(function (time) {
      lenis.raf(time * 1000); // gsap ticker is seconds, lenis wants ms
    });
    window.gsap.ticker.lagSmoothing(0);
  } else {
    function raf(time) {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    }
    window.requestAnimationFrame(raf);
  }

  // Route existing programmatic smooth scrolls (e.g. back-to-top in theme.js)
  // through Lenis so they glide instead of fighting it.
  var nativeScrollTo = window.scrollTo.bind(window);
  window.scrollTo = function (x, y) {
    if (x && typeof x === "object") {
      if (x.behavior === "smooth") {
        lenis.scrollTo(typeof x.top === "number" ? x.top : 0);
        return;
      }
      return nativeScrollTo(x);
    }
    return nativeScrollTo(x, y);
  };

  // Smooth in-page anchor links (#section), offset for the fixed header.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute("href");
    if (!hash || hash.length < 2) return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80 });
  });
})();
