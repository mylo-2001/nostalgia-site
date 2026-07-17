(function () {
  /* Hero slideshow: auto-advance + dot navigation with progress ring. */
  var AUTOPLAY_MS = 6000;

  function init() {
    var root = document.getElementById("hero-slider");
    if (!root) return;
    var track = root.querySelector("[data-hero-track]");
    var slides = track ? Array.prototype.slice.call(track.children) : [];
    var dotsWrap = document.querySelector("[data-hero-dots]");
    if (!track || slides.length < 2 || !dotsWrap) return;

    var index = 0;
    var timer = null;

    var RING =
      '<svg class="hero-slider__dot-ring" viewBox="0 0 28 28" aria-hidden="true">' +
      '<circle cx="14" cy="14" r="11"></circle></svg>';

    var dots = slides.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hero-slider__dot";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Slide " + (i + 1));
      b.innerHTML = RING;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        goTo(i, true);
      });
      dotsWrap.appendChild(b);
      return b;
    });

    function apply(pct, animate) {
      track.style.transition = animate ? "" : "none";
      track.style.transform = "translate3d(" + pct + "%, 0, 0)";
    }

    function restartRing() {
      var d = dots[index];
      var ring = d && d.querySelector(".hero-slider__dot-ring circle");
      if (!ring) return;
      ring.style.animation = "none";
      void ring.getBoundingClientRect();
      ring.style.animation = "";
    }

    function render(animate) {
      apply(-index * 100, animate !== false);
      dots.forEach(function (d, i) {
        var active = i === index;
        d.classList.toggle("is-active", active);
        d.setAttribute("aria-selected", active ? "true" : "false");
      });
      slides.forEach(function (s, i) {
        var active = i === index;
        s.classList.toggle("is-active", active);
        var vid = s.querySelector("video");
        if (vid) {
          if (active) {
            stop();
            try {
              vid.currentTime = 0;
            } catch (e) {}
            var pr = vid.play();
            if (pr && pr.catch) pr.catch(function () { start(); });
          } else {
            vid.pause();
          }
        }
      });
      restartRing();
    }

    function goTo(i, manual) {
      index = (i + slides.length) % slides.length;
      render(true);
      if (manual) restart();
    }

    function next() {
      goTo(index + 1);
    }

    function start() {
      dotsWrap.classList.remove("is-paused");
      if (timer) return;
      timer = window.setInterval(next, AUTOPLAY_MS);
    }

    function stop() {
      dotsWrap.classList.add("is-paused");
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function restart() {
      stop();
      start();
    }

    track.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    slides.forEach(function (s) {
      var vid = s.querySelector("video");
      if (vid) {
        vid.addEventListener("ended", function () {
          next();
          start();
        });
      }
    });

    render(false);

    /* Keep the second door panel as a still full-bleed image until the intro
       has settled — matches Mad et Len (no carousel during the door). */
    function doorOpen() {
      return !document.getElementById("site-intro") || document.body.classList.contains("intro-past");
    }

    function syncDoor() {
      if (doorOpen()) start();
      else {
        stop();
        if (index !== 0) goTo(0, true);
      }
    }

    window.addEventListener("scroll", syncDoor, { passive: true });
    if (window.__lenis && typeof window.__lenis.on === "function") {
      window.__lenis.on("scroll", syncDoor);
    }
    syncDoor();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
