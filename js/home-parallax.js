(function () {
  // Scroll-linked parallax for the home page. Two kinds of layers:
  //   1) The About banner photo — edge-safe, clamped within its over-scale.
  //   2) Generic [data-parallax-speed] layers — speed-based drift for depth
  //      (e.g. the home-moment centerpiece moving slower than the text columns).
  // One rAF-throttled scroll loop drives both. Disabled under reduced-motion;
  // the heavier generic layers are also skipped on small/touch screens.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var isSmall = window.matchMedia("(max-width: 760px)").matches;

  // --- About banner (always on; lightweight, single element) ---------------
  var aboutImg = document.querySelector(".home-about__photo img");
  var aboutFrame = aboutImg ? aboutImg.parentElement : null;
  var ABOUT_SCALE = 1.12;

  // --- Generic depth layers (off on small screens to avoid scroll jank) ----
  var layers = [];
  if (!isSmall) {
    var nodes = document.querySelectorAll("[data-parallax-speed]");
    for (var i = 0; i < nodes.length; i++) {
      var speed = parseFloat(nodes[i].getAttribute("data-parallax-speed"));
      if (!speed) continue;
      layers.push({ el: nodes[i], speed: speed });
    }
  }

  if (!aboutFrame && layers.length === 0) return;

  var vh = window.innerHeight || document.documentElement.clientHeight;
  var MAX_SHIFT = 80; // px — cap so big layers never drift off their frame
  var ticking = false;
  var settleFrames = 0;

  function update() {
    ticking = false;

    if (aboutFrame) {
      var r = aboutFrame.getBoundingClientRect();
      if (r.bottom > -40 && r.top < vh + 40) {
        var h = r.height;
        var headroom = ((ABOUT_SCALE - 1) / 2) * h; // px of slack each side
        var center = r.top + h / 2;
        var prog = (vh / 2 - center) / (vh / 2 + h / 2);
        if (prog > 1) prog = 1;
        else if (prog < -1) prog = -1;
        aboutImg.style.setProperty("--parallax-y", (prog * headroom).toFixed(1) + "px");
      }
    }

    for (var j = 0; j < layers.length; j++) {
      var lr = layers[j].el.getBoundingClientRect();
      if (lr.bottom < -160 || lr.top > vh + 160) continue;
      // Offset of the layer's centre from the viewport centre, scaled by speed,
      // then clamped so tall layers still drift visibly without ever clipping.
      var off = lr.top + lr.height / 2 - vh / 2;
      var y = off * layers[j].speed;
      if (y > MAX_SHIFT) y = MAX_SHIFT;
      else if (y < -MAX_SHIFT) y = -MAX_SHIFT;
      layers[j].el.style.setProperty("--parallax-y", y.toFixed(1) + "px");
    }

    /* keep updating through the inertial ease-out after the last scroll event
       (the content keeps transforming for a moment after you release) */
    if (settleFrames > 0) {
      settleFrames -= 1;
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  function onScroll() {
    settleFrames = 40;
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  if (window.__lenis && typeof window.__lenis.on === "function") {
    window.__lenis.on("scroll", onScroll);
  }
  window.addEventListener(
    "resize",
    function () {
      vh = window.innerHeight || document.documentElement.clientHeight;
      onScroll();
    },
    { passive: true }
  );

  update();
})();
