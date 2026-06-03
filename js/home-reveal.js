(function () {
  var SEL = ".home-reveal, .site-reveal";

  function revealAll() {
    document.querySelectorAll(SEL).forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealAll();
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: [0, 0.06, 0.12],
        rootMargin: "0px 0px -2% 0px",
      }
    );

    document.querySelectorAll(SEL).forEach(function (el) {
      obs.observe(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
