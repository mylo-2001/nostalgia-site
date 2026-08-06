/*
 * Nostalgia — welcome offer popup.
 *
 * Step 1: 10% off the first order for a newsletter signup.
 * Step 2: confirms the code (also emailed).
 * Step 3: offers an extra 5% (15% total) for creating an account — one
 *   decision at a time, never both offers stacked into a single screen.
 *
 * The account-creation button hands off to the site's own registration flow
 * (window.NostalgiaAccount.openRegister), which — outside the /account page —
 * navigates there directly. There's no reliable way to resume this popup
 * with a "step 4" confirmation after that page change, so this stops at
 * step 3; the registration email already explains how the two codes combine.
 *
 * Shown once per visitor after the visitor reaches the configured scroll
 * depth: suppressed for good after subscribing, suppressed for a week after
 * an explicit dismissal, never for logged-in visitors, and never on
 * checkout/cart/account where it would interrupt something else.
 */
(function () {
  "use strict";

  var STATE_KEY = "nostalgia-welcome-offer";
  var EMAIL_KEY = "nostalgia-offer-email";
  var DISMISS_DAYS = 7;
  var SCROLL_RATIO = 0.65;
  /* Pages where a popup would get in the way of an active purchase. */
  var SKIP_PATHS = ["/checkout", "/cart", "/order-success", "/track", "/account"];

  var NEWSLETTER_CODE = "NOSTALGIACANDLE10";
  var ACCOUNT_CODE = "NOSTALGIACANDLE5";

  function t(key, fallback) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      var v = window.NostalgiaI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function isEn() {
    return document.documentElement.lang === "en";
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
      localStorage.setItem(STATE_KEY, JSON.stringify(Object.assign({}, readState(), patch, { at: Date.now() })));
    } catch (e) {}
  }

  /* subscribed → never again; a plain dismissal → eligible again after
     DISMISS_DAYS so it isn't gone forever from one accidental close. */
  function suppressed() {
    var s = readState();
    if (!s) return false;
    if (s.status === "subscribed") return true;
    if (s.status === "dismissed") {
      return Date.now() - s.at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    }
    return false;
  }

  function loggedIn() {
    try { return !!sessionStorage.getItem("nostalgia-session"); } catch (e) { return false; }
  }

  function skipPage() {
    var p = location.pathname.replace(/\/+$/, "") || "/";
    for (var i = 0; i < SKIP_PATHS.length; i++) {
      if (p.indexOf(SKIP_PATHS[i]) === 0) return true;
    }
    return false;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Simple line-style SVG icons (currentColor) — no emoji. */
  var ICON = {
    mail: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 5.5L10 11L16.5 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shield: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5l6 2.2v4.4c0 4-2.6 6.9-6 8.4-3.4-1.5-6-4.4-6-8.4V4.7l6-2.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.3 10.1l1.9 1.9 3.6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.3"/><path d="M10 6v4.2l2.8 1.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 16.5S3 12.2 3 7.6C3 5.3 4.8 3.6 7 3.6c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.2 0 4 1.7 4 4 0 4.6-7 8.9-7 8.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    tag: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M11 3h5a1 1 0 011 1v5l-8.3 8.3a1 1 0 01-1.4 0L3 13a1 1 0 010-1.4L11.3 3.3A1 1 0 0111 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="13.3" cy="6.7" r="1" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 12.5v-8A1.5 1.5 0 016 3h8" stroke="currentColor" stroke-width="1.3"/></svg>',
  };

  function stepperHTML(step) {
    return '<div class="welcome-offer__stepper">— ' + esc(t("offer_step", isEn() ? "Step" : "Βήμα") + " " + step + " " + (isEn() ? "of" : "από") + " 3") + " —</div>";
  }

  function chromeOpen(title) {
    return (
      '<div class="welcome-offer__backdrop" data-offer-close></div>' +
      '<div class="welcome-offer__panel" role="dialog" aria-modal="true" aria-labelledby="welcome-offer-title">' +
      '  <button type="button" class="welcome-offer__close" data-offer-close aria-label="' +
      esc(isEn() ? "Close" : "Κλείσιμο") + '">&times;</button>' +
      '  <img class="welcome-offer__logo brand-logo brand-logo--dark" src="/images/logo/logo.png" alt="Nostalgia Collection" />' +
      '  <img class="welcome-offer__logo brand-logo brand-logo--light" src="/images/logo/logo%20light.png?v=2" alt="Nostalgia Collection" />'
    );
  }

  function step1HTML() {
    var en = isEn();
    return (
      chromeOpen() +
      stepperHTML(1) +
      '  <h2 class="welcome-offer__title" id="welcome-offer-title">' +
      esc(t("offer_title", en ? "Get 10% off your first order" : "Κέρδισε 10% στην πρώτη σου παραγγελία")) +
      "</h2>" +
      '  <p class="welcome-offer__lead">' +
      esc(t("offer_lead", en
        ? "Subscribe to our newsletter and get your personal discount code."
        : "Γράψου στο newsletter και λάβε τον προσωπικό σου εκπτωτικό κωδικό.")) +
      "</p>" +
      '  <form class="welcome-offer__form" novalidate>' +
      '    <label class="welcome-offer__label" for="welcome-offer-email">' + esc(t("offer_email_label", en ? "Email" : "Email")) + "</label>" +
      '    <div class="welcome-offer__input-wrap">' +
      '      <input class="welcome-offer__input" id="welcome-offer-email" type="email" name="email" autocomplete="email" required placeholder="' +
      esc(t("offer_email_ph", en ? "e.g. maria@email.com" : "π.χ. maria@email.com")) + '" />' +
      '      <span class="welcome-offer__input-icon">' + ICON.mail + "</span>" +
      "    </div>" +
      '    <button class="welcome-offer__submit" type="submit">' +
      esc(t("offer_cta", en ? "I'D LOVE TO!" : "ΤΟ ΘΕΛΩ!")) +
      "</button>" +
      "  </form>" +
      '  <p class="welcome-offer__status" role="status" hidden></p>' +
      '  <p class="welcome-offer__trust-note">' + ICON.shield +
      "<span>" + esc(t("offer_trust_note", en
        ? "No spam. You can unsubscribe at any time."
        : "Χωρίς ανεπιθύμητα μηνύματα. Μπορείς να διαγραφείς οποιαδήποτε στιγμή.")) + "</span></p>" +
      '  <button type="button" class="welcome-offer__decline" data-offer-close>' +
      esc(t("offer_decline", en ? "No thanks" : "Όχι ευχαριστώ")) +
      "</button>" +
      "</div>"
    );
  }

  function step2HTML() {
    var en = isEn();
    return (
      chromeOpen() +
      stepperHTML(2) +
      '  <h2 class="welcome-offer__title welcome-offer__title--sm" id="welcome-offer-title">' +
      esc(t("offer_success_title", en ? "You're in!" : "Είσαι μέσα!")) +
      "</h2>" +
      '  <p class="welcome-offer__lead">' +
      esc(t("offer_success_lead", en
        ? "Your discount code is ready — we also sent it to your email."
        : "Ο εκπτωτικός κωδικός σου είναι έτοιμος και στάλθηκε και στο email σου.")) +
      "</p>" +
      '  <div class="welcome-offer__code-box">' +
      '    <span class="welcome-offer__code">' + esc(NEWSLETTER_CODE) + "</span>" +
      '    <span class="welcome-offer__code-label">' + esc(t("offer_code_label", en ? "Discount code" : "Κωδικός έκπτωσης")) + "</span>" +
      "  </div>" +
      '  <button type="button" class="welcome-offer__submit" data-copy-code="' + esc(NEWSLETTER_CODE) + '">' +
      esc(t("offer_copy", en ? "COPY CODE" : "ΑΝΤΙΓΡΑΦΗ ΚΩΔΙΚΟΥ")) +
      "</button>" +
      '  <button type="button" class="welcome-offer__outline-btn" data-offer-continue>' +
      esc(t("offer_continue_shopping", en ? "CONTINUE SHOPPING" : "ΣΥΝΕΧΕΙΑ ΑΓΟΡΩΝ")) +
      "</button>" +
      '  <p class="welcome-offer__trust-note">' + ICON.shield +
      "<span>" + esc(t("offer_first_order_only", en ? "Valid on your first order." : "Ισχύει για την πρώτη σου παραγγελία.")) + "</span></p>" +
      "</div>"
    );
  }

  function step3HTML() {
    var en = isEn();
    var rows = [
      [ICON.clock, t("offer_benefit_checkout", en ? "Faster checkout" : "Γρηγορότερο checkout")],
      [ICON.heart, t("offer_benefit_wishlist", en ? "Wishlist & order history" : "Αγαπημένα & ιστορικό παραγγελιών")],
      [ICON.tag, t("offer_benefit_total", en ? "15% total discount" : "Συνολική έκπτωση 15%")],
    ];
    return (
      chromeOpen() +
      stepperHTML(3) +
      '  <h2 class="welcome-offer__title welcome-offer__title--sm" id="welcome-offer-title">' +
      esc(t("offer_upsell_title", en ? "Want an extra 5%?" : "Θέλεις επιπλέον 5%;")) +
      "</h2>" +
      '  <p class="welcome-offer__lead">' +
      esc(t("offer_upsell_lead", en
        ? "Create an account and get 15% total on your first order, plus faster checkout and access to your order history."
        : "Δημιούργησε λογαριασμό και κέρδισε συνολικά 15% στην πρώτη σου παραγγελία, μαζί με γρηγορότερο checkout και πρόσβαση στο ιστορικό αγορών σου.")) +
      "</p>" +
      '  <ul class="welcome-offer__benefits">' +
      rows.map(function (r) {
        return '<li>' + r[0] + "<span>" + esc(r[1]) + "</span></li>";
      }).join("") +
      "</ul>" +
      '  <button type="button" class="welcome-offer__submit" data-offer-register>' +
      esc(t("offer_create_account", en ? "CREATE ACCOUNT" : "ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ")) +
      "</button>" +
      '  <button type="button" class="welcome-offer__decline" data-offer-close>' +
      esc(t("offer_maybe_later", en ? "Maybe later" : "Ίσως αργότερα")) +
      "</button>" +
      "</div>"
    );
  }

  var currentHost = null;

  function renderStep(step) {
    if (!currentHost) return;
    var html = step === 2 ? step2HTML() : step === 3 ? step3HTML() : step1HTML();
    currentHost.innerHTML = html;
    bindStep(step);
  }

  function bindStep(step) {
    var host = currentHost;
    if (!host) return;

    host.querySelectorAll("[data-offer-close]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        close(step === 1 ? "dismissed" : null);
      });
    });

    var continueBtn = host.querySelector("[data-offer-continue]");
    if (continueBtn) continueBtn.addEventListener("click", function () { close(null); });

    var registerBtn = host.querySelector("[data-offer-register]");
    if (registerBtn) {
      registerBtn.addEventListener("click", function () {
        close(null);
        if (window.NostalgiaAccount && typeof window.NostalgiaAccount.openRegister === "function") {
          window.NostalgiaAccount.openRegister();
        } else {
          location.href = "/account?mode=register";
        }
      });
    }

    var copyBtn = host.querySelector("[data-copy-code]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var code = copyBtn.getAttribute("data-copy-code") || "";
        var done = function () {
          var original = copyBtn.textContent;
          copyBtn.textContent = t("offer_copied", isEn() ? "COPIED!" : "ΑΝΤΙΓΡΑΦΗΚΕ!");
          setTimeout(function () { copyBtn.textContent = original; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(done);
        } else {
          done();
        }
      });
    }

    if (step === 1) {
      var statusEl = host.querySelector(".welcome-offer__status");
      var form = host.querySelector(".welcome-offer__form");
      var input = host.querySelector(".welcome-offer__input");

      function status(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle("is-error", !!isError);
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = (input.value || "").trim();
        if (!email || email.indexOf("@") === -1) {
          status(t("offer_bad_email", isEn() ? "Please enter a valid email." : "Δώσε ένα έγκυρο email."), true);
          return;
        }
        status(t("offer_sending", isEn() ? "Sending…" : "Αποστολή…"), false);
        try { localStorage.setItem(EMAIL_KEY, email); } catch (err) {}

        if (!window.NostalgiaAPI || !window.NostalgiaAPI.isAvailable()) {
          status(t("offer_offline", isEn() ? "Please try again later." : "Δοκίμασε ξανά αργότερα."), true);
          return;
        }
        window.NostalgiaAPI.post("/api/newsletter", { email: email, source: "welcome-offer" })
          .then(function (res) {
            if (res && res.ok) {
              writeState({ status: "subscribed" });
              renderStep(2);
            } else {
              status(t("offer_error", isEn() ? "Something went wrong." : "Κάτι πήγε στραβά."), true);
            }
          })
          .catch(function () {
            status(t("offer_error", isEn() ? "Something went wrong." : "Κάτι πήγε στραβά."), true);
          });
      });

      setTimeout(function () { if (input) input.focus(); }, 350);
    }

    if (step === 2) {
      /* Offer the account upsell a beat after the success state lands. */
      setTimeout(function () { if (currentHost === host) renderStep(3); }, 3200);
    }
  }

  function open() {
    if (document.getElementById("welcome-offer")) return;
    var host = document.createElement("div");
    host.id = "welcome-offer";
    host.className = "welcome-offer";
    document.body.appendChild(host);
    currentHost = host;
    renderStep(1);
    requestAnimationFrame(function () { host.classList.add("is-open"); });
    document.addEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") close("dismissed");
  }

  function close(status) {
    var host = currentHost;
    if (!host) return;
    if (status) writeState({ status: status });
    document.removeEventListener("keydown", onKey);
    host.classList.remove("is-open");
    currentHost = null;
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 300);
  }

  var triggered = false;
  function maybeOpen() {
    if (triggered || suppressed() || loggedIn() || skipPage()) return;
    triggered = true;
    open();
  }

  function schedule() {
    if (suppressed() || loggedIn() || skipPage()) return;

    function onScroll() {
      var doc = document.documentElement;
      var scrolled = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
      if (scrolled >= SCROLL_RATIO) {
        window.removeEventListener("scroll", onScroll);
        maybeOpen();
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Clean up once it has actually fired. */
    var stop = setInterval(function () {
      if (triggered) {
        window.removeEventListener("scroll", onScroll);
        clearInterval(stop);
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  /* Exposed so a "get 10% off" link anywhere can reopen it. */
  window.NostalgiaWelcomeOffer = { open: open, close: close };
})();
