(function () {
  /* Scroll-reveal for .home-reveal / .site-reveal elements.

     Uses IntersectionObserver. (It previously ran a getBoundingClientRect
     sweep on a scroll-driven rAF loop, because the page used to move its
     content with a CSS transform — IO does not fire for transform-based
     movement. That wrapper is gone; Lenis now drives the real window scroll,
     so IO is both correct and far cheaper.) */
  var SEL = ".home-reveal, .site-reveal";
  var observer = null;

  function reveal(el) {
    el.classList.add("is-visible");
  }

  function revealAll() {
    var found = document.querySelectorAll(SEL);
    for (var i = 0; i < found.length; i++) reveal(found[i]);
  }

  /* Elements that carry a data-motion-* attribute are driven by home-motion.js;
     running the CSS reveal on them too would mean two competing transitions on
     one element. Note this checks the element itself, not its ancestors — a
     section can opt into a GSAP entrance while individual children inside it
     (e.g. .home-retail__frame, which has its own bespoke glow/gleam keyframes
     keyed on .is-visible) keep the class-based reveal. */
  var MOTION_ATTRS = ["data-motion-line", "data-motion-copy", "data-motion-item", "data-motion-media"];

  function claimedByMotion(el) {
    for (var i = 0; i < MOTION_ATTRS.length; i++) {
      if (el.hasAttribute(MOTION_ATTRS[i])) return true;
    }
    return false;
  }

  function observeAll() {
    var found = document.querySelectorAll(SEL);
    for (var i = 0; i < found.length; i++) {
      var el = found[i];
      if (el.classList.contains("is-visible") || el.__revealObserved) continue;
      if (claimedByMotion(el)) continue;
      el.__revealObserved = true;
      observer.observe(el);
    }
  }

  function init() {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof window.IntersectionObserver !== "function"
    ) {
      revealAll();
      return;
    }

    observer = new window.IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          reveal(entries[i].target);
          observer.unobserve(entries[i].target);
        }
      },
      {
        /* fire once the element's top edge crosses ~90% of the viewport —
           matches the old sweep threshold */
        rootMargin: "0px 0px -10% 0px",
        threshold: 0
      }
    );

    observeAll();

    /* products render asynchronously; pick up whatever they added */
    document.addEventListener("nostalgia-products-updated", observeAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
