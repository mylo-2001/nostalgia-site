(function () {
  if (document.body.getAttribute("data-page") !== "home") return;

  var section = document.getElementById("home-reviews");
  var track = document.getElementById("home-reviews-track");
  var summary = document.getElementById("home-reviews-summary");
  if (!section || !track || !window.NostalgiaAPI) return;

  var index = 0;
  var reviews = [];

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stars(n) {
    return "★".repeat(Math.max(0, Math.min(5, n || 0)));
  }

  function slidesPerView() {
    if (window.matchMedia("(max-width: 640px)").matches) return 1;
    if (window.matchMedia("(max-width: 900px)").matches) return 2;
    return 3;
  }

  function maxIndex() {
    return Math.max(0, reviews.length - slidesPerView());
  }

  function paintSummary(stats) {
    if (!summary || !stats || !stats.total) return;
    summary.innerHTML =
      '<span class="home-reviews__stars" aria-hidden="true">' + stars(Math.round(stats.average)) + "</span>" +
      "<span>" + stats.average.toFixed(2) + " / 5 · " + stats.total + " " + t("reviews_count") + "</span>";
  }

  function cardHTML(r) {
    var thumb = r.productImage
      ? '<figure class="home-reviews__card-thumb"><img src="' + escapeHtml(r.productImage) + '" alt="" loading="lazy" decoding="async" /></figure>'
      : "";
    return (
      '<li class="home-reviews__slide">' +
      '<a class="home-reviews__card" href="/review/' + encodeURIComponent(r.id) + '">' +
      '<div class="home-reviews__card-stars" aria-label="' + r.rating + '/5">' + stars(r.rating) + "</div>" +
      "<h3 class=\"home-reviews__card-title\">" + escapeHtml(r.title) + "</h3>" +
      '<p class="home-reviews__card-text">' + escapeHtml(r.excerpt || r.text) + "</p>" +
      '<div class="home-reviews__card-foot">' +
      thumb +
      '<div class="home-reviews__card-meta"><strong>' + escapeHtml(r.name) + "</strong>" +
      escapeHtml(r.productTitle) +
      "</div></div></a></li>"
    );
  }

  function updateCarousel() {
    var slide = track.querySelector(".home-reviews__slide");
    if (!slide) return;
    var gap = 16;
    var offset = index * (slide.getBoundingClientRect().width + gap);
    track.style.transform = "translateX(-" + offset + "px)";
    var prev = section.querySelector(".home-reviews__nav--prev");
    var next = section.querySelector(".home-reviews__nav--next");
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= maxIndex();
  }

  function bindNav() {
    var prev = section.querySelector(".home-reviews__nav--prev");
    var next = section.querySelector(".home-reviews__nav--next");
    if (prev) {
      prev.addEventListener("click", function () {
        index = Math.max(0, index - 1);
        updateCarousel();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        index = Math.min(maxIndex(), index + 1);
        updateCarousel();
      });
    }
    window.addEventListener("resize", function () {
      index = Math.min(index, maxIndex());
      updateCarousel();
    });
  }

  function init() {
    window.NostalgiaAPI.ready().then(function (ok) {
      if (!ok || !window.NostalgiaAPI.isAvailable()) return;
    Promise.all([
      window.NostalgiaAPI.get("/api/reviews/stats"),
      window.NostalgiaAPI.get("/api/reviews?limit=12&sort=rating"),
    ])
      .then(function (results) {
        var statsRes = results[0];
        var listRes = results[1];
        reviews = listRes.ok && listRes.reviews ? listRes.reviews : [];
        if (!reviews.length) return;
        paintSummary(statsRes.ok ? statsRes.stats : null);
        track.innerHTML = reviews.map(cardHTML).join("");
        section.hidden = false;
        bindNav();
        updateCarousel();
      })
      .catch(function () {});
    });
  }

  init();
})();
