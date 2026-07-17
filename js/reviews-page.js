(function () {
  if (document.body.getAttribute("data-page") !== "reviews") return;

  var root = document.getElementById("reviews-page-root");
  if (!root || !window.NostalgiaAPI) return;

  var sort = "rating";

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

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(document.documentElement.lang === "en" ? "en-GB" : "el-GR");
    } catch (e) {
      return "";
    }
  }

  function barRows(stats) {
    var total = stats.total || 1;
    return [5, 4, 3, 2, 1]
      .map(function (star) {
        var count = (stats.byRating && stats.byRating[star]) || 0;
        var pct = Math.round((count / total) * 100);
        return (
          '<div class="reviews-page__bar-row">' +
          "<span>" + star + " ★</span>" +
          '<div class="reviews-page__bar-track"><div class="reviews-page__bar-fill" style="width:' + pct + '%"></div></div>' +
          "<span>" + count + "</span></div>"
        );
      })
      .join("");
  }

  function cardHTML(r) {
    return (
      '<a class="reviews-card" href="/review/' + encodeURIComponent(r.id) + '">' +
      '<div class="reviews-card__top">' +
      '<span class="reviews-card__stars">' + stars(r.rating) + "</span>" +
      '<span class="reviews-card__date">' + escapeHtml(fmtDate(r.createdAt)) + "</span></div>" +
      '<div class="reviews-card__author">' + escapeHtml(r.name) +
      ' <span class="reviews-card__verified">' + escapeHtml(t("reviews_verified")) + "</span></div>" +
      "<h2 class=\"reviews-card__title\">" + escapeHtml(r.title) + "</h2>" +
      '<p class="reviews-card__text">' + escapeHtml(r.excerpt || r.text) + "</p>" +
      '<span class="reviews-card__product">' + escapeHtml(r.productTitle) + "</span></a>"
    );
  }

  function render(stats, list) {
    root.innerHTML =
      '<div class="reviews-page__stats">' +
      '<div class="reviews-page__avg">' +
      '<span class="reviews-page__avg-num">' + (stats.average || 0).toFixed(2) + " / 5</span>" +
      '<div class="reviews-page__avg-stars">' + stars(Math.round(stats.average || 0)) + "</div>" +
      '<p class="reviews-page__avg-note">' + escapeHtml(t("reviews_stats_note").replace("{n}", String(stats.total || 0))) + "</p></div>" +
      '<div class="reviews-page__bars">' + barRows(stats) + "</div>" +
      '<div class="reviews-page__cta">' +
      '<p class="reviews-page__cta-note">' + escapeHtml(t("reviews_write_hint")) + "</p>" +
      '<a class="reviews-page__cta-btn" href="/collection">' + escapeHtml(t("reviews_write_cta")) + "</a></div></div>" +
      '<div class="reviews-page__toolbar">' +
      '<label><select class="reviews-page__sort" id="reviews-sort">' +
      '<option value="rating"' + (sort === "rating" ? " selected" : "") + ">" + escapeHtml(t("reviews_sort_rating")) + "</option>" +
      '<option value="date"' + (sort === "date" ? " selected" : "") + ">" + escapeHtml(t("reviews_sort_date")) + "</option>" +
      "</select></label></div>" +
      '<div class="reviews-page__grid" id="reviews-grid">' +
      (list.length ? list.map(cardHTML).join("") : '<p class="reviews-page__empty">' + escapeHtml(t("reviews_empty")) + "</p>") +
      "</div>";

    var sortEl = document.getElementById("reviews-sort");
    if (sortEl) {
      sortEl.addEventListener("change", function () {
        sort = sortEl.value === "date" ? "date" : "rating";
        load();
      });
    }
  }

  function load() {
    window.NostalgiaAPI.ready().then(function (ok) {
      if (!ok || !window.NostalgiaAPI.isAvailable()) {
        root.innerHTML = '<p class="reviews-page__empty">' + escapeHtml(t("reviews_empty")) + "</p>";
        return;
      }
      Promise.all([
        window.NostalgiaAPI.get("/api/reviews/stats"),
        window.NostalgiaAPI.get("/api/reviews?limit=50&sort=" + encodeURIComponent(sort)),
      ])
        .then(function (results) {
          var stats = results[0].ok ? results[0].stats : { total: 0, average: 0, byRating: {} };
          var list = results[1].ok && results[1].reviews ? results[1].reviews : [];
          render(stats, list);
        })
        .catch(function () {
          root.innerHTML = '<p class="reviews-page__empty">' + escapeHtml(t("reviews_empty")) + "</p>";
        });
    });
  }

  load();
  window.NostalgiaOnLangApplied = (function (prev) {
    return function () {
      load();
      if (typeof prev === "function") prev();
    };
  })(window.NostalgiaOnLangApplied);
})();
