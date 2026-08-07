/*
 * Nostalgia — cart / wishlist / popular reminder band.
 *
 * A quiet bar at the foot of the page: cart first, then wishlist, then (only
 * when the monthly bestsellers API has real sales) a link to what people are
 * actually buying. It follows the welcome offer's rules (scroll depth, skip
 * pages, dismissal memory) but deliberately not its form — that one is a
 * modal because it is making an offer, this one is a band because it is only
 * a reminder and must never block the page.
 *
 * On scarcity: sold-out and low-stock lines appear ONLY when a product's real
 * stock is tracked by the server. Unknown stock stays silent. Invented
 * scarcity is an unfair commercial practice under EU consumer law.
 */
(function () {
  "use strict";

  var STATE_KEY = "nostalgia-reminder";
  var DISMISS_DAYS = 3;
  var SCROLL_RATIO = 0.65;
  /* Match home-bestsellers so "λίγα κομμάτια" means the same everywhere. */
  var LOW_STOCK = 5;

  /* Pages where the reminder is pointless or intrusive: the visitor is already
     looking at the thing it would remind them of, or is mid-purchase. */
  var SKIP_PATHS = [
    "/cart",
    "/checkout",
    "/order-success",
    "/track",
    "/account",
    "/wishlist",
  ];

  /* Set true only when GET /api/products/bestsellers returns at least one
     real sale this month. Empty = no orders yet = do not invent popularity. */
  var hasRealBestsellers = false;
  var bestsellersFetched = false;

  function t(key, fallback) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      var v = window.NostalgiaI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeState(patch) {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify(Object.assign({}, readState(), patch, { at: Date.now() }))
      );
    } catch (e) {}
  }

  /* A dismissal is respected for DISMISS_DAYS — shorter than the welcome
     offer's week, because a cart reminder is useful again sooner, but long
     enough that it never feels like nagging. */
  function suppressed() {
    var s = readState();
    if (!s || s.status !== "dismissed") return false;
    return Date.now() - s.at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  }

  /* Once per session regardless of how many pages get visited. */
  function shownThisSession() {
    try {
      return sessionStorage.getItem(STATE_KEY + "-session") === "1";
    } catch (e) {
      return false;
    }
  }

  function markSession() {
    try {
      sessionStorage.setItem(STATE_KEY + "-session", "1");
    } catch (e) {}
  }

  function skipPage() {
    var p = location.pathname.replace(/\/+$/, "") || "/";
    for (var i = 0; i < SKIP_PATHS.length; i++) {
      if (p.indexOf(SKIP_PATHS[i]) === 0) return true;
    }
    return false;
  }

  /* The welcome offer is a modal and owns the screen while it is open. Two
     prompts at once is the definition of spam, so this one waits. */
  function offerOnScreen() {
    return !!document.querySelector(".welcome-offer, .welcome-offer__panel");
  }

  function cartCount() {
    try {
      return window.NostalgiaCart ? window.NostalgiaCart.getCount() : 0;
    } catch (e) {
      return 0;
    }
  }

  function cartIds() {
    try {
      if (!window.NostalgiaCart || !window.NostalgiaCart.getLineItems) return [];
      return window.NostalgiaCart.getLineItems().map(function (line) {
        return line.id;
      });
    } catch (e) {
      return [];
    }
  }

  /* Reads storage directly rather than going through NostalgiaWishlist: that
     module is only loaded on the home, product and wishlist pages, so relying
     on it would silently disable this reminder on the other sixteen. The key
     is the one wishlist.js owns — keep them in step. */
  var WISHLIST_KEY = "nostalgia-wishlist";

  function wishlistIds() {
    if (window.NostalgiaWishlist && window.NostalgiaWishlist.getAll) {
      try {
        return window.NostalgiaWishlist.getAll();
      } catch (e) {}
    }
    try {
      var raw = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      return Array.isArray(raw)
        ? raw.filter(function (id) {
            return typeof id === "string" && id;
          })
        : [];
    } catch (e) {
      return [];
    }
  }

  /* Returns "out" | "low" | null from tracked stock only. */
  function stockIssue(ids) {
    if (!window.NostalgiaProducts || !window.NostalgiaProducts.getById) return null;
    var low = false;
    for (var i = 0; i < ids.length; i++) {
      var p = window.NostalgiaProducts.getById(ids[i]);
      if (!p || p.stock == null) continue;
      var n = Number(p.stock);
      if (n <= 0) return "out";
      if (n > 0 && n <= LOW_STOCK) low = true;
    }
    return low ? "low" : null;
  }

  /* Cart first: nearer intent. Wishlist next. Popular last, and only when the
     monthly sales endpoint has real rows — never the curated fallback. */
  function pickMessage() {
    if (cartCount() > 0) {
      var cartIssue = stockIssue(cartIds());
      var cartText = t("remind_cart_text", "Κρατήσαμε ό,τι διαλέξατε. Συνεχίστε όποτε σας βολεύει.");
      if (cartIssue === "out") {
        cartText =
          t(
            "remind_sold_out",
            "Κάποιο προϊόν στο καλάθι έχει εξαντληθεί — ελέγξτε πριν ολοκληρώσετε."
          );
      } else if (cartIssue === "low") {
        cartText +=
          " " +
          t("remind_low_stock", "Ένα από αυτά μας έχει απομείνει σε λίγα κομμάτια.");
      }
      return {
        kind: "cart",
        title: t("remind_cart_title", "Το καλάθι σας περιμένει"),
        text: cartText,
        cta: { href: "/checkout", label: t("remind_cart_cta", "Ολοκλήρωση αγοράς") },
        secondary: { href: "/cart", label: t("remind_cart_secondary", "Δείτε το καλάθι") },
      };
    }

    var ids = wishlistIds();
    if (ids.length > 0) {
      var wishIssue = stockIssue(ids);
      var text = t("remind_wish_text", "Έχετε αποθηκεύσει μερικά κομμάτια για αργότερα.");
      if (wishIssue === "out") {
        text =
          t(
            "remind_wish_sold_out",
            "Κάποιο από τα αγαπημένα σας έχει εξαντληθεί — δείτε τα πριν φύγει και κάποιο άλλο."
          );
      } else if (wishIssue === "low") {
        text +=
          " " +
          t("remind_low_stock", "Ένα από αυτά μας έχει απομείνει σε λίγα κομμάτια.");
      }
      return {
        kind: "wishlist",
        title: t("remind_wish_title", "Τα αγαπημένα σας"),
        text: text,
        cta: { href: "/wishlist", label: t("remind_wish_cta", "Δείτε τα αγαπημένα") },
        secondary: null,
      };
    }

    if (hasRealBestsellers) {
      return {
        kind: "popular",
        title: t("remind_popular_title", "Αυτό που αγοράζει ο πολύς κόσμος"),
        text: t(
          "remind_popular_text",
          "Δείτε τα προϊόντα με τις περισσότερες αγορές αυτόν τον μήνα."
        ),
        cta: {
          href: "/#home-bestsellers",
          label: t("remind_popular_cta", "Δείτε τα δημοφιλή"),
        },
        secondary: null,
      };
    }

    return null;
  }

  var ICON = {
    cart:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M8.35 9.85c0-2.05 1.62-3.7 3.65-3.7s3.65 1.65 3.65 3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M7.35 10.35h9.3v11.3H7.35z" stroke="currentColor" stroke-width="1.5"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 20S4 15 4 9.6C4 6.9 6.1 4.8 8.8 4.8c1.5 0 2.8.7 3.2 1.9.4-1.2 1.7-1.9 3.2-1.9C17.9 4.8 20 6.9 20 9.6 20 15 12 20 12 20z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3.6l2.35 4.76 5.25.76-3.8 3.7.9 5.22L12 15.7l-4.7 2.34.9-5.22-3.8-3.7 5.25-.76L12 3.6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  };

  function iconFor(kind) {
    if (kind === "cart") return ICON.cart;
    if (kind === "popular") return ICON.star;
    return ICON.heart;
  }

  var el = null;
  var scrollReady = false;

  function dismiss() {
    if (!el) return;
    el.classList.remove("is-visible");
    writeState({ status: "dismissed" });
    window.setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
    }, 400);
  }

  function render(msg) {
    el = document.createElement("aside");
    el.className = "site-remind site-remind--" + msg.kind;
    el.id = "site-remind";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", esc(msg.title));

    el.innerHTML =
      '<span class="site-remind__icon" aria-hidden="true">' +
      iconFor(msg.kind) +
      "</span>" +
      '<div class="site-remind__body">' +
      '  <p class="site-remind__title">' +
      esc(msg.title) +
      "</p>" +
      '  <p class="site-remind__text">' +
      esc(msg.text) +
      "</p>" +
      "</div>" +
      '<div class="site-remind__actions">' +
      (msg.secondary
        ? '  <a class="site-remind__link" href="' +
          esc(msg.secondary.href) +
          '">' +
          esc(msg.secondary.label) +
          "</a>"
        : "") +
      '  <a class="site-remind__cta" href="' +
      esc(msg.cta.href) +
      '">' +
      esc(msg.cta.label) +
      "</a>" +
      "</div>" +
      '<button type="button" class="site-remind__close" data-remind-close aria-label="' +
      esc(t("remind_close", "Κλείσιμο υπενθύμισης")) +
      '">&times;</button>';

    document.body.appendChild(el);
    el.querySelector("[data-remind-close]").addEventListener("click", dismiss);

    /* Reflow before the class so the entrance transition actually runs. */
    void el.offsetWidth;
    el.classList.add("is-visible");
    markSession();
  }

  function eligible() {
    return !suppressed() && !shownThisSession() && !skipPage();
  }

  function maybeShow() {
    if (el || !eligible()) return false;
    if (offerOnScreen()) return false;
    /* Popular needs the API answer first; cart/wishlist can show immediately. */
    var msg = pickMessage();
    if (!msg) return false;
    if (msg.kind === "popular" && !bestsellersFetched) return false;
    render(msg);
    return true;
  }

  function fetchBestsellers() {
    if (!window.fetch) {
      bestsellersFetched = true;
      return;
    }
    fetch("/api/products/bestsellers", { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        hasRealBestsellers = !!(data && Array.isArray(data.items) && data.items.length > 0);
      })
      .catch(function () {
        hasRealBestsellers = false;
      })
      .then(function () {
        bestsellersFetched = true;
        /* Scroll already deep enough and nothing else to remind about. */
        if (scrollReady) maybeShow();
      });
  }

  function schedule() {
    if (!eligible()) return;
    fetchBestsellers();

    function onScroll() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      if (doc.scrollTop / max < SCROLL_RATIO) return;
      scrollReady = true;
      /* Reached the depth, but the offer modal may still be up — keep
         listening rather than firing into an occupied screen. */
      if (maybeShow()) window.removeEventListener("scroll", onScroll);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  window.NostalgiaReminder = { show: maybeShow, dismiss: dismiss, pick: pickMessage };
})();
