(function () {
  var USERS_KEY = "nostalgia-users";
  var SESSION_KEY = "nostalgia-session";
  var NEWSLETTER_KEY = "nostalgia-newsletter";
  var NEWSLETTER_DISMISS_KEY = "nostalgia-newsletter-dismissed";
  var newsletterPopupTimer = null;
  var panelMode = "login";
  var redirectingToAccountPage = false;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  var PASSWORD_TOGGLE_BTN =
    '<button type="button" class="account-password-toggle" data-i18n-aria="account_password_show" aria-pressed="false">' +
    '<svg class="account-password-toggle__icon account-password-toggle__icon--show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
    '<svg class="account-password-toggle__icon account-password-toggle__icon--hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>' +
    "</button>";

  function passwordFieldHTML(name, autocomplete) {
    return (
      '<span class="account-password-wrap">' +
      '<input type="password" name="' +
      name +
      '" required autocomplete="' +
      autocomplete +
      '" minlength="6" />' +
      PASSWORD_TOGGLE_BTN +
      "</span>"
    );
  }

  function bindPasswordToggles(root) {
    if (!root) return;
    root.querySelectorAll(".account-password-toggle").forEach(function (btn) {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      var wrap = btn.closest(".account-password-wrap");
      var input = wrap && wrap.querySelector("input");
      if (!input) return;

      function syncToggleState() {
        var visible = input.type === "text";
        btn.setAttribute("aria-pressed", visible ? "true" : "false");
        btn.setAttribute("aria-label", t(visible ? "account_password_hide" : "account_password_show"));
        btn.classList.toggle("is-visible", visible);
      }

      btn.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        syncToggleState();
      });

      syncToggleState();
    });
  }

  function ensureStylesheet() {
    if (document.querySelector('link[href*="account.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/account.css";
    document.head.appendChild(link);
  }

  function readUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {}
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
        })
      );
    } catch (e) {}
    updateHeaderAccount();
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    updateHeaderAccount();
  }

  function hashPassword(password) {
    var str = String(password);
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "h" + Math.abs(hash).toString(16);
  }

  function registerUser(data) {
    var users = readUsers();
    var email = data.email.toLowerCase().trim();
    if (users.some(function (u) {
      return u.email === email;
    })) {
      return { ok: false, error: "exists" };
    }
    users.push({
      email: email,
      firstname: data.firstname.trim(),
      lastname: data.lastname.trim(),
      birthDate: data.birthDate || "",
      newsletterOptin: !!data.newsletterOptin,
      passwordHash: hashPassword(data.password),
    });
    writeUsers(users);
    setSession({ email: email, firstname: data.firstname.trim(), lastname: data.lastname.trim() });
    return { ok: true };
  }

  function loginUser(email, password) {
    var users = readUsers();
    var normalized = email.toLowerCase().trim();
    var user = users.filter(function (u) {
      return u.email === normalized;
    })[0];
    if (!user || user.passwordHash !== hashPassword(password)) {
      return { ok: false };
    }
    setSession(user);
    return { ok: true };
  }

  function isNewsletterSubscribed() {
    try {
      return !!localStorage.getItem(NEWSLETTER_KEY);
    } catch (e) {
      return false;
    }
  }

  function saveNewsletter(data) {
    try {
      localStorage.setItem(
        NEWSLETTER_KEY,
        JSON.stringify({
          email: data.email.toLowerCase().trim(),
          firstname: data.firstname.trim(),
          lastname: data.lastname.trim(),
          at: Date.now(),
        })
      );
    } catch (e) {}
  }

  function buildLoginHTML() {
    return (
      '<div class="account-panel">' +
      '  <h2 class="account-panel__title" data-i18n="account_login_title">Σύνδεση</h2>' +
      '  <form class="account-form" id="account-login-form" novalidate>' +
      '    <label class="account-field"><span data-i18n="checkout_email_label">Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
      '    <label class="account-field account-field--password"><span data-i18n="account_password_label">Κωδικός</span>' +
      passwordFieldHTML("password", "current-password") +
      "</label>" +
      '    <div class="account-form__row">' +
      '      <button type="button" class="account-link" id="account-forgot" data-i18n="account_forgot">Ξεχάσατε τον κωδικό;</button>' +
      '      <button type="submit" class="account-btn account-btn--outline" data-i18n="account_sign_in">Σύνδεση</button>' +
      "    </div>" +
      '    <p class="account-form__error" id="account-login-error" hidden></p>' +
      "  </form>" +
      '  <p class="account-panel__switch">' +
      '    <button type="button" class="account-link account-link--block" id="account-show-register" data-i18n="account_create_prompt">Δημιουργία λογαριασμού</button>' +
      "  </p>" +
      "</div>"
    );
  }

  function buildRegisterHTML() {
    return (
      '<div class="account-panel account-panel--register">' +
      '  <h2 class="account-panel__title account-panel__title--register" data-i18n="account_create_heading">Create New Customer Account</h2>' +
      '  <div class="account-register">' +
      '    <form class="account-form account-form--register" id="account-register-form" novalidate>' +
      '      <p class="account-form__section" data-i18n="account_personal_info">Personal information</p>' +
      '      <label class="account-field"><span data-i18n="checkout_firstname_label">Όνομα</span><input type="text" name="firstname" required autocomplete="given-name" /></label>' +
      '      <label class="account-field"><span data-i18n="checkout_lastname_label">Επώνυμο</span><input type="text" name="lastname" required autocomplete="family-name" /></label>' +
      '      <label class="account-check"><input type="checkbox" name="newsletterOptin" /><span data-i18n="account_newsletter_optin">Sign up for newsletter</span></label>' +
      '      <label class="account-field"><span data-i18n="account_birth_label">Date of birth</span><input type="date" name="birthDate" autocomplete="bday" /></label>' +
      '      <p class="account-form__hint" data-i18n="account_birth_hint">Τα γενέθλιά σας μάς βοηθούν να σας στείλουμε κάτι ξεχωριστό.</p>' +
      '      <p class="account-form__section" data-i18n="account_signin_info">Sign-in information</p>' +
      '      <label class="account-field"><span data-i18n="checkout_email_label">Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
      '      <label class="account-field account-field--password"><span data-i18n="account_password_label">Κωδικός</span>' +
      passwordFieldHTML("password", "new-password") +
      "</label>" +
      '      <label class="account-field account-field--password"><span data-i18n="account_password_confirm_label">Επιβεβαίωση κωδικού</span>' +
      passwordFieldHTML("passwordConfirm", "new-password") +
      "</label>" +
      '      <button type="submit" class="account-btn account-btn--outline account-btn--register-submit" data-i18n="account_create_btn">Δημιουργία</button>' +
      '      <button type="button" class="account-link account-link--register-back" id="account-show-login" data-i18n="account_back_to_login">Back</button>' +
      '      <p class="account-form__error" id="account-register-error" hidden></p>' +
      "    </form>" +
      '    <aside class="account-register__why" aria-hidden="true">' +
      '      <h3 class="account-register__why-title" data-i18n="account_why_title">Why an account?</h3>' +
      '      <p class="account-register__why-text" data-i18n="account_why_text">Δημιούργησε λογαριασμό για ταχύτερο checkout και ιστορικό παραγγελιών.</p>' +
      "    </aside>" +
      "  </div>" +
      "</div>"
    );
  }

  function buildLoggedInHTML(session) {
    return (
      '<div class="account-panel account-panel--logged">' +
      '  <h2 class="account-panel__title" data-i18n="account_welcome">Καλώς ήρθες</h2>' +
      '  <p class="account-panel__name">' +
      (session.firstname || "") +
      " " +
      (session.lastname || "") +
      "</p>" +
      '  <p class="account-panel__email">' +
      session.email +
      "</p>" +
      '  <button type="button" class="account-btn account-btn--outline" id="account-logout" data-i18n="account_logout">Αποσύνδεση</button>' +
      "</div>"
    );
  }

  function focusFirstAccountField() {
    var root = getPanelRoot();
    if (!root) return;
    var input = root.querySelector("input:not([type=hidden])");
    if (input) input.focus();
  }

  function bindAccountDelegation() {
    if (document.documentElement.dataset.accountBound) return;
    document.documentElement.dataset.accountBound = "1";

    document.addEventListener("click", function (e) {
      if (e.target.closest("#account-show-register")) {
        e.preventDefault();
        panelMode = "register";
        renderPanel();
        focusFirstAccountField();
        return;
      }
      if (e.target.closest("#account-show-login")) {
        e.preventDefault();
        panelMode = "login";
        renderPanel();
        focusFirstAccountField();
        return;
      }
      if (e.target.closest("#account-forgot")) {
        e.preventDefault();
        alert(t("account_forgot_help"));
        return;
      }
      if (e.target.closest("#account-logout")) {
        e.preventDefault();
        clearSession();
        panelMode = "login";
        renderPanel();
      }
    });

    document.addEventListener("submit", function (e) {
      if (e.target && e.target.id === "account-login-form") {
        e.preventDefault();
        handleLoginSubmit(e.target);
      }
      if (e.target && e.target.id === "account-register-form") {
        e.preventDefault();
        handleRegisterSubmit(e.target);
      }
    });

    document.addEventListener("click", function (e) {
      var legacyAccountPanelBtn = e.target.closest('[data-side-panel="account"]');
      if (legacyAccountPanelBtn) {
        e.preventDefault();
        e.stopPropagation();
        navigateToAccountPage("login");
        return;
      }
      if (e.target.closest("#header-account-btn")) {
        e.preventDefault();
        navigateToAccountPage("login");
        return;
      }
      var btn = e.target.closest("[data-account-mode]");
      if (!btn) return;
      e.preventDefault();
      navigateToAccountPage(btn.getAttribute("data-account-mode") || "login");
    });
  }

  function isAccountPage() {
    return document.body && document.body.getAttribute("data-page") === "account";
  }

  function navigateToAccountPage(mode) {
    if (isAccountPage()) {
      panelMode = mode === "register" ? "register" : "login";
      renderPanel();
      focusFirstAccountField();
      try {
        history.replaceState(null, "", "account.html?mode=" + encodeURIComponent(panelMode));
      } catch (e) {}
      return;
    }
    if (redirectingToAccountPage) return;
    redirectingToAccountPage = true;
    window.location.href = "account.html?mode=" + encodeURIComponent(mode === "register" ? "register" : "login");
  }

  function handleLoginSubmit(loginForm) {
    var loginError = document.getElementById("account-login-error");
    if (!loginForm.reportValidity()) return;
    var result = loginUser(loginForm.email.value, loginForm.password.value);
    if (!result.ok) {
      if (loginError) {
        loginError.hidden = false;
        loginError.textContent = t("account_login_error");
      }
      return;
    }
    if (loginError) loginError.hidden = true;
    renderPanel();
  }

  function handleRegisterSubmit(registerForm) {
    var registerError = document.getElementById("account-register-error");
    if (!registerForm.reportValidity()) return;
    if (registerForm.password.value !== registerForm.passwordConfirm.value) {
      if (registerError) {
        registerError.hidden = false;
        registerError.textContent = t("account_password_mismatch");
      }
      return;
    }
    var result = registerUser({
      email: registerForm.email.value,
      firstname: registerForm.firstname.value,
      lastname: registerForm.lastname.value,
      birthDate: registerForm.birthDate ? registerForm.birthDate.value : "",
      newsletterOptin: !!(registerForm.newsletterOptin && registerForm.newsletterOptin.checked),
      password: registerForm.password.value,
    });
    if (!result.ok) {
      if (registerError) {
        registerError.hidden = false;
        registerError.textContent = t("account_exists_error");
      }
      return;
    }
    if (registerError) registerError.hidden = true;
    panelMode = "login";
    renderPanel();
  }

  function openAccountPanel(mode) {
    if (!isAccountPage()) {
      navigateToAccountPage(mode);
      return;
    }
    panelMode = mode === "register" ? "register" : "login";
    renderPanel();
    focusFirstAccountField();
  }

  function renderPanel() {
    var root = getPanelRoot();
    if (!root) return;
    var session = getSession();
    if (session) {
      root.innerHTML = buildLoggedInHTML(session);
    } else if (panelMode === "register") {
      root.innerHTML = buildRegisterHTML();
    } else {
      root.innerHTML = buildLoginHTML();
    }
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
    bindPasswordToggles(root);
  }

  function ensurePanelRoot() {
    if (!isAccountPage()) return;
    var root = getPanelRoot();
    if (root) {
      renderPanel();
      return;
    }
    window.requestAnimationFrame(ensurePanelRoot);
  }

  function getPanelRoot() {
    if (isAccountPage()) {
      return document.querySelector("main #account-panel-root");
    }
    return null;
  }

  function disableLegacyDrawerAccountUI() {
    if (isAccountPage()) return;
    document.querySelectorAll(".side-nav__panel--account, [data-side-sub='account']").forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll(".side-nav [data-side-panel='account']").forEach(function (el) {
      el.setAttribute("href", "account.html?mode=login");
      el.removeAttribute("data-side-panel");
      if (el.tagName === "BUTTON") {
        var a = document.createElement("a");
        a.className = el.className;
        a.href = "account.html?mode=login";
        a.innerHTML = el.innerHTML;
        el.parentNode.replaceChild(a, el);
      }
    });
    document.querySelectorAll(".side-nav #account-panel-root").forEach(function (el) {
      el.innerHTML = "";
      el.remove();
    });
  }

  function buildNewsletterHTML() {
    return (
      '<aside class="newsletter-popup" id="newsletter-modal" hidden aria-hidden="true">' +
      '  <div class="newsletter-popup__panel" role="dialog" aria-labelledby="newsletter-modal-title">' +
      '    <button type="button" class="newsletter-popup__close" data-newsletter-close aria-label="Close">×</button>' +
      '    <h2 class="newsletter-popup__title" id="newsletter-modal-title" data-i18n="newsletter_title">Newsletter</h2>' +
      '    <p class="newsletter-popup__lead" data-i18n="newsletter_lead">Εγγράψου στο newsletter μας και μάθε πρώτος τα νέα της Nostalgia Collection.</p>' +
      '    <form class="newsletter-form" id="newsletter-form" novalidate>' +
      '      <label class="newsletter-field"><input type="email" name="email" required placeholder="Email" data-i18n-placeholder="newsletter_email_ph" /></label>' +
      '      <label class="newsletter-field"><input type="text" name="firstname" required placeholder="Όνομα" data-i18n-placeholder="newsletter_firstname_ph" autocomplete="given-name" /></label>' +
      '      <label class="newsletter-field"><input type="text" name="lastname" required placeholder="Επώνυμο" data-i18n-placeholder="newsletter_lastname_ph" autocomplete="family-name" /></label>' +
      '      <button type="submit" class="newsletter-form__submit" data-i18n="newsletter_submit">Εγγραφή</button>' +
      '      <p class="newsletter-form__success" id="newsletter-success" hidden data-i18n="newsletter_success">Ευχαριστούμε για την εγγραφή σου!</p>' +
      "    </form>" +
      '    <a class="newsletter-popup__privacy" href="privacy.html" data-i18n="footer_privacy">Προστασία Δεδομένων</a>' +
      "  </div>" +
      "</aside>"
    );
  }

  function openNewsletter() {
    var modal = document.getElementById("newsletter-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(function () {
      modal.classList.add("is-visible");
    });
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
    applyPlaceholders();
  }

  function closeNewsletter() {
    var modal = document.getElementById("newsletter-modal");
    if (!modal) return;
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (!modal.classList.contains("is-visible")) {
        modal.hidden = true;
      }
    }, 320);
    try {
      sessionStorage.setItem(NEWSLETTER_DISMISS_KEY, "1");
    } catch (e) {}
  }

  function applyPlaceholders() {
    if (!window.NostalgiaI18n || !window.NostalgiaI18n.t) return;
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (key) el.placeholder = window.NostalgiaI18n.t(key);
    });
  }

  function bindNewsletter() {
    if (!document.getElementById("newsletter-modal")) {
      document.body.insertAdjacentHTML("beforeend", buildNewsletterHTML());
    }

    document.querySelectorAll("[data-newsletter-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.NostalgiaSideNav) window.NostalgiaSideNav.close();
        openNewsletter();
      });
    });

    document.querySelectorAll("[data-newsletter-close]").forEach(function (el) {
      el.addEventListener("click", closeNewsletter);
    });

    var form = document.getElementById("newsletter-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        saveNewsletter({
          email: form.email.value,
          firstname: form.firstname.value,
          lastname: form.lastname.value,
        });
        form.querySelectorAll("input").forEach(function (input) {
          input.disabled = true;
        });
        form.querySelector("button[type=submit]").hidden = true;
        var success = document.getElementById("newsletter-success");
        if (success) success.hidden = false;
        window.setTimeout(closeNewsletter, 2200);
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var modal = document.getElementById("newsletter-modal");
        if (modal && !modal.hidden) closeNewsletter();
      }
    });
  }

  function wasNewsletterDismissedThisSession() {
    try {
      return sessionStorage.getItem(NEWSLETTER_DISMISS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function isCookieBannerVisible() {
    var banner = document.getElementById("cookie-banner");
    return !!(banner && !banner.hidden);
  }

  function scheduleNewsletterPopup(delayMs) {
    if (newsletterPopupTimer) {
      window.clearTimeout(newsletterPopupTimer);
    }
    newsletterPopupTimer = window.setTimeout(function () {
      if (isNewsletterSubscribed() || wasNewsletterDismissedThisSession()) return;
      if (isCookieBannerVisible()) {
        scheduleNewsletterPopup(1200);
        return;
      }
      openNewsletter();
    }, delayMs);
  }

  function maybeShowNewsletterPopup() {
    if (isNewsletterSubscribed() || wasNewsletterDismissedThisSession()) return;

    var hasCookieConsent =
      window.NostalgiaCookies &&
      typeof window.NostalgiaCookies.readConsent === "function" &&
      window.NostalgiaCookies.readConsent();

    if (!hasCookieConsent) {
      document.addEventListener("nostalgia-cookie-consent-set", function onConsent() {
        document.removeEventListener("nostalgia-cookie-consent-set", onConsent);
        scheduleNewsletterPopup(4500);
      });
      return;
    }

    scheduleNewsletterPopup(5500);
  }

  function updateHeaderAccount() {
    var btn = document.getElementById("header-account-btn");
    if (!btn) return;
    var session = getSession();
    var label = session ? (session.firstname || session.email) : t("account_aria");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.classList.toggle("is-logged-in", !!session);
  }

  function ensureHeaderCorner() {
    if (window.NostalgiaCart && typeof window.NostalgiaCart.ensureHeaderCorner === "function") {
      return window.NostalgiaCart.ensureHeaderCorner();
    }
    var header = document.querySelector(".site-header");
    var bar = document.querySelector(".site-header__bar");
    var mount = bar || header;
    if (!mount) return null;
    var corner = document.getElementById("site-header-corner");
    if (!corner) {
      corner = document.createElement("div");
      corner.className = "site-header__corner";
      corner.id = "site-header-corner";
      mount.appendChild(corner);
    } else if (corner.parentNode !== mount) {
      mount.appendChild(corner);
    }
    return corner;
  }

  function ensureHeaderAccountVisible() {
    var corner = ensureHeaderCorner();
    if (!corner) return false;

    var btn = document.getElementById("header-account-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "header-account-btn";
      btn.id = "header-account-btn";
      btn.setAttribute("data-i18n-aria", "account_aria");
      btn.setAttribute("aria-label", t("account_aria"));
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="8" r="3.25"/>' +
        '<path d="M5 20c0-3.3 3.13-6 7-6s7 2.7 7 6"/>' +
        "</svg>";
    }

    var cart = document.getElementById("cart-link");
    if (cart && cart.parentNode === corner) {
      if (btn.parentNode !== corner) corner.insertBefore(btn, cart);
    } else if (btn.parentNode !== corner) {
      corner.insertBefore(btn, corner.firstChild);
    }

    updateHeaderAccount();

    if (window.NostalgiaCart && typeof window.NostalgiaCart.refreshHeaderCart === "function") {
      window.NostalgiaCart.refreshHeaderCart();
    }

    return true;
  }

  function setupHeaderAccount() {
    if (!ensureHeaderAccountVisible()) {
      window.requestAnimationFrame(setupHeaderAccount);
    }
  }

  function init() {
    if (isAccountPage()) {
      var params = new URLSearchParams(window.location.search);
      panelMode = params.get("mode") === "register" ? "register" : "login";
    }
    disableLegacyDrawerAccountUI();
    ensureStylesheet();
    bindAccountDelegation();
    bindNewsletter();
    ensurePanelRoot();
    setupHeaderAccount();
    maybeShowNewsletterPopup();

    window.addEventListener("load", ensureHeaderAccountVisible);
    document.addEventListener("nostalgia-side-nav-ready", ensureHeaderAccountVisible);

    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        applyPlaceholders();
        updateHeaderAccount();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaAccount = {
    renderPanel: renderPanel,
    openAccountPanel: openAccountPanel,
    ensureHeaderAccount: ensureHeaderAccountVisible,
    openRegister: function () {
      openAccountPanel("register");
    },
    openLogin: function () {
      openAccountPanel("login");
    },
    openNewsletter: openNewsletter,
    getSession: getSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
