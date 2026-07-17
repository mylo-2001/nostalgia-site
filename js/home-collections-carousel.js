(function () {
  function initCollectionsCarousel() {
    var root = document.getElementById("home-collections-carousel");
    if (!root) return;

    var viewport = root.querySelector(".home-collections__carousel-viewport");
    var track = root.querySelector(".home-collections__carousel-track");
    var slides = Array.prototype.slice.call(
      root.querySelectorAll(".home-collections__carousel-slide")
    );
    var prevBtn = root.querySelector("[data-carousel-prev]");
    var nextBtn = root.querySelector("[data-carousel-next]");
    var dotsWrap = root.querySelector(".home-collections__carousel-dots");
    if (!viewport || !track || !slides.length || !prevBtn || !nextBtn || !dotsWrap) return;

    var index = 0;
    var dots = [];

    function perView() {
      var w = window.innerWidth;
      if (w <= 640) return 1;
      if (w <= 900) return 2;
      if (w <= 1200) return 3;
      return 4;
    }

    function maxIndex() {
      return Math.max(0, slides.length - perView());
    }

    function slideStep() {
      var slideWidth = slides[0].getBoundingClientRect().width;
      var gap = 0;
      try {
        gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || "0");
      } catch (e) {}
      return slideWidth + gap;
    }

    function setTrackPosition(dragDelta) {
      var offset = slideStep() * index;
      var drag = typeof dragDelta === "number" ? dragDelta : 0;
      track.style.transform = "translateX(" + (-offset + drag) + "px)";
    }

    function positionNav() {
      // Align the arrows to the vertical centre of the card image (Trudon-style)
      // instead of the centre of the whole card (image + title + CTA).
      var media = slides[0] && slides[0].querySelector(".home-collections__cat-media");
      if (!media) return;
      var cardRect = slides[0].getBoundingClientRect();
      var mediaRect = media.getBoundingClientRect();
      if (!cardRect.height || !mediaRect.height) return;
      var cardCenter = cardRect.top + cardRect.height / 2;
      var mediaCenter = mediaRect.top + mediaRect.height / 2;
      root.style.setProperty("--home-nav-shift", (mediaCenter - cardCenter).toFixed(1) + "px");
    }

    function updateControls() {
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= maxIndex();
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
          dot.className = "home-collections__carousel-dot";
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
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        rebuildDots();
        setTrackPosition();
        positionNav();
      }, 120);
    });

    rebuildDots();
    setTrackPosition();
    positionNav();

    // Re-measure once the card images have loaded (their height feeds the offset).
    var firstImg = slides[0] && slides[0].querySelector(".home-collections__cat-media img");
    if (firstImg && !firstImg.complete) {
      firstImg.addEventListener("load", positionNav, { once: true });
    }
    window.addEventListener("load", positionNav, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCollectionsCarousel);
  } else {
    initCollectionsCarousel();
  }
})();
