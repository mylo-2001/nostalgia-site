(function () {
  /* Atmospheric film band: two muted, looping videos with a smooth crossfade
     toggle. Autoplays only the active video while the section is on screen.
     Near the end of each loop the video blurs and a closing line fades in. */
  var END_RATIO = 0.82; /* show the closing line in the last ~18% of the clip */

  function init() {
    var section = document.querySelector(".home-film");
    if (!section) return;
    var stage = section.querySelector(".home-film__stage");
    var videos = Array.prototype.slice.call(section.querySelectorAll("[data-film-video]"));
    var tabs = Array.prototype.slice.call(section.querySelectorAll("[data-film]"));
    if (!stage || videos.length < 2 || !tabs.length) return;

    var active = 0;
    var inView = false;

    function playActive() {
      if (!inView) return;
      var v = videos[active];
      if (v && v.paused) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
    }

    /* Blur + closing line when the active clip is near its end. */
    function syncEnding() {
      var v = videos[active];
      var ending = !!(v && v.duration && v.currentTime / v.duration >= END_RATIO);
      stage.classList.toggle("is-ending", ending);
    }

    videos.forEach(function (v) {
      v.addEventListener("timeupdate", function () {
        if (videos[active] === v) syncEnding();
      });
    });

    function select(i) {
      if (i === active) return;
      active = i;
      stage.classList.remove("is-ending");
      videos.forEach(function (v, idx) {
        var on = idx === active;
        v.classList.toggle("is-active", on);
        if (on) {
          if (v.getAttribute("preload") === "none") v.setAttribute("preload", "metadata");
          playActive();
        } else {
          v.pause();
        }
      });
      tabs.forEach(function (t, idx) {
        var on = idx === active;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    tabs.forEach(function (t, idx) {
      t.addEventListener("click", function () {
        select(idx);
      });
    });

    /* Only run the video while the band is visible. */
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            inView = e.isIntersecting;
            if (inView) playActive();
            else videos.forEach(function (v) { v.pause(); });
          });
        },
        { threshold: 0.25 }
      );
      obs.observe(section);
    } else {
      inView = true;
      playActive();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
