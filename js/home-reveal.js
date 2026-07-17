(function () {
  /* Scroll-reveal for .home-reveal / .site-reveal elements.

     NOTE: this deliberately uses getBoundingClientRect() on a scroll-driven
     loop instead of IntersectionObserver. The home page moves its content with
     a CSS transform (inertial/curtain scroll), and IntersectionObserver does
     NOT reliably fire for transform-based movement — which left every below-the
     -fold section stuck at opacity:0. getBoundingClientRect() reflects the live
     transform, so this works for both native and transform scrolling. */
  var SEL = ".home-reveal, .site-reveal";
  var els = [];
  var ticking = false;
  var settleFrames = 0;

  function collect() {
    var found = document.querySelectorAll(SEL);
    for (var i = 0; i < found.length; i++) {
      var el = found[i];
      if (!el.classList.contains("is-visible") && els.indexOf(el) === -1) {
        els.push(el);
      }
    }
  }

  function revealAll() {
    collect();
    for (var i = 0; i < els.length; i++) els[i].classList.add("is-visible");
    els = [];
  }

  function sweep() {
    if (!els.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var remaining = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var r = el.getBoundingClientRect();
      /* reveal once the top edge crosses ~90% of the viewport (and it hasn't
         already scrolled fully past the top) */
      if (r.top < vh * 0.9 && r.bottom > -40) {
        el.classList.add("is-visible");
      } else {
        remaining.push(el);
      }
    }
    els = remaining;
  }

  function tick() {
    ticking = false;
    sweep();
    if (els.length && settleFrames > 0) {
      settleFrames -= 1;
      schedule();
    }
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(tick);
  }

  /* Each scroll keeps the loop alive for ~0.8s so the inertial "settle" (the
     content easing to a stop after you release) still triggers reveals. */
  function onScroll() {
    settleFrames = 48;
    schedule();
  }

  function init() {
    collect();

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      revealAll();
      return;
    }

    sweep();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("load", onScroll);
    document.addEventListener("nostalgia-products-updated", function () {
      collect();
      onScroll();
    });
    if (window.__lenis && typeof window.__lenis.on === "function") {
      window.__lenis.on("scroll", onScroll);
    }

    /* initial watchdog — catches late layout shifts (fonts, images, the
       inertial wrapper mounting) without waiting for the first scroll */
    settleFrames = 90;
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
