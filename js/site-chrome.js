(function () {
  var initialized = false;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function ensureAnnouncement() {
    var existing = document.getElementById("site-announcement");
    if (existing) existing.remove();
  }

  function footerTemplate() {
    return (
      '<div class="site-footer__layout site-footer__layout--rich">' +
      '  <div class="site-footer__center site-footer__center--brand">' +
      '    <a class="site-footer__logo" href="index.html" data-i18n-aria="logo_aria">' +
      '      <img class="brand-logo brand-logo--dark" src="logo/logo.png" width="180" height="52" alt="Nostalgia Collection" />' +
      '      <img class="brand-logo brand-logo--light" src="logo/logo%20light.png?v=2" width="180" height="52" alt="Nostalgia Collection" />' +
      "    </a>" +
      '    <p class="site-footer__tagline" data-i18n="footer_tagline">' + t("footer_tagline") + "</p>" +
      '    <ul class="site-footer__lines">' +
      '      <li data-i18n="footer_address">' + t("footer_address") + "</li>" +
      "      <li><span data-i18n=\"footer_phone_label\">" + t("footer_phone_label") + '</span> <a href="tel:+306939411774">+30 693 941 1774</a></li>' +
      '      <li><a href="mailto:mgerostathi@gmail.com">mgerostathi@gmail.com</a></li>' +
      "    </ul>" +
      "  </div>" +
      '  <div class="site-footer__links">' +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_orders_title">' + t("footer_orders_title") + "</h4>" +
      '      <ul class="site-footer__list">' +
      "        <li><a href=\"account.html?mode=login\" data-i18n=\"account_my_account\">" + t("account_my_account") + "</a></li>" +
      '        <li><a href="wishlist.html" data-i18n="footer_wishlist">' + t("footer_wishlist") + "</a></li>" +
      '        <li><a href="shipping-returns.html" data-i18n="footer_shipping_returns">' + t("footer_shipping_returns") + "</a></li>" +
      '        <li><a href="payments.html" data-i18n="footer_payments">' + t("footer_payments") + "</a></li>" +
      '        <li><a href="faq.html" data-i18n="footer_faq">' + t("footer_faq") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_services_title">' + t("footer_services_title") + "</h4>" +
      '      <ul class="site-footer__list">' +
      '        <li><a href="about.html" data-i18n="nav_about">' + t("nav_about") + "</a></li>" +
      '        <li><a href="contact.html" data-i18n="nav_contact">' + t("nav_contact") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      '    <section class="site-footer__col">' +
      '      <h4 data-i18n="footer_information_title">' + t("footer_information_title") + "</h4>" +
      '      <ul class="site-footer__list">' +
      '        <li><a href="journal.html" data-i18n="footer_journal">' + t("footer_journal") + "</a></li>" +
      '        <li><a href="terms.html" data-i18n="footer_terms">' + t("footer_terms") + "</a></li>" +
      '        <li><a href="privacy.html" data-i18n="footer_privacy">' + t("footer_privacy") + "</a></li>" +
      "      </ul>" +
      "    </section>" +
      "  </div>" +
      "</div>" +
      '<div class="site-footer__bar">' +
      '  <nav class="site-footer__legal site-footer__legal--bottom">' +
      '    <a href="terms.html" data-i18n="footer_terms">Terms</a>' +
      '    <a href="privacy.html" data-i18n="footer_privacy">Privacy</a>' +
      "  </nav>" +
      '  <p class="site-footer__copyright" data-i18n="footer_copyright">' + t("footer_copyright") + "</p>" +
      '  <div class="site-footer__socials site-footer__socials--bottom">' +
      '    <a class="site-footer__social-link" href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 8.5V6.8c0-.6.4-.8.8-.8h1.8V3h-2.5c-2.8 0-3.4 2-3.4 3.3v2.2H8v3h2.2V21h3.3v-6.5h2.2l.4-3h-2.6z"/></svg>' +
      "    </a>" +
      '    <a class="site-footer__social-link" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/></svg>' +
      "    </a>" +
      '    <a class="site-footer__social-link" href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.2 8.7A1.9 1.9 0 1 1 6.2 5a1.9 1.9 0 0 1 0 3.7zM4.6 9.9h3.2V20H4.6zM9.8 9.9h3v1.4h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3.2v-4.7c0-1.1 0-2.5-1.6-2.5s-1.8 1.2-1.8 2.4V20H9.8z"/></svg>' +
      "    </a>" +
      '    <a class="site-footer__social-link" href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.8 4c.5 1.4 1.5 2.5 2.9 3.1.8.3 1.6.5 2.3.5v2.8c-1 0-2-.2-2.9-.6v5.6c0 2.7-2.2 4.9-4.9 4.9a4.9 4.9 0 0 1 0-9.8c.3 0 .6 0 .9.1v2.9a2 2 0 0 0-.9-.2 2.1 2.1 0 1 0 2.1 2.1V4h2.5z"/></svg>' +
      "    </a>" +
      '    <a class="site-footer__social-link" href="https://www.pinterest.com/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest">' +
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-3.3 17.4l1.2-4.4c-.3-.7-.6-1.7-.6-2.8 0-2.3 1.3-4 3.1-4 1.5 0 2.2 1.1 2.2 2.5 0 1.5-1 3.8-1.5 5.9-.4 1.7.9 3.1 2.6 3.1 3.2 0 5.3-4.1 5.3-8.9A8.3 8.3 0 0 0 12 3zm0 0"/></svg>' +
      "    </a>" +
      "  </div>" +
      "</div>"
    );
  }

  function enhanceFooter() {
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    footer.innerHTML = footerTemplate();
  }

  function ensureFooterStyles() {
    var legacy = document.getElementById("site-chrome-footer-style");
    if (legacy) legacy.remove();
    if (document.getElementById("site-chrome-footer-style-v15")) return;
    var style = document.createElement("style");
    style.id = "site-chrome-footer-style-v15";
    style.textContent = `
      .site-footer {
        padding-top: 2.8rem;
      }
      .site-footer__layout--rich {
        display: grid;
        grid-template-columns: minmax(220px, 280px) minmax(0, max-content);
        align-items: start;
        gap: 1.6rem clamp(1.5rem, 3vw, 2.75rem);
        width: 100%;
        max-width: var(--site-max, 1320px);
        margin: 0 auto;
      }
      .site-footer__center--brand {
        grid-column: 1;
        max-width: 22rem;
        text-align: left;
      }
      .site-footer__center--brand .site-footer__logo {
        justify-content: flex-start;
        margin: 0 0 0.95rem;
      }
      .site-footer__center--brand .site-footer__tagline,
      .site-footer__center--brand .site-footer__lines {
        text-align: left;
        margin-left: 0;
        margin-right: 0;
      }
      .site-footer__center--brand .site-footer__tagline {
        font-family: var(--font-body);
        font-size: 0.95rem;
        line-height: 1.55;
      }
      .site-footer__center--brand .site-footer__lines {
        font-family: var(--font-nav);
        font-size: 0.65rem;
        letter-spacing: 0.03em;
        line-height: 1.7;
      }
      .site-footer__links {
        grid-column: 2;
        display: grid;
        grid-template-columns: repeat(3, minmax(9.25rem, 11.25rem));
        justify-content: start;
        gap: 1.2rem clamp(1.25rem, 2.5vw, 2rem);
        max-width: 40rem;
      }
      .site-footer__col h4 {
        margin: 0 0 0.75rem;
        font-family: var(--font-display);
        font-size: 1.03rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        text-transform: none;
        color: var(--ink);
      }
      .site-footer__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.52rem;
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
      .site-footer__bar {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.75rem 1rem;
      }
      .site-footer__legal--bottom {
        display: inline-flex;
        gap: 0.85rem;
        justify-self: start;
      }
      .site-footer__legal--bottom a {
        font-family: var(--font-nav);
        font-size: 0.53rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .site-footer__legal--bottom a:hover {
        color: var(--accent);
      }
      .site-footer__socials--bottom {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        justify-self: end;
      }
      .site-footer__social-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        color: var(--ink-muted);
        text-decoration: none;
        transition: color 0.25s ease, transform 0.25s ease, filter 0.25s ease;
      }
      .site-footer__social-link svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .site-footer__social-link:hover {
        color: var(--accent);
        transform: translateY(-2px) scale(1.08);
        filter: drop-shadow(0 0 4px rgba(197, 160, 96, 0.35));
      }
      .site-footer__copyright {
        font-family: var(--font-nav);
        font-size: 0.56rem;
        letter-spacing: 0.08em;
        color: var(--ink-muted);
      }
      @media (min-width: 1400px) {
        .site-footer__layout--rich {
          grid-template-columns: minmax(240px, 300px) minmax(0, max-content);
        }
        .site-footer__links {
          grid-template-columns: repeat(3, 10.5rem);
        }
      }
      @media (max-width: 860px) {
        .site-footer__layout--rich {
          grid-template-columns: 1fr;
          gap: 1.1rem;
        }
        .site-footer__links {
          grid-column: 1;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .site-footer__bar {
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
        }
        .site-footer__legal--bottom,
        .site-footer__socials--bottom {
          justify-self: center;
        }
      }
      @media (max-width: 560px) {
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

  function buildSearchIndex() {
    var items = [];
    if (window.NostalgiaProducts && typeof window.NostalgiaProducts.getAll === "function") {
      items = window.NostalgiaProducts.getAll().map(function (p) {
        return {
          title: p.title,
          subtitle: p.categoryName,
          image: p.image,
          href: "product.html?id=" + encodeURIComponent(p.id),
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
      '  <ul class="site-search-drawer__list" data-search-list></ul>' +
      "</div>";
    document.body.appendChild(modal);

    var input = modal.querySelector(".site-search-drawer__input");
    var list = modal.querySelector("[data-search-list]");
    var suggestTitle = modal.querySelector("[data-search-suggest-title]");
    var backdrop = modal.querySelector(".site-search-drawer__backdrop");
    var index = buildSearchIndex();
    var defaultSuggestions = index.slice(0, 4);

    function renderList(items, isEmptyQuery) {
      list.innerHTML = "";
      if (suggestTitle) {
        suggestTitle.hidden = !isEmptyQuery;
      }
      if (!items.length) {
        var empty = document.createElement("li");
        empty.className = "site-search-drawer__empty";
        empty.textContent = t("search_no_results");
        list.appendChild(empty);
        return;
      }
      items.slice(0, 12).forEach(function (item) {
        var li = document.createElement("li");
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
      renderList(defaultSuggestions, true);
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
      var q = input.value.trim().toLowerCase();
      if (!q) {
        renderList(defaultSuggestions, true);
        return;
      }
      var filtered = index.filter(function (item) {
        return (item.title + " " + item.subtitle).toLowerCase().indexOf(q) !== -1;
      });
      renderList(filtered, false);
    });

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
    ensureFooterStyles();
    enhanceFooter();
    setupSearchUi();
    document.addEventListener("nostalgia-side-nav-ready", setupSearchUi);
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.applyLang === "function") {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
  }

  window.NostalgiaSiteChrome = { init: init, setupSearch: setupSearchUi };
})();
