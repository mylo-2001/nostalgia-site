(function () {
  /* One rAF-throttled scroll loop for every scroll-linked ("scrub") effect on
     the page — hero zoom, parallax layers, the merge section.

     Each of these used to bind its own scroll listener and run its own rAF,
     so a single scroll frame did three independent read/write passes over the
     layout. Batching them into one callback list means one rAF per frame and
     one shared viewport-height read.

     Subscribers receive the viewport height and must stay cheap: read
     geometry, write a CSS custom property or transform, return. */
  var subs = [];
  var ticking = false;

  function flush() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < subs.length; i++) {
      try {
        subs[i](vh);
      } catch (err) {
        /* one broken effect must not kill the rest of the loop */
        if (window.console && console.warn) console.warn("scroll-bus subscriber failed", err);
        subs.splice(i, 1);
        i -= 1;
      }
    }
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(flush);
  }

  window.NostalgiaScroll = {
    add: function (fn) {
      if (typeof fn !== "function") return;
      subs.push(fn);
      schedule();
    },
    update: schedule
  };

  /* Lenis drives the real window scroll, so the native scroll event fires
     throughout the inertial glide — no separate lenis.on("scroll") binding
     and no post-scroll "settle" frames are needed. */
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("load", schedule);
})();
