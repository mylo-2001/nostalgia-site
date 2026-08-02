(function () {
  if (document.body.getAttribute("data-page") !== "review") return;

  var root = document.getElementById("review-page-root");
  if (!root) return;

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

  function reviewIdFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "review" && parts[1]) return decodeURIComponent(parts[1]);
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || "";
  }

  function renderNotFound() {
    root.innerHTML =
      '<div class="review-page__not-found">' +
      "<p>" + escapeHtml(t("review_not_found")) + "</p>" +
      '<a class="review-page__back" href="/reviews">' + escapeHtml(t("reviews_page_title")) + "</a></div>";
    document.title = t("review_not_found") + " · Nostalgia Collection";
  }

  function render(review) {
    var thumb = review.productImage
      ? '<figure class="review-page__product-media"><img src="' + escapeHtml(review.productImage) + '" alt="" loading="lazy" decoding="async" /></figure>'
      : "";
    root.innerHTML =
      '<a class="review-page__back" href="/reviews">← ' + escapeHtml(t("reviews_back_all")) + "</a>" +
      '<article class="review-page__head">' +
      '<div class="review-page__stars" aria-label="' + review.rating + '/5">' + stars(review.rating) + "</div>" +
      '<div class="review-page__meta">' +
      "<span>" + escapeHtml(review.name) + "</span>" +
      (review.isVerifiedPurchase ? '<span class="review-page__verified">✓ ' + escapeHtml(t("reviews_verified")) + "</span>" : "") +
      "<span>" + escapeHtml(fmtDate(review.createdAt)) + "</span></div></article>" +
      '<div class="review-page__body">' + escapeHtml(review.text) + "</div>" +
      '<a class="review-page__product" href="' + escapeHtml(review.productUrl) + '">' +
      thumb +
      "<div><p class=\"review-page__product-label\">" + escapeHtml(t("review_product_label")) + "</p>" +
      "<h2 class=\"review-page__product-title\">" + escapeHtml(review.productTitle) + "</h2></div></a>";

    document.title = review.title + " · Nostalgia Collection";
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", (review.excerpt || review.text || "").slice(0, 160));

    var heroTitle = document.querySelector(".editorial-hero__title");
    if (heroTitle) heroTitle.textContent = review.title;

    if (window.NostalgiaBreadcrumbs && typeof window.NostalgiaBreadcrumbs.update === "function") {
      window.NostalgiaBreadcrumbs.update([
        { labelKey: "nav_home", href: "/" },
        { labelKey: "reviews_page_title", href: "/reviews" },
        { text: review.title, href: null },
      ]);
    }
  }

  function load() {
    var id = reviewIdFromPath();
    if (!id) {
      renderNotFound();
      return;
    }
    if (!window.NostalgiaAPI || !window.NostalgiaAPI.isAvailable()) {
      renderNotFound();
      return;
    }
    window.NostalgiaAPI.get("/api/reviews/" + encodeURIComponent(id))
      .then(function (res) {
        if (res.ok && res.review) render(res.review);
        else renderNotFound();
      })
      .catch(renderNotFound);
  }

  if (window.NostalgiaAPI) {
    window.NostalgiaAPI.ready().then(function (ok) {
      if (!ok || !window.NostalgiaAPI.isAvailable()) {
        renderNotFound();
        return;
      }
      load();
    });
  } else {
    renderNotFound();
  }
})();
