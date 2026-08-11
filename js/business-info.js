/*
 * Nostalgia — trader identity, single source of truth.
 *
 * Greek and EU consumer law require a distance seller's identity (legal name,
 * registered address, tax number, chamber/registry number) to be directly and
 * permanently accessible — not only inside the privacy policy, which serves a
 * different obligation (GDPR Art. 13, who the data controller is).
 *
 * These values are transcribed from the official AADE "Βεβαίωση Τρέχουσας
 * Εικόνας Δραστηριοτήτων Ατομικής Επιχείρησης" and the Βιοτεχνικό Επιμελητήριο
 * Θεσσαλονίκης registration. They previously lived hand-typed in two places and
 * had drifted (wrong street, wrong ΔΟΥ) — hence one object, referenced
 * everywhere, so a correction can only ever be made once.
 */
(function () {
  var BUSINESS = {
    legalName: "Γεροστάθη Μαρία του Ιωάννη",
    legalNameEn: "Gerostathi Maria tou Ioanni",
    tradeName: "Nostalgia Collection",

    afm: "066971593",
    doy: "Δ΄ Θεσσαλονίκης",
    doyEn: "D΄ Thessaloniki",

    street: "Ιβηρίδος 2",
    streetEn: "2 Iviridos St.",
    postcode: "543 51",
    city: "Θεσσαλονίκη",
    cityEn: "Thessaloniki",
    country: "Ελλάδα",
    countryEn: "Greece",

    startDate: "04/06/2026",
    chamber: "Βιοτεχνικό Επιμελητήριο Θεσσαλονίκης",
    chamberEn: "Thessaloniki Chamber of Small Industries",

    gemi: "195495706000",
    /* European Unique Identifier, kept for the record. Not rendered: Greek
       shops are asked for the ΓΕΜΗ number, and the EUID only restates it with
       a country prefix. */
    euid: "ELGEMI.195495706000",

    privacyEmail: "privacy@nostalgiacandle.gr",
    supportEmail: "support@nostalgiacandle.gr",
  };

  function isEn() {
    var lang = "";
    try {
      lang = localStorage.getItem("nostalgia-lang") || "";
    } catch (e) {}
    if (!lang) lang = document.documentElement.getAttribute("lang") || "";
    return /^en/i.test(lang);
  }

  function address(en) {
    return en
      ? BUSINESS.streetEn + ", " + BUSINESS.postcode + " " + BUSINESS.cityEn + ", " + BUSINESS.countryEn
      : BUSINESS.street + ", " + BUSINESS.postcode + " " + BUSINESS.city;
  }

  /* One line, dot-separated — the format Greek shops conventionally use in a
     footer, and short enough not to compete with the rest of the bar. */
  function line(en) {
    var parts = en
      ? [
          BUSINESS.legalNameEn + " — " + BUSINESS.tradeName,
          "Greek VAT no. (ΑΦΜ): " + BUSINESS.afm,
          "Tax office: " + BUSINESS.doyEn,
          address(true),
        ]
      : [
          BUSINESS.legalName + " — " + BUSINESS.tradeName,
          "ΑΦΜ: " + BUSINESS.afm,
          "ΔΟΥ: " + BUSINESS.doy,
          address(false),
        ];
    if (BUSINESS.gemi) parts.splice(2, 0, (en ? "GEMI no.: " : "ΓΕΜΗ: ") + BUSINESS.gemi);
    return parts.join(" · ");
  }

  function render() {
    var bar = document.querySelector(".site-footer__bar");
    if (!bar) return false;
    var identity = bar.querySelector(".site-footer__identity");
    var el = bar.querySelector(".site-footer__business");
    if (!el) {
      el = document.createElement("p");
      el.className = "site-footer__business";
      if (identity) {
        var copyright = identity.querySelector(".site-footer__copyright");
        identity.insertBefore(el, copyright || null);
      } else {
        bar.appendChild(el);
      }
    }
    el.textContent = line(isEn());
    return true;
  }

  /* The footer is inline HTML on most pages but injected at runtime by
     site-chrome.js on a few, so a single pass at DOMContentLoaded would miss
     those. Watch until it exists, then stop watching. */
  function watch() {
    if (render()) return;
    var obs = new MutationObserver(function () {
      if (render()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    /* Never leave an observer running on a page that simply has no footer. */
    setTimeout(function () {
      obs.disconnect();
    }, 10000);
  }

  window.addEventListener("nostalgia-i18n-updated", render);
  window.addEventListener("nostalgia-locale-updated", render);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }

  window.NostalgiaBusiness = { data: BUSINESS, line: line, address: address, render: render };
})();
