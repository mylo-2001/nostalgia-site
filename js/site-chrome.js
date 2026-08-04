(function () {
  var initialized = false;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function syncAnnouncementOffset(bar) {
    var el = bar || document.getElementById("site-announcement");
    var h = el ? Math.ceil(el.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--announce-h", h ? h + "px" : "0px");
  }

  function clearAnnouncementOffset() {
    document.documentElement.style.setProperty("--announce-h", "0px");
  }

  function ensureAnnouncement() {
    if (document.getElementById("site-announcement")) return;
    try {
      if (sessionStorage.getItem("nostalgia-announcement-dismissed") === "1") return;
    } catch (e) {}

    var bar = document.createElement("div");
    bar.className = "site-announcement";
    bar.id = "site-announcement";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Announcement");
    bar.innerHTML =
      '<p class="site-announcement__text" data-i18n="announcement_shipping">' +
      escapeHtml(t("announcement_shipping")) +
      "</p>" +
      '<button type="button" class="site-announcement__close" data-announcement-close aria-label="Close">×</button>';

    var wrap = document.querySelector(".page-wrap") || document.body;
    /* Prefer a direct .page-wrap > .site-header child. On home, inertial scroll
       may move the header into .hero-home — then insert at the top of page-wrap. */
    var header = wrap.querySelector(":scope > .site-header");
    if (header && header.parentNode === wrap) {
      wrap.insertBefore(bar, header);
    } else {
      wrap.insertBefore(bar, wrap.firstChild || null);
    }
    document.body.classList.add("has-announcement");
    syncAnnouncementOffset(bar);
    window.addEventListener("resize", function () {
      syncAnnouncementOffset(bar);
    }, { passive: true });

    bar.querySelector("[data-announcement-close]").addEventListener("click", function () {
      bar.remove();
      document.body.classList.remove("has-announcement");
      clearAnnouncementOffset();
      try {
        sessionStorage.setItem("nostalgia-announcement-dismissed", "1");
      } catch (e) {}
    });
  }

  function preFooterTemplate() {
    return (
      '<div class="site-prefooter" id="site-prefooter">' +
      '  <section class="site-promise" data-i18n-aria="footer_promise_aria" aria-label="' +
      escapeHtml(t("footer_promise_aria")) +
      '">' +
      '    <div class="site-promise__inner">' +
      '      <article class="site-promise__item">' +
      '        <span class="site-promise__title" data-i18n="footer_promise_1_title">' +
      escapeHtml(t("footer_promise_1_title")) +
      "</span>" +
      '        <p class="site-promise__text" data-i18n="footer_promise_1_text">' +
      escapeHtml(t("footer_promise_1_text")) +
      "</p></article>" +
      '      <article class="site-promise__item">' +
      '        <span class="site-promise__title" data-i18n="footer_promise_2_title">' +
      escapeHtml(t("footer_promise_2_title")) +
      "</span>" +
      '        <p class="site-promise__text" data-i18n="footer_promise_2_text">' +
      escapeHtml(t("footer_promise_2_text")) +
      "</p></article>" +
      '      <article class="site-promise__item">' +
      '        <span class="site-promise__title" data-i18n="footer_promise_3_title">' +
      escapeHtml(t("footer_promise_3_title")) +
      "</span>" +
      '        <p class="site-promise__text" data-i18n="footer_promise_3_text">' +
      escapeHtml(t("footer_promise_3_text")) +
      "</p></article>" +
      '      <article class="site-promise__item">' +
      '        <span class="site-promise__title" data-i18n="footer_promise_4_title">' +
      escapeHtml(t("footer_promise_4_title")) +
      "</span>" +
      '        <p class="site-promise__text" data-i18n="footer_promise_4_text">' +
      escapeHtml(t("footer_promise_4_text")) +
      "</p></article>" +
      "    </div>" +
      "  </section>" +
      "</div>"
    );
  }

  var FOOTER_ORNAMENT =
    '<span class="site-footer__ornament" aria-hidden="true"></span>';

  function footerTemplate() {
    return (
      '<div class="site-footer__layout site-footer__layout--rich">' +
      '  <div class="site-footer__center site-footer__center--brand">' +
      '    <a class="site-footer__logo" href="/" data-i18n-aria="logo_aria">' +
      '      <img class="brand-logo brand-logo--dark" src="images/logo/logo.png" width="240" height="70" alt="Nostalgia Collection" />' +
      '      <img class="brand-logo brand-logo--light" src="images/logo/logo%20light.png?v=2" width="240" height="70" alt="Nostalgia Collection" />' +
      "    </a>" +
      '    <p class="site-footer__tagline" data-i18n="footer_tagline">' + t("footer_tagline") + "</p>" +
      '    <ul class="site-footer__lines">' +
      '      <li class="site-footer__line">' +
      '        <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
      '        <span data-i18n="footer_address">' + t("footer_address") + "</span>" +
      "      </li>" +
      '      <li class="site-footer__line">' +
      '        <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M5 4h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>' +
      '        <a href="tel:+306939411774">+30 693 941 1774</a>' +
      "      </li>" +
      '      <li class="site-footer__line">' +
      '        <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '        <a href="mailto:info@nostalgiacandle.gr">info@nostalgiacandle.gr</a>' +
      "      </li>" +
      "    </ul>" +
      "  </div>" +
      '  <div class="site-footer__links">' +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_orders_title">' + t("footer_orders_title") + "</h4>" +
      FOOTER_ORNAMENT +
      '      <ul class="site-footer__list">' +
      "        <li><a href=\"/account\" data-i18n=\"account_my_account\">" + t("account_my_account") + "</a></li>" +
      '        <li><a href="/wishlist" data-i18n="footer_wishlist">' + t("footer_wishlist") + "</a></li>" +
      '        <li><a href="/shipping-returns" data-i18n="footer_shipping_returns">' + t("footer_shipping_returns") + "</a></li>" +
      '        <li><a href="/payments" data-i18n="footer_payments">' + t("footer_payments") + "</a></li>" +
      '        <li><a href="/faq" data-i18n="footer_faq">' + t("footer_faq") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_services_title">' + t("footer_services_title") + "</h4>" +
      FOOTER_ORNAMENT +
      '      <ul class="site-footer__list">' +
      '        <li><a href="/new-arrivals" data-i18n="nav_new_arrivals">' + t("nav_new_arrivals") + "</a></li>" +
      '        <li><a href="/sale" data-i18n="nav_sale">' + t("nav_sale") + "</a></li>" +
      '        <li><a href="/seasonal">Seasonal Editions</a></li>' +
      '        <li><a href="/scent-finder" data-i18n="nav_scent_finder">' + t("nav_scent_finder") + "</a></li>" +
      '        <li><a href="/gift-experience" data-i18n="nav_gift">' + t("nav_gift") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_information_title">' + t("footer_information_title") + "</h4>" +
      FOOTER_ORNAMENT +
      '      <ul class="site-footer__list">' +
      '        <li><a href="/about" data-i18n="nav_about">' + t("nav_about") + "</a></li>" +
      '        <li><a href="/journal" data-i18n="footer_journal">' + t("footer_journal") + "</a></li>" +
      '        <li><a href="/contact" data-i18n="nav_contact">' + t("nav_contact") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      '    <section class="site-footer__col site-footer__col--follow">' +
      '      <h4 data-i18n="footer_follow_title">' + t("footer_follow_title") + "</h4>" +
      FOOTER_ORNAMENT +
      '      <div class="site-footer__socials">' +
      '        <a class="site-footer__social-link" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">' +
      '          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/></svg>' +
      "        </a>" +
      '        <a class="site-footer__social-link" href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">' +
      '          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 8.5V6.8c0-.6.4-.8.8-.8h1.8V3h-2.5c-2.8 0-3.4 2-3.4 3.3v2.2H8v3h2.2V21h3.3v-6.5h2.2l.4-3h-2.6z"/></svg>' +
      "        </a>" +
      '        <a class="site-footer__social-link" href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">' +
      '          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.2 8.7A1.9 1.9 0 1 1 6.2 5a1.9 1.9 0 0 1 0 3.7zM4.6 9.9h3.2V20H4.6zM9.8 9.9h3v1.4h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3.2v-4.7c0-1.1 0-2.5-1.6-2.5s-1.8 1.2-1.8 2.4V20H9.8z"/></svg>' +
      "        </a>" +
      '        <a class="site-footer__social-link" href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok">' +
      '          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.8 4c.5 1.4 1.5 2.5 2.9 3.1.8.3 1.6.5 2.3.5v2.8c-1 0-2-.2-2.9-.6v5.6c0 2.7-2.2 4.9-4.9 4.9a4.9 4.9 0 0 1 0-9.8c.3 0 .6 0 .9.1v2.9a2 2 0 0 0-.9-.2 2.1 2.1 0 1 0 2.1 2.1V4h2.5z"/></svg>' +
      "        </a>" +
      '        <a class="site-footer__social-link" href="https://www.pinterest.com/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest">' +
      '          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-3.3 17.4l1.2-4.4c-.3-.7-.6-1.7-.6-2.8 0-2.3 1.3-4 3.1-4 1.5 0 2.2 1.1 2.2 2.5 0 1.5-1 3.8-1.5 5.9-.4 1.7.9 3.1 2.6 3.1 3.2 0 5.3-4.1 5.3-8.9A8.3 8.3 0 0 0 12 3zm0 0"/></svg>' +
      "        </a>" +
      "      </div>" +
      '      <div class="site-footer__emails-heading">' +
      '        <svg viewBox="0 0 32 24" aria-hidden="true"><rect x="2.5" y="3.5" width="27" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="m4 6 12 8 12-8" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '        <span>Nostalgia Emails</span>' +
      "      </div>" +
      FOOTER_ORNAMENT +
      '      <ul class="site-footer__lines site-footer__emails">' +
      '        <li class="site-footer__line">' +
      '          <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '          <a href="mailto:support@nostalgiacandle.gr">support@nostalgiacandle.gr</a>' +
      "        </li>" +
      '        <li class="site-footer__line">' +
      '          <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '          <a href="mailto:privacy@nostalgiacandle.gr">privacy@nostalgiacandle.gr</a>' +
      "        </li>" +
      '        <li class="site-footer__line">' +
      '          <svg class="site-footer__line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '          <a href="mailto:partners@nostalgiacandle.gr">partners@nostalgiacandle.gr</a>' +
      "        </li>" +
      "      </ul>" +
      "    </section>" +
      "  </div>" +
      "</div>" +
      '<div class="site-footer__bar">' +
      '  <nav class="site-footer__legal site-footer__legal--bottom">' +
      '    <a href="/terms" data-i18n="footer_terms">Terms</a>' +
      '    <a href="/privacy" data-i18n="footer_privacy">Privacy</a>' +
      "  </nav>" +
      '  <p class="site-footer__copyright" data-i18n="footer_copyright">' + t("footer_copyright") + "</p>" +
      '  <div class="site-footer__payments" aria-label="Accepted payments">' +
      '    <span class="site-footer__pay site-footer__pay--stripe">stripe</span>' +
      '    <span class="site-footer__pay site-footer__pay--visa">VISA</span>' +
      '    <span class="site-footer__pay site-footer__pay--mc" aria-label="Mastercard">' +
      '      <svg viewBox="0 0 36 24" aria-hidden="true"><circle cx="15" cy="12" r="7" fill="#eb001b"/><circle cx="21" cy="12" r="7" fill="#f79e1b"/><path fill="#ff5f00" d="M18 6.5a7 7 0 0 0 0 11 7 7 0 0 0 0-11z"/></svg>' +
      "    </span>" +
      '    <span class="site-footer__pay site-footer__pay--ssl">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
      "      <span>SSL Secure</span>" +
      "    </span>" +
      "  </div>" +
      "</div>" +
      '<div class="site-footer__partners" aria-label="Partners and service providers">' +
      '  <span class="site-footer__partners-title">Partners</span>' +
      '  <a class="site-footer__partner site-footer__partner--acs" href="https://www.acscourier.net/" target="_blank" rel="noopener noreferrer" aria-label="ACS Courier"><img src="images/sunergates-logo/acs-logo.webp" alt="ACS Courier" loading="lazy" /></a>' +
      '  <a class="site-footer__partner" href="https://www.pointer.gr/" target="_blank" rel="noopener noreferrer" aria-label="Pointer.gr"><img src="images/sunergates-logo/pointer-logo.webp" alt="Pointer.gr" loading="lazy" /></a>' +
      '  <a class="site-footer__partner" href="https://www.papaki.com/" target="_blank" rel="noopener noreferrer" aria-label="Papaki"><img src="images/sunergates-logo/papaki-logo.webp" alt="Papaki" loading="lazy" /></a>' +
      '  <a class="site-footer__partner" href="https://www.cpanel.net/" target="_blank" rel="noopener noreferrer" aria-label="cPanel"><img src="images/sunergates-logo/cpanel-logo.webp" alt="cPanel" loading="lazy" /></a>' +
      "</div>"
    );
  }

  function ensurePreFooter() {
    if (document.getElementById("site-prefooter")) return;
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    var wrap = footer.closest(".page-wrap") || document.body;
    var prefooter = document.createElement("div");
    prefooter.innerHTML = preFooterTemplate();
    var node = prefooter.firstElementChild;
    if (!node) return;
    wrap.insertBefore(node, footer);
  }

  function newsletterBandTemplate() {
    return (
      '<section class="site-newsletter" id="site-newsletter" aria-labelledby="site-newsletter-title">' +
      '  <div class="site-newsletter__media" aria-hidden="true">' +
      "    <picture>" +
      '      <source type="image/webp" srcset="images/home%20page%20photo/gift-set-home-photo-480w.webp 480w, images/home%20page%20photo/gift-set-home-photo-960w.webp 960w, images/home%20page%20photo/gift-set-home-photo-1440w.webp 1440w" sizes="100vw" />' +
      '      <img src="images/home%20page%20photo/gift-set-home-photo.webp" alt="" width="1440" height="900" loading="lazy" decoding="async" />' +
      "    </picture>" +
      "  </div>" +
      '  <div class="site-newsletter__veil" aria-hidden="true"></div>' +
      '  <div class="site-newsletter__inner">' +
      '    <div class="site-newsletter__panel">' +
      '      <span class="site-newsletter__mark" aria-hidden="true">' +
      '        <svg viewBox="0 0 48 28" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '          <path d="M8 20c6-1 10-7 12-14 1 6 5 12 12 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
      '          <path d="M20 6c2 4 4 8 4 14" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
      "        </svg>" +
      "      </span>" +
      '      <h2 class="site-newsletter__title" id="site-newsletter-title" data-i18n="footer_newsletter_title">' +
      escapeHtml(t("footer_newsletter_title")) +
      "</h2>" +
      '      <p class="site-newsletter__lead" data-i18n="footer_newsletter_lead">' +
      escapeHtml(t("footer_newsletter_lead")) +
      "</p>" +
      '      <form class="site-newsletter__form" id="site-newsletter-form" novalidate>' +
      '        <div class="site-newsletter__field">' +
      '          <label class="visually-hidden" for="site-newsletter-email" data-i18n="newsletter_email_ph">' +
      escapeHtml(t("newsletter_email_ph")) +
      "</label>" +
      '          <input type="email" id="site-newsletter-email" name="email" required autocomplete="email" data-i18n-placeholder="footer_news_placeholder" placeholder="' +
      escapeHtml(t("footer_news_placeholder")) +
      '" />' +
      '          <button type="submit" class="site-newsletter__submit" data-i18n="footer_newsletter_submit">' +
      escapeHtml(t("footer_newsletter_submit")) +
      "</button>" +
      "        </div>" +
      '        <p class="site-newsletter__success" id="site-newsletter-success" hidden data-i18n="newsletter_success">' +
      escapeHtml(t("newsletter_success")) +
      "</p>" +
      "      </form>" +
      "    </div>" +
      "  </div>" +
      "</section>"
    );
  }

  function ensureNewsletterBand() {
    if (document.getElementById("site-newsletter")) return;
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    var wrap = footer.closest(".page-wrap") || document.body;
    var holder = document.createElement("div");
    holder.innerHTML = newsletterBandTemplate();
    var node = holder.firstElementChild;
    if (!node) return;
    wrap.insertBefore(node, footer);
  }

  function enhanceFooter() {
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    footer.innerHTML = footerTemplate();
  }

  function ensureFooterStyles() {
    var legacy = document.getElementById("site-chrome-footer-style");
    if (legacy) legacy.remove();
    ["site-chrome-footer-style-v15", "site-chrome-footer-style-v16", "site-chrome-footer-style-v17", "site-chrome-footer-style-v18"].forEach(function (id) {
      var old = document.getElementById(id);
      if (old) old.remove();
    });
    if (document.getElementById("site-chrome-footer-style-v19")) return;
    var style = document.createElement("style");
    style.id = "site-chrome-footer-style-v19";
    style.textContent = `
      .site-footer {
        padding-top: 3rem;
      }
      .site-footer__layout--rich {
        display: grid;
        grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
        align-items: start;
        gap: 2rem clamp(1.75rem, 3.5vw, 3.25rem);
        width: 100%;
        max-width: var(--site-max, 1320px);
        margin: 0 auto;
      }
      .site-footer__center--brand {
        grid-column: 1;
        max-width: 24rem;
        text-align: left;
      }
      .site-footer__center--brand .site-footer__logo {
        display: inline-flex;
        justify-content: flex-start;
        margin: 0 0 1.1rem;
      }
      .site-footer__center--brand .site-footer__logo img {
        width: auto;
        height: clamp(84px, 8vw, 108px);
      }
      .site-footer__center--brand .site-footer__tagline {
        text-align: left;
        margin: 0 0 1.15rem;
        font-family: var(--font-body);
        font-size: 0.98rem;
        line-height: 1.55;
      }
      .site-footer__lines {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.72rem;
        text-align: left;
      }
      .site-footer__line {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-family: var(--font-body);
        font-size: 0.95rem;
        line-height: 1.4;
        color: var(--ink-muted);
      }
      .site-footer__line a {
        color: var(--ink-muted);
        text-decoration: none;
        transition: color 0.25s ease;
      }
      .site-footer__line a:hover {
        color: var(--accent);
      }
      .site-footer__line-icon {
        flex: none;
        width: 1.05rem;
        height: 1.05rem;
        color: var(--accent);
      }
      .site-footer__links {
        grid-column: 2;
        display: grid;
        grid-template-columns: repeat(3, minmax(6.75rem, 8.75rem)) minmax(12rem, 15.5rem);
        /* Hug the right edge: the columns have capped widths, so any leftover
           space in the track goes to the LEFT instead of dead space on the right. */
        justify-content: end;
        align-items: start;
        gap: 1.4rem clamp(1rem, 2.2vw, 1.85rem);
        max-width: none;
      }
      .site-footer__col {
        display: flex;
        flex-direction: column;
      }
      .site-footer__col h4 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 0.98rem;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink);
      }
      .site-footer__ornament {
        display: block;
        position: relative;
        width: 4.5rem;
        height: 0.6rem;
        margin: 0.55rem 0 1.05rem;
      }
      .site-footer__ornament::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(to right, rgba(157, 120, 65, 0), var(--accent) 50%, rgba(157, 120, 65, 0));
      }
      .site-footer__ornament::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0.4rem;
        height: 0.4rem;
        margin: -0.2rem 0 0 -0.2rem;
        background: var(--accent);
        transform: rotate(45deg);
      }
      .site-footer__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .site-footer__list a {
        position: relative;
        display: inline-block;
        width: fit-content;
        font-family: var(--font-body);
        font-size: 1.02rem;
        line-height: 1.35;
        color: var(--ink-muted);
        text-decoration: none;
        transition: color 0.28s ease, transform 0.28s ease;
      }
      .site-footer__list a::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -0.1rem;
        height: 1px;
        background: var(--accent);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .site-footer__list a:hover {
        color: var(--accent);
        transform: translateX(3px);
      }
      .site-footer__list a:hover::after {
        transform: scaleX(1);
      }
      .site-footer__col--follow {
        min-width: 12rem;
      }
      .site-footer__emails a {
        font-size: 0.82rem;
        color: var(--ink-muted);
        word-break: break-all;
      }
      .site-footer__socials {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.72rem;
        margin: 0 0 1.3rem;
      }
      .site-footer__social-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.2rem;
        height: 2.2rem;
        border: 1px solid var(--rule-hairline);
        border-radius: 50%;
        color: var(--ink-muted);
        text-decoration: none;
        transition: color 0.25s ease, border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
      }
      .site-footer__social-link svg {
        display: block;
        width: 1.05rem;
        height: 1.05rem;
      }
      .site-footer__social-link:hover {
        color: var(--accent);
        border-color: var(--accent);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(157, 120, 65, 0.22);
      }
      .site-footer__news-lead {
        margin: 0 0 0.85rem;
        max-width: 15rem;
        font-family: var(--font-body);
        font-size: 0.92rem;
        line-height: 1.55;
        color: var(--ink-muted);
      }
      .site-footer__news-field {
        display: flex;
        align-items: stretch;
        max-width: 17rem;
        border: 1px solid var(--rule-hairline);
        border-radius: 6px;
        overflow: hidden;
        background: var(--surface-paper, #fff);
        box-shadow: 0 1px 2px rgba(20, 17, 14, 0.04);
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .site-footer__news-field:focus-within {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(157, 120, 65, 0.14);
      }
      .site-footer__news-field input {
        flex: 1 1 auto;
        min-width: 0;
        border: 0;
        background: transparent;
        padding: 0.68rem 0.9rem;
        font-family: var(--font-body);
        font-size: 0.92rem;
        color: var(--ink);
      }
      .site-footer__news-field input::placeholder {
        color: var(--ink-muted);
        opacity: 0.65;
      }
      .site-footer__news-field input:focus {
        outline: none;
      }
      .site-footer__news-submit {
        flex: none;
        border: 0;
        background: var(--accent);
        color: #fff;
        padding: 0 1.25rem;
        font-family: var(--font-nav);
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.25s ease;
      }
      .site-footer__news-submit:hover {
        background: var(--ink);
      }
      .site-footer__news-success {
        margin: 0.6rem 0 0;
        font-family: var(--font-body);
        font-size: 0.85rem;
        color: var(--accent);
      }
      .site-footer__bar {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.75rem 1.5rem;
      }
      .site-footer__legal--bottom {
        display: inline-flex;
        gap: 0.9rem;
        justify-self: start;
      }
      .site-footer__legal--bottom a {
        font-family: var(--font-nav);
        font-size: 0.6rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .site-footer__legal--bottom a:hover {
        color: var(--accent);
      }
      .site-footer__copyright {
        font-family: var(--font-nav);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        color: var(--ink-muted);
        text-align: center;
      }
      .site-footer__payments {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        justify-self: end;
      }
      .site-footer__partners {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.55rem;
        width: 100%;
        margin-top: 1.15rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--rule-hairline);
      }
      .site-footer__partners-title {
        margin-right: 0.25rem;
        color: var(--ink-muted);
        font-family: var(--font-nav);
        font-size: 0.58rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .site-footer__partner {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 6.25rem;
        height: 2.15rem;
        padding: 0.22rem 0.42rem;
        overflow: hidden;
        border: 1px solid var(--rule-hairline);
        border-radius: 0.3rem;
        background: #fff;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .site-footer__partner:hover,
      .site-footer__partner:focus-visible {
        opacity: 0.82;
        transform: translateY(-1px);
      }
      .site-footer__partner img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .site-footer__emails-heading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 1.15rem 0 0.2rem;
        color: var(--footer-ink);
        font-family: var(--font-display);
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .site-footer__emails-heading svg {
        width: 1rem;
        height: 0.8rem;
        flex: 0 0 auto;
        color: var(--accent);
      }
      .site-footer__partner--acs img {
        width: 86%;
        height: 86%;
        mix-blend-mode: multiply;
      }
      .site-footer__pay {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        height: 1.7rem;
        padding: 0 0.55rem;
        border: 1px solid var(--rule-hairline);
        border-radius: 4px;
        background: #fff;
        font-family: var(--font-nav);
        font-size: 0.62rem;
        line-height: 1;
      }
      .site-footer__pay--stripe {
        color: #635bff;
        font-weight: 700;
        font-style: italic;
      }
      .site-footer__pay--visa {
        color: #1a1f71;
        font-weight: 800;
        font-style: italic;
        letter-spacing: 0.05em;
      }
      .site-footer__pay--mc svg {
        width: 2rem;
        height: 1.15rem;
      }
      .site-footer__pay--ssl {
        color: #2f7d4f;
      }
      .site-footer__pay--ssl svg {
        width: 0.85rem;
        height: 0.85rem;
      }
      .site-footer__pay--ssl span {
        color: #5c5c5c;
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }
      @media (max-width: 1080px) {
        .site-footer__layout--rich {
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        .site-footer__links {
          grid-column: 1;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.75rem clamp(1rem, 4vw, 2.5rem);
        }
        .site-footer__col--follow {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 720px) {
        .site-footer__bar {
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
          gap: 1rem;
        }
        .site-footer__legal--bottom,
        .site-footer__payments {
          justify-self: center;
        }
        .site-footer__payments {
          flex-wrap: wrap;
          justify-content: center;
        }
      }
      @media (max-width: 480px) {
        .site-footer__links {
          grid-template-columns: 1fr;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .site-footer__list a,
        .site-footer__list a::after,
        .site-footer__social-link {
          transition: none;
        }
      }

      /* ——— Newsletter band above footer ——— */
      .site-newsletter {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        min-height: clamp(18rem, 34vw, 24rem);
        margin: 0;
        color: #2a2118;
      }
      .site-newsletter__media,
      .site-newsletter__veil {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .site-newsletter__media {
        z-index: 0;
      }
      .site-newsletter__media picture,
      .site-newsletter__media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: 72% 45%;
      }
      .site-newsletter__veil {
        z-index: 1;
        /* Light mode: keep enough cream behind the copy for contrast, but stay
           translucent so the photo actually reads through instead of washing
           out to a flat block. Raise/lower the first two stops to taste. */
        background:
          linear-gradient(90deg,
            rgba(245, 236, 224, 0.86) 0%,
            rgba(245, 236, 224, 0.78) 34%,
            rgba(245, 236, 224, 0.42) 52%,
            rgba(245, 236, 224, 0.10) 72%,
            rgba(245, 236, 224, 0) 88%),
          linear-gradient(180deg, rgba(20, 14, 10, 0.04), rgba(20, 14, 10, 0.12));
      }
      .site-newsletter__inner {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        width: min(100% - 2rem, var(--site-max, 1320px));
        min-height: inherit;
        margin: 0 auto;
        padding: clamp(2rem, 5vw, 3.25rem) 0;
      }
      .site-newsletter__panel {
        width: min(100%, 28rem);
        padding: clamp(0.25rem, 1vw, 0.5rem) 0;
      }
      .site-newsletter__mark {
        display: inline-flex;
        color: #8a6a3d;
        margin: 0 0 0.85rem;
      }
      .site-newsletter__mark svg {
        width: 2.6rem;
        height: 1.5rem;
      }
      .site-newsletter__title {
        margin: 0 0 0.7rem;
        font-family: var(--font-display);
        font-size: clamp(1.35rem, 2.6vw, 2rem);
        font-weight: 500;
        letter-spacing: 0.06em;
        line-height: 1.2;
        text-transform: uppercase;
        color: #2a2118;
      }
      .site-newsletter__lead {
        margin: 0 0 1.25rem;
        max-width: 26rem;
        font-family: var(--font-body);
        font-size: clamp(0.92rem, 1.4vw, 1.05rem);
        line-height: 1.55;
        color: rgba(42, 33, 24, 0.72);
      }
      .site-newsletter__field {
        display: flex;
        align-items: stretch;
        max-width: 26rem;
        border-radius: 2px;
        overflow: hidden;
        background: rgba(252, 247, 239, 0.92);
        box-shadow: 0 10px 28px rgba(42, 33, 24, 0.1);
      }
      .site-newsletter__field input {
        flex: 1 1 auto;
        min-width: 0;
        border: 0;
        background: transparent;
        padding: 0.95rem 1.05rem;
        font-family: var(--font-body);
        font-size: 0.98rem;
        color: #2a2118;
      }
      .site-newsletter__field input::placeholder {
        color: rgba(42, 33, 24, 0.45);
      }
      .site-newsletter__field input:focus {
        outline: none;
      }
      .site-newsletter__submit {
        flex: none;
        border: 0;
        padding: 0 1.35rem;
        background: #3a2c20;
        color: #f7f0e6;
        font-family: var(--font-display);
        font-size: 0.78rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.25s ease;
      }
      .site-newsletter__submit:hover {
        background: #5a4330;
      }
      .site-newsletter__success {
        margin: 0.85rem 0 0;
        font-family: var(--font-body);
        font-size: 0.95rem;
        color: #5a4330;
      }
      [data-theme="dark"] .site-newsletter {
        color: #f3ebe0;
      }
      [data-theme="dark"] .site-newsletter__veil {
        background:
          linear-gradient(90deg,
            rgba(18, 14, 11, 0.94) 0%,
            rgba(18, 14, 11, 0.88) 38%,
            rgba(18, 14, 11, 0.4) 58%,
            rgba(18, 14, 11, 0.08) 78%,
            transparent 92%),
          linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.28));
      }
      [data-theme="dark"] .site-newsletter__title {
        color: #f3ebe0;
      }
      [data-theme="dark"] .site-newsletter__lead {
        color: rgba(243, 235, 224, 0.72);
      }
      [data-theme="dark"] .site-newsletter__mark {
        color: var(--accent);
      }
      [data-theme="dark"] .site-newsletter__field {
        background: rgba(255, 255, 255, 0.08);
        box-shadow: none;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      [data-theme="dark"] .site-newsletter__field input {
        color: #f3ebe0;
      }
      [data-theme="dark"] .site-newsletter__field input::placeholder {
        color: rgba(243, 235, 224, 0.45);
      }
      [data-theme="dark"] .site-newsletter__submit {
        background: var(--accent);
        color: #1a1410;
      }
      [data-theme="dark"] .site-newsletter__success {
        color: var(--accent);
      }
      @media (max-width: 760px) {
        .site-newsletter {
          min-height: 22rem;
        }
        .site-newsletter__media img {
          object-position: 80% 40%;
        }
        .site-newsletter__veil {
          background:
            linear-gradient(180deg,
              rgba(245, 236, 224, 0.96) 0%,
              rgba(245, 236, 224, 0.9) 48%,
              rgba(245, 236, 224, 0.55) 70%,
              rgba(245, 236, 224, 0.2) 100%);
        }
        [data-theme="dark"] .site-newsletter__veil {
          background:
            linear-gradient(180deg,
              rgba(18, 14, 11, 0.94) 0%,
              rgba(18, 14, 11, 0.88) 50%,
              rgba(18, 14, 11, 0.55) 100%);
        }
        .site-newsletter__inner {
          align-items: flex-start;
          padding-top: 2.25rem;
          padding-bottom: 2.25rem;
        }
        .site-newsletter__field {
          flex-direction: column;
        }
        .site-newsletter__submit {
          padding: 0.9rem 1.1rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  var SEARCH_ICON =
    '<svg class="site-search-trigger__icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
    '<circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.65"/>' +
    '<path d="M15.2 15.2L19 19" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>' +
    "</svg>";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getLang() {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.getLang === "function") {
      return window.NostalgiaI18n.getLang();
    }
    return "el";
  }

  function formatSearchPrice(amount) {
    if (window.NostalgiaOrderFees && typeof window.NostalgiaOrderFees.formatPrice === "function") {
      return window.NostalgiaOrderFees.formatPrice(amount, getLang());
    }
    var n = Number(amount || 0).toFixed(2);
    return "€" + n.replace(".", ",");
  }

  function formatResultsCount(count) {
    if (count === 1) return t("search_results_count_one");
    return t("search_results_count").replace("{n}", String(count));
  }

  function isInStock(stock) {
    return stock == null || Number(stock) > 0;
  }

  /* Lowercase + strip accents so "βανιλια" matches "βανίλια" (same approach
     as the Scent Finder). */
  function normalizeText(str) {
    var s = String(str == null ? "" : str).toLowerCase();
    if (s.normalize) {
      s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
    return s;
  }

  function buildSearchIndex() {
    var items = [];
    var NP = window.NostalgiaProducts;
    if (NP && typeof NP.getAll === "function") {
      items = NP.getAll().map(function (p) {
        var price = typeof NP.getEffectivePrice === "function" ? NP.getEffectivePrice(p) : p.price;
        return {
          title: p.title,
          subtitle: p.categoryName,
          image: p.image,
          href: NP.getProductUrl ? NP.getProductUrl(p.id) : "/product/" + encodeURIComponent(p.id),
          price: price,
          inStock: isInStock(p.stock),
          search: normalizeText(
            (p.title || "") + " " + (p.categoryName || "") + " " + (p.description || "")
          ),
        };
      });
    }
    return items;
  }

  function getSearchMount() {
    var mobile =
      window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    if (mobile) {
      var slot = document.getElementById("site-header-search-slot");
      if (slot) return slot;
    }
    var tools = document.querySelector(".site-header__tools");
    if (tools) return tools;
    var bar = document.querySelector(".site-header__bar");
    var trigger = document.getElementById("side-nav-trigger");
    if (bar && trigger) return { parent: bar, before: trigger.nextSibling };
    var navRight = document.querySelector(".site-nav--right");
    return navRight || null;
  }

  function mountSearchTrigger(btn) {
    var mount = getSearchMount();
    if (!mount) return false;
    if (mount.parent) {
      mount.parent.insertBefore(btn, mount.before || null);
      return true;
    }
    if (btn.parentNode === mount) return true;
    var lang = document.getElementById("lang-toggle");
    if (lang && lang.parentNode === mount) mount.insertBefore(btn, lang);
    else mount.insertBefore(btn, mount.firstChild || null);
    return true;
  }

  function ensureSearchTrigger() {
    var btn = document.getElementById("site-search-trigger");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "site-search-trigger";
      btn.id = "site-search-trigger";
      btn.setAttribute("aria-controls", "site-search-modal");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", t("search_label"));
      btn.innerHTML = SEARCH_ICON;
    }
    mountSearchTrigger(btn);
  }

  var searchDrawerApi = null;

  function bindSearchTriggers() {
    if (!searchDrawerApi) return;
    document.querySelectorAll(".site-search-trigger").forEach(function (btn) {
      if (btn.getAttribute("data-search-bound") === "1") return;
      btn.setAttribute("data-search-bound", "1");
      btn.addEventListener("click", function () {
        if (document.getElementById("site-search-modal").classList.contains("is-open")) {
          searchDrawerApi.close();
        } else {
          searchDrawerApi.open();
        }
      });
    });
  }

  function ensureSearch() {
    if (document.getElementById("site-search-modal")) {
      bindSearchTriggers();
      return;
    }

    var modal = document.createElement("aside");
    modal.id = "site-search-modal";
    modal.className = "site-search-drawer";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="site-search-drawer__backdrop" data-search-close tabindex="-1"></div>' +
      '<div class="site-search-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="site-search-drawer-title">' +
      '  <button type="button" class="site-search-drawer__close" data-search-close aria-label="' +
      escapeHtml(t("toast_close_aria")) +
      '">×</button>' +
      '  <div class="site-search-drawer__field">' +
      '    <label class="visually-hidden" for="site-search-drawer-input" id="site-search-drawer-title" data-i18n="search_label">' +
      t("search_label") +
      "</label>" +
      '    <input id="site-search-drawer-input" class="site-search-drawer__input" type="search" autocomplete="off" data-i18n-placeholder="search_placeholder" placeholder="' +
      escapeHtml(t("search_placeholder")) +
      '" />' +
      '    <span class="site-search-drawer__field-icon" aria-hidden="true">' +
      SEARCH_ICON +
      "</span>" +
      "  </div>" +
      '  <p class="site-search-drawer__suggest-title" data-search-suggest-title data-i18n="search_suggestions">' +
      t("search_suggestions") +
      "</p>" +
      '  <div class="site-search-drawer__results-head" data-search-results-head hidden>' +
      '    <p class="site-search-drawer__results-title" data-i18n="search_results_title">' +
      escapeHtml(t("search_results_title")) +
      "</p>" +
      '    <p class="site-search-drawer__results-count" data-search-results-count></p>' +
      "  </div>" +
      '  <ul class="site-search-drawer__list" data-search-list></ul>' +
      '  <a class="site-search-drawer__view-all" data-search-view-all href="/collection" hidden data-i18n="search_view_all">' +
      escapeHtml(t("search_view_all")) +
      "</a>" +
      "</div>";
    document.body.appendChild(modal);

    var input = modal.querySelector(".site-search-drawer__input");
    var list = modal.querySelector("[data-search-list]");
    var suggestTitle = modal.querySelector("[data-search-suggest-title]");
    var resultsHead = modal.querySelector("[data-search-results-head]");
    var resultsCount = modal.querySelector("[data-search-results-count]");
    var viewAll = modal.querySelector("[data-search-view-all]");
    var backdrop = modal.querySelector(".site-search-drawer__backdrop");
    var index = buildSearchIndex();
    var defaultSuggestions = index.slice(0, 4);
    var activeQuery = "";

    /* Keep the index fresh: admin products arrive async and titles change
       with the language. Rebuild, then re-render whatever is on screen. */
    function rebuildIndex() {
      index = buildSearchIndex();
      defaultSuggestions = index.slice(0, 4);
      if (modal.classList.contains("is-open")) {
        var q = normalizeText(input.value.trim());
        if (!q) renderList(defaultSuggestions, { isEmptyQuery: true });
        else renderList(filterIndex(q), { isEmptyQuery: false, query: input.value.trim(), totalCount: filterIndex(q).length });
      }
    }

    function filterIndex(normQuery) {
      return index.filter(function (item) {
        return item.search.indexOf(normQuery) !== -1;
      });
    }

    document.addEventListener("nostalgia-products-updated", rebuildIndex);
    document.addEventListener("nostalgia-stock-updated", rebuildIndex);

    function renderList(items, opts) {
      opts = opts || {};
      var isEmptyQuery = !!opts.isEmptyQuery;
      var totalCount = opts.totalCount != null ? opts.totalCount : items.length;
      var query = opts.query || "";
      activeQuery = isEmptyQuery ? "" : query;

      list.innerHTML = "";
      if (suggestTitle) suggestTitle.hidden = !isEmptyQuery;
      if (resultsHead) resultsHead.hidden = isEmptyQuery;
      if (resultsCount && !isEmptyQuery) {
        resultsCount.textContent = formatResultsCount(totalCount);
      }
      if (viewAll) {
        if (!isEmptyQuery && items.length) {
          viewAll.hidden = false;
          viewAll.href = "/collection?search=" + encodeURIComponent(query);
        } else {
          viewAll.hidden = true;
        }
      }

      if (!items.length) {
        var empty = document.createElement("li");
        empty.className = "site-search-drawer__empty";
        empty.textContent = t("search_no_results");
        list.appendChild(empty);
        if (viewAll) viewAll.hidden = true;
        return;
      }

      items.slice(0, 8).forEach(function (item) {
        var li = document.createElement("li");
        var priceHtml =
          item.price != null
            ? '<span class="site-search-drawer__product-price">' + escapeHtml(formatSearchPrice(item.price)) + "</span>"
            : "";
        var stockHtml = item.inStock
          ? '<span class="site-search-drawer__product-stock">' + escapeHtml(t("search_in_stock")) + "</span>"
          : "";
        li.innerHTML =
          '<a class="site-search-drawer__product" href="' +
          item.href +
          '">' +
          '<img class="site-search-drawer__product-img" src="' +
          escapeHtml(item.image || "") +
          '" alt="" loading="lazy" decoding="async" />' +
          '<span class="site-search-drawer__product-copy">' +
          '<span class="site-search-drawer__product-type">' +
          escapeHtml(item.subtitle) +
          "</span>" +
          '<span class="site-search-drawer__product-name">' +
          escapeHtml(item.title) +
          "</span>" +
          priceHtml +
          stockHtml +
          "</span>" +
          "</a>";
        list.appendChild(li);
      });
    }

    function setOpen(open) {
      modal.hidden = !open;
      modal.setAttribute("aria-hidden", open ? "false" : "true");
      modal.classList.toggle("is-open", open);
      document.body.classList.toggle("search-drawer-open", open);
      document.querySelectorAll(".site-search-trigger").forEach(function (btn) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    function openSearch() {
      if (window.NostalgiaSideNav && typeof window.NostalgiaSideNav.close === "function") {
        window.NostalgiaSideNav.close({ restoreFocus: false });
      }
      if (window.NostalgiaCart && typeof window.NostalgiaCart.closeDrawer === "function") {
        window.NostalgiaCart.closeDrawer();
      }
      if (window.NostalgiaLocale && typeof window.NostalgiaLocale.close === "function") {
        window.NostalgiaLocale.close();
      }
      setOpen(true);
      input.value = "";
      /* Rebuild on open so a language switch (titles) or new admin products
         are reflected even if no event fired while the drawer was closed. */
      rebuildIndex();
      renderList(defaultSuggestions, { isEmptyQuery: true });
      window.setTimeout(function () {
        input.focus();
      }, 420);
    }

    function closeSearch() {
      setOpen(false);
      var trigger = document.getElementById("site-search-trigger");
      if (trigger) trigger.focus();
    }

    modal.querySelectorAll("[data-search-close]").forEach(function (el) {
      el.addEventListener("click", closeSearch);
    });

    input.addEventListener("input", function () {
      var raw = input.value.trim();
      var q = normalizeText(raw);
      if (!q) {
        renderList(defaultSuggestions, { isEmptyQuery: true });
        return;
      }
      var filtered = filterIndex(q);
      renderList(filtered, { isEmptyQuery: false, query: raw, totalCount: filtered.length });
    });

    if (viewAll) {
      viewAll.addEventListener("click", function () {
        closeSearch();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeSearch();
    });

    searchDrawerApi = { open: openSearch, close: closeSearch };
    window.NostalgiaSearchDrawer = searchDrawerApi;
    bindSearchTriggers();
  }

  function setupSearchUi() {
    ensureSearchTrigger();
    ensureSearch();
    if (window.NostalgiaSideNav && typeof window.NostalgiaSideNav.placeHeaderUtilities === "function") {
      window.NostalgiaSideNav.placeHeaderUtilities();
    }
    if (!window._nostalgiaSearchMqBound && window.matchMedia) {
      window._nostalgiaSearchMqBound = true;
      window.matchMedia("(max-width: 900px)").addEventListener("change", function () {
        ensureSearchTrigger();
        bindSearchTriggers();
      });
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureAnnouncement();
    ensurePreFooter();
    ensureNewsletterBand();
    ensureFooterStyles();
    enhanceFooter();
    setupSearchUi();
    document.addEventListener("nostalgia-side-nav-ready", setupSearchUi);
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.applyLang === "function") {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
    bindFooterNewsletter();
  }

  function bindFooterNewsletter() {
    var form = document.getElementById("site-newsletter-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (window.NostalgiaAccount && typeof window.NostalgiaAccount.saveNewsletter === "function") {
        window.NostalgiaAccount.saveNewsletter({ email: form.email.value });
      }
      var field = form.querySelector(".site-newsletter__field");
      if (field) field.hidden = true;
      var ok = document.getElementById("site-newsletter-success");
      if (ok) ok.hidden = false;
    });
  }

  window.NostalgiaSiteChrome = { init: init, setupSearch: setupSearchUi };
})();
