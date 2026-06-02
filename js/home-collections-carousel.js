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
      return window.innerWidth <= 720 ? 1 : 2;
    }

    function maxIndex() {
      return Math.max(0, slides.length - perView());
    }

    function setTrackPosition() {
      var slideWidth = slides[0].getBoundingClientRect().width;
      var gap = 0;
      try {
        gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || "0");
      } catch (e) {}
      var offset = (slideWidth + gap) * index;
      track.style.transform = "translateX(" + -offset + "px)";
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

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        rebuildDots();
        setTrackPosition();
      }, 120);
    });

    rebuildDots();
    setTrackPosition();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCollectionsCarousel);
  } else {
    initCollectionsCarousel();
  }
})();
