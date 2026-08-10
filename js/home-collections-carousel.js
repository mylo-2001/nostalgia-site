/*
 * Shared home carousels — collections categories, bestsellers, Diffusers/Perfume.
 * Same swipe + dots behaviour; each root sets its own per-view breakpoints.
 */
(function () {
  "use strict";

  var instances = {};

  function perViewCollections(w) {
    if (w <= 640) return 1;
    if (w <= 900) return 2;
    if (w <= 1200) return 3;
    return 4;
  }

  function perViewBestsellers(w) {
    if (w <= 640) return 1;
    if (w <= 780) return 2;
    if (w <= 1080) return 3;
    return 4;
  }

  function perViewDuo(w) {
    return w <= 640 ? 1 : 2;
  }

  function initCarousel(config) {
    var root = document.getElementById(config.id);
    if (!root) return null;

    var viewport = root.querySelector("[data-carousel-viewport], .home-collections__carousel-viewport, .home-carousel__viewport");
    var track = root.querySelector("[data-carousel-track], .home-collections__carousel-track, .home-carousel__track");
    var prevBtn = root.querySelector("[data-carousel-prev]");
    var nextBtn = root.querySelector("[data-carousel-next]");
    var dotsWrap = root.querySelector("[data-carousel-dots], .home-collections__carousel-dots, .home-carousel__dots");
    if (!viewport || !track || !prevBtn || !nextBtn || !dotsWrap) return null;

    var index = 0;
    var dots = [];
    var slides = [];

    function refreshSlides() {
      slides = Array.prototype.slice.call(track.children).filter(function (el) {
        return el.nodeType === 1 && !el.hidden;
      });
    }

    function perView() {
      return config.perView(window.innerWidth);
    }

    function maxIndex() {
      return Math.max(0, slides.length - perView());
    }

    function slideStep() {
      if (!slides.length) return 0;
      var slideWidth = slides[0].getBoundingClientRect().width;
      var gap = 0;
      try {
        gap = parseFloat(
          window.getComputedStyle(track).columnGap ||
            window.getComputedStyle(track).gap ||
            "0"
        );
      } catch (e) {}
      return slideWidth + gap;
    }

    function setTrackPosition(dragDelta) {
      var offset = slideStep() * index;
      var drag = typeof dragDelta === "number" ? dragDelta : 0;
      track.style.transform = "translateX(" + (-offset + drag) + "px)";
    }

    function positionNav() {
      if (!config.mediaSelector || !slides.length) return;
      var media = slides[0].querySelector(config.mediaSelector);
      if (!media) return;
      var cardRect = slides[0].getBoundingClientRect();
      var mediaRect = media.getBoundingClientRect();
      if (!cardRect.height || !mediaRect.height) return;
      var cardCenter = cardRect.top + cardRect.height / 2;
      var mediaCenter = mediaRect.top + mediaRect.height / 2;
      root.style.setProperty("--home-nav-shift", (mediaCenter - cardCenter).toFixed(1) + "px");
    }

    function updateControls() {
      var max = maxIndex();
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= max;
      prevBtn.hidden = max <= 0;
      nextBtn.hidden = max <= 0;
      dotsWrap.hidden = max <= 0;
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-selected", i === index ? "true" : "false");
      });
    }

    function goTo(nextIndex) {
      index = Math.max(0, Math.min(maxIndex(), nextIndex));
      setTrackPosition();
      updateControls();
    }

    function rebuildDots() {
      dotsWrap.innerHTML = "";
      dots = [];
      for (var i = 0; i <= maxIndex(); i += 1) {
        (function (dotIndex) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = config.dotClass || "home-collections__carousel-dot";
          if (config.dotClassExtra) dot.className += " " + config.dotClassExtra;
          dot.setAttribute("role", "tab");
          dot.setAttribute("aria-label", "Slide " + (dotIndex + 1));
          dot.addEventListener("click", function () {
            goTo(dotIndex);
          });
          dotsWrap.appendChild(dot);
          dots.push(dot);
        })(i);
      }
      if (index > maxIndex()) index = maxIndex();
      updateControls();
    }

    function refresh() {
      refreshSlides();
      rebuildDots();
      setTrackPosition();
      positionNav();
    }

    prevBtn.addEventListener("click", function () {
      goTo(index - 1);
    });

    nextBtn.addEventListener("click", function () {
      goTo(index + 1);
    });

    function bindTouchSwipe() {
      var touchStartX = 0;
      var touchStartY = 0;
      var touchDeltaX = 0;
      var swiping = false;
      var dragging = false;
      var blockedClick = false;
      var SWIPE_THRESHOLD = 42;

      function clampDrag(dx) {
        if (index <= 0 && dx > 0) return dx * 0.32;
        if (index >= maxIndex() && dx < 0) return dx * 0.32;
        return dx;
      }

      viewport.addEventListener(
        "touchstart",
        function (e) {
          if (e.touches.length !== 1) return;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchDeltaX = 0;
          swiping = false;
          dragging = true;
          track.classList.add("is-dragging");
        },
        { passive: true }
      );

      viewport.addEventListener(
        "touchmove",
        function (e) {
          if (!dragging || e.touches.length !== 1) return;
          var dx = e.touches[0].clientX - touchStartX;
          var dy = e.touches[0].clientY - touchStartY;

          if (!swiping) {
            if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
            swiping = true;
            viewport.classList.add("is-swiping");
          }

          touchDeltaX = clampDrag(dx);
          setTrackPosition(touchDeltaX);
        },
        { passive: true }
      );

      function endTouch() {
        if (!dragging) return;
        dragging = false;
        track.classList.remove("is-dragging");
        viewport.classList.remove("is-swiping");

        if (swiping && Math.abs(touchDeltaX) >= SWIPE_THRESHOLD) {
          if (touchDeltaX < 0) goTo(index + 1);
          else goTo(index - 1);
          blockedClick = true;
          window.setTimeout(function () {
            blockedClick = false;
          }, 320);
        } else {
          setTrackPosition();
        }

        swiping = false;
        touchDeltaX = 0;
      }

      viewport.addEventListener("touchend", endTouch, { passive: true });
      viewport.addEventListener("touchcancel", endTouch, { passive: true });

      viewport.addEventListener(
        "click",
        function (e) {
          if (!blockedClick) return;
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );
    }

    bindTouchSwipe();

    var resizeTimer = null;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 120);
    }
    window.addEventListener("resize", onResize);

    refresh();

    var firstImg = slides[0] && slides[0].querySelector("img");
    if (firstImg && !firstImg.complete) {
      firstImg.addEventListener("load", positionNav, { once: true });
    }
    window.addEventListener("load", positionNav, { once: true });

    function destroy() {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
    }

    return { refresh: refresh, goTo: goTo, destroy: destroy };
  }

  function boot() {
    instances["home-collections-carousel"] = initCarousel({
      id: "home-collections-carousel",
      perView: perViewCollections,
      mediaSelector: ".home-collections__cat-media",
    });

    instances["home-bestsellers-carousel"] = initCarousel({
      id: "home-bestsellers-carousel",
      perView: perViewBestsellers,
      mediaSelector: ".bestseller-card__visual",
      dotClass: "home-collections__carousel-dot",
    });

    instances["home-duo-carousel"] = initCarousel({
      id: "home-duo-carousel",
      perView: perViewDuo,
      mediaSelector: ".home-duo__media",
      dotClass: "home-collections__carousel-dot",
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.NostalgiaHomeCarousels = {
    refresh: function (id) {
      if (instances[id] && typeof instances[id].refresh === "function") {
        instances[id].refresh();
      }
    },
    mount: function (id, config) {
      if (!id || !config) return null;
      if (instances[id] && typeof instances[id].destroy === "function") {
        instances[id].destroy();
      }
      config.id = id;
      instances[id] = initCarousel(config);
      return instances[id];
    },
  };
})();
