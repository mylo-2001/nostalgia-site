(function () {
  var USERS_KEY = "nostalgia-users";
  var SESSION_KEY = "nostalgia-session";
  var NEWSLETTER_KEY = "nostalgia-newsletter";
  var NEWSLETTER_DISMISS_KEY = "nostalgia-newsletter-dismissed";
  var newsletterPopupTimer = null;
  var panelMode = "login";
  var redirectingToAccountPage = false;
  var loginCaptcha = null;
  var registerCaptcha = null;
  var cachedAddress = null;

  function mountCaptcha(id) {
    if (!window.NostalgiaCaptcha) return null;
    var el = document.getElementById(id);
    if (!el) return null;
    return window.NostalgiaCaptcha.mount(el);
  }

  function captchaToken(handle) {
    return window.NostalgiaCaptcha ? window.NostalgiaCaptcha.getToken(handle) : "";
  }

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

  /* Open the native date calendar on a click anywhere in the field (not just
     the tiny icon). showPicker must run inside a user gesture; unsupported
     browsers fall back to the default behaviour. */
  function enhanceDateInputs(root) {
    if (!root) return;
    root.querySelectorAll('input[type="date"]').forEach(function (input) {
      if (input.dataset.pickerBound === "1") return;
      input.dataset.pickerBound = "1";
      input.addEventListener("click", function () {
        if (typeof input.showPicker === "function") {
          try {
            input.showPicker();
          } catch (e) {
            /* e.g. called outside a user gesture — ignore, native UI still works */
          }
        }
      });
    });
  }

  function ensureStylesheet() {
    if (document.querySelector('link[href*="account.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/account.css?v=dashboard";
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

  function registerUserLocal(data) {
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

  /* Uses the backend when it is running, localStorage otherwise. */
  function registerUser(data) {
    if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
      return window.NostalgiaAPI.post("/api/auth/register", data).then(function (res) {
        if (res.ok && res.user) {
          setSession(res.user);
          return { ok: true };
        }
        return { ok: false, error: res.error || "failed" };
      });
    }
    return Promise.resolve(registerUserLocal(data));
  }

  function loginUserLocal(email, password) {
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

  function loginUser(email, password, remember, captcha) {
    if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
      return window.NostalgiaAPI.post("/api/auth/login", {
        email: email,
        password: password,
        remember: remember !== false,
        captchaToken: captcha || "",
      }).then(function (res) {
        if (res.ok && res.user) {
          setSession(res.user);
          return { ok: true };
        }
        return { ok: false, error: res.error || "failed" };
      });
    }
    return Promise.resolve(loginUserLocal(email, password));
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
          firstname: data.firstname ? data.firstname.trim() : "",
          lastname: data.lastname ? data.lastname.trim() : "",
          at: Date.now(),
        })
      );
    } catch (e) {}
    if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
      window.NostalgiaAPI.post("/api/newsletter", {
        email: data.email,
        firstname: data.firstname || "",
        lastname: data.lastname || "",
      });
    }
  }

  function buildForgotHTML() {
    return (
      '<div class="account-panel account-panel--login account-panel--auth">' +
      '  <div class="account-auth__brand" aria-hidden="true"><span class="account-auth__mark"><img class="account-auth__logo account-auth__logo--dark" src="logo/logo.png" alt="" /><img class="account-auth__logo account-auth__logo--light" src="logo/logo%20light.png?v=2" alt="" /></span></div>' +
      '  <h2 class="account-panel__title" data-i18n="account_forgot_title">' + t("account_forgot_title") + "</h2>" +
      '  <p class="account-auth__lead" data-i18n="account_forgot_lead">' + t("account_forgot_lead") + "</p>" +
      '  <form class="account-form account-form--auth" id="account-forgot-form" novalidate>' +
      '    <label class="account-field"><span data-i18n="account_email_label">Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
      '    <button type="button" class="account-btn account-btn--outline" data-pw-send data-i18n="account_pw_send">' + t("account_pw_send") + "</button>" +
      '    <div class="account-pw-step2" data-pw-step2 hidden>' +
      '      <label class="account-field"><span data-i18n="account_pw_code">' + t("account_pw_code") + '</span><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" /></label>' +
      '      <label class="account-field"><span data-i18n="account_new_pw">' + t("account_new_pw") + '</span><input type="password" name="newPassword" autocomplete="new-password" /></label>' +
      '      <button type="submit" class="account-btn account-btn--gold" data-i18n="account_pw_save">' + t("account_pw_save") + "</button>" +
      "    </div>" +
      '    <p class="account-edit__msg" data-msg hidden></p>' +
      "  </form>" +
      '  <p class="account-panel__switch">' +
      '    <button type="button" class="account-link account-link--block" id="account-back-login" data-i18n="account_back_to_login">' + t("account_back_to_login") + "</button>" +
      "  </p>" +
      "</div>"
    );
  }

  function bindForgotForm() {
    var form = document.getElementById("account-forgot-form");
    wireCodeReset(form, {
      getEmail: function () {
        return form.elements.email ? form.elements.email.value.trim() : "";
      },
      onSuccess: function () {
        /* Server logged the user in via the session cookie — show dashboard. */
        showFormMsg(form, "account_reset_done", true);
        panelMode = "login";
        if (window.NostalgiaAPI && window.NostalgiaAPI.syncSession) {
          window.NostalgiaAPI.syncSession().then(function () {
            renderPanel();
          });
        } else {
          renderPanel();
        }
      },
    });
  }

  function buildLoginHTML() {
    return (
      '<div class="account-panel account-panel--login account-panel--auth">' +
      '  <div class="account-auth__brand" aria-hidden="true">' +
      '    <span class="account-auth__mark"><img class="account-auth__logo account-auth__logo--dark" src="logo/logo.png" alt="" /><img class="account-auth__logo account-auth__logo--light" src="logo/logo%20light.png?v=2" alt="" /></span>' +
      "  </div>" +
      '  <h2 class="account-panel__title" data-i18n="account_login_title">Σύνδεση</h2>' +
      '  <p class="account-auth__lead" data-i18n="account_login_lead">Συνδέσου για να δεις τις παραγγελίες και τον λογαριασμό σου.</p>' +
      '  <form class="account-form account-form--auth" id="account-login-form" novalidate>' +
      '    <label class="account-field"><span data-i18n="checkout_email_label">Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
      '    <label class="account-field account-field--password"><span data-i18n="account_password_label">Κωδικός</span>' +
      passwordFieldHTML("password", "current-password") +
      "</label>" +
      '    <label class="account-check account-check--remember"><input type="checkbox" name="remember" checked /><span>' +
      (isEnglish() ? "Remember me" : "Να με θυμάσαι") +
      "</span></label>" +
      '    <div class="account-captcha" id="account-login-captcha"></div>' +
      '    <div class="account-form__row account-form__row--login">' +
      '      <button type="button" class="account-link" id="account-forgot" data-i18n="account_forgot">Ξεχάσατε τον κωδικό;</button>' +
      '      <button type="submit" class="account-btn account-btn--gold account-btn--login-submit" data-i18n="account_sign_in">Σύνδεση</button>' +
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
      '    <aside class="account-register__why" aria-labelledby="account-why-title">' +
      '      <h3 class="account-register__why-title" id="account-why-title" data-i18n="account_why_title">Why an account?</h3>' +
      '      <p class="account-register__why-text" data-i18n="account_why_text">Δημιούργησε λογαριασμό για ταχύτερο checkout και ιστορικό παραγγελιών.</p>' +
      '    </aside>' +
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
      '      <div class="account-captcha" id="account-register-captcha"></div>' +
      '      <div class="account-form__row account-form__row--actions">' +
      '        <button type="button" class="account-link account-link--register-back" id="account-show-login" data-i18n="account_back_to_login">Back</button>' +
      '        <button type="submit" class="account-btn account-btn--outline account-btn--register-submit" data-i18n="account_create_btn">Δημιουργία</button>' +
      "      </div>" +
      '      <p class="account-form__error" id="account-register-error" hidden></p>' +
      "    </form>" +
      "  </div>" +
      "</div>"
    );
  }

  function isEnglish() {
    return document.documentElement.lang === "en";
  }

  var ORDER_STATUS_LABELS = {
    el: { new: "Νέα", processing: "Σε προετοιμασία", ready: "Έτοιμη για αποστολή", completed: "Ολοκληρώθηκε", cancelled: "Ακυρώθηκε", review: "Χρειάζεται έλεγχος", shipped: "Απεστάλη", delivered: "Παραδόθηκε" },
    en: { new: "New", processing: "Processing", ready: "Ready to ship", completed: "Completed", cancelled: "Cancelled", review: "Needs review", shipped: "Shipped", delivered: "Delivered" },
  };
  var PAY_STATUS_LABELS = {
    el: { pending: "Εκκρεμεί", paid: "Πληρώθηκε", failed: "Απέτυχε", refunded: "Επιστροφή χρημάτων", partial_refund: "Μερική επιστροφή", offline: "Offline", cod_pending: "Δεν εισπράχθηκε", cod_collected: "Εισπράχθηκε", cod_not_delivered: "Δεν παραδόθηκε", cod_awaiting_remittance: "Αναμονή απόδοσης", cod: "Δεν εισπράχθηκε" },
    en: { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded", partial_refund: "Partial refund", offline: "Offline", cod_pending: "Not collected", cod_collected: "Collected", cod_not_delivered: "Not delivered", cod_awaiting_remittance: "Awaiting remittance", cod: "Not collected" },
  };
  var SHIP_STATUS_LABELS = {
    el: { not_ready: "Δεν ετοιμάστηκε", ready_courier: "Έτοιμη για courier", handed: "Στο courier", transit: "Σε μεταφορά", delivered: "Παραδόθηκε", failed: "Αποτυχία παράδοσης", returning: "Επιστρέφεται", returned: "Επιστράφηκε" },
    en: { not_ready: "Not prepared", ready_courier: "Ready for courier", handed: "Handed to courier", transit: "In transit", delivered: "Delivered", failed: "Delivery failed", returning: "Returning", returned: "Returned" },
  };
  var COURIER_LABELS_ACC = { acs: "ACS Courier", elta: "ELTA Courier", speedex: "Speedex", geniki: "Γενική Ταχυδρομική", box: "BOX NOW" };

  function pickStatusLabel(map, status) {
    var m = map[isEnglish() ? "en" : "el"];
    return m[status] || status || "—";
  }
  function orderStatusLabel(status) { return pickStatusLabel(ORDER_STATUS_LABELS, status); }
  function payStatusLabel(status) { return pickStatusLabel(PAY_STATUS_LABELS, status); }
  function shipStatusLabel(status) { return pickStatusLabel(SHIP_STATUS_LABELS, status); }
  function payMethodLabel(o) { return o.payment === "cod" ? (isEnglish() ? "Cash on delivery" : "Αντικαταβολή") : (isEnglish() ? "Card" : "Κάρτα"); }
  function courierLabelAcc(key) { var id = String(key || "").toLowerCase(); return COURIER_LABELS_ACC[id] || (key ? String(key) : ""); }
  function orderCancellable(o) {
    if (o.status === "cancelled" || o.status === "completed") return false;
    if (["handed", "transit", "delivered"].indexOf(o.shippingStatus) !== -1) return false;
    if (["shipped", "delivered"].indexOf(o.status) !== -1) return false;
    return true;
  }
  var accountOrders = [];
  function findAccountOrder(id) {
    for (var i = 0; i < accountOrders.length; i++) if (accountOrders[i].id === id) return accountOrders[i];
    return null;
  }

  /* Prefill the register form from ?email=&fn=&ln= (post-purchase account
     offer). We never reveal whether the email already exists — the register
     endpoint returns a neutral error the visitor can act on. */
  function prefillRegisterFromQuery(root) {
    try {
      var params = new URLSearchParams(window.location.search);
      var map = { email: params.get("email"), firstname: params.get("fn"), lastname: params.get("ln") };
      Object.keys(map).forEach(function (name) {
        if (!map[name]) return;
        var el = root.querySelector('[name="' + name + '"]');
        if (el && !el.value) el.value = map[name];
      });
    } catch (e) {}
  }

  function acctToast(msg) {
    var el = document.createElement("div");
    el.className = "account-toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    window.requestAnimationFrame(function () { el.classList.add("is-on"); });
    window.setTimeout(function () {
      el.classList.remove("is-on");
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
  }

  /* Reorder + cancel actions on account order cards (delegated, bound once). */
  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;
    var reorderBtn = e.target.closest("[data-reorder]");
    if (reorderBtn) {
      var ro = findAccountOrder(reorderBtn.getAttribute("data-reorder"));
      if (ro && window.NostalgiaCart && typeof window.NostalgiaCart.addItem === "function") {
        (ro.items || []).forEach(function (it) { if (it.id) window.NostalgiaCart.addItem(it.id, it.qty); });
        acctToast(t("account_order_reordered"));
      }
      return;
    }
    var cancelBtn = e.target.closest("[data-cancel-order]");
    if (cancelBtn) {
      if (!window.confirm(t("account_order_cancel_confirm"))) return;
      if (!(window.NostalgiaAPI && window.NostalgiaAPI.isAvailable())) return;
      cancelBtn.disabled = true;
      window.NostalgiaAPI.post("/api/orders/" + cancelBtn.getAttribute("data-cancel-order") + "/cancel", {}).then(function (res) {
        if (res && res.ok) {
          acctToast(t("account_order_cancelled_ok"));
          renderMyOrders();
        } else {
          cancelBtn.disabled = false;
          acctToast(res && res.error === "not_cancellable"
            ? t("account_order_cancel_toolate")
            : (isEnglish() ? "Could not cancel the order." : "Δεν ήταν δυνατή η ακύρωση."));
        }
      }).catch(function () { cancelBtn.disabled = false; });
      return;
    }
  });

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function greetingKey() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return "account_dashboard_greeting_morning";
    if (h >= 12 && h < 18) return "account_dashboard_greeting_afternoon";
    return "account_dashboard_greeting_evening";
  }

  function avatarInitial(session) {
    var name = (session.firstname || session.email || "?").trim();
    return escapeHtml(name.charAt(0).toUpperCase());
  }

  function buildLoggedInHTML(session) {
    var fullName = escapeHtml(
      ((session.firstname || "") + " " + (session.lastname || "")).trim() || session.email
    );
    return (
      '<div class="account-dashboard" id="account-dashboard">' +
      '  <header class="account-dashboard__hero">' +
      '    <div class="account-dashboard__hero-glow" aria-hidden="true"></div>' +
      '    <div class="account-dashboard__avatar" aria-hidden="true">' + avatarInitial(session) + "</div>" +
      '    <div class="account-dashboard__intro">' +
      '      <p class="account-dashboard__greeting" data-i18n="' + greetingKey() + '">' + t(greetingKey()) + "</p>" +
      '      <h1 class="account-dashboard__name">' + fullName + "</h1>" +
      '      <p class="account-dashboard__email">' + escapeHtml(session.email) + "</p>" +
      '      <p class="account-dashboard__subtitle" data-i18n="account_dashboard_subtitle">' + t("account_dashboard_subtitle") + "</p>" +
      '      <p class="account-dashboard__bday" data-account-bday hidden></p>' +
      "    </div>" +
      '    <button type="button" class="account-dashboard__logout" id="account-logout" data-i18n="account_logout">Αποσύνδεση</button>' +
      "  </header>" +
      '  <div class="account-dashboard__stat" id="account-orders-stat" hidden>' +
      '    <span class="account-dashboard__stat-num" id="account-orders-count">0</span>' +
      '    <span class="account-dashboard__stat-label" id="account-orders-count-label"></span>' +
      "  </div>" +
      '  <nav class="account-dashboard__actions" aria-label="' + (isEnglish() ? "Quick links" : "Σύντομες ενέργειες") + '">' +
      '    <a class="account-dash-card" href="#account-orders">' +
      '      <span class="account-dash-card__icon" aria-hidden="true">◫</span>' +
      '      <span class="account-dash-card__body">' +
      '        <span class="account-dash-card__title" data-i18n="account_quick_orders">' + t("account_quick_orders") + "</span>" +
      '        <span class="account-dash-card__desc" data-i18n="account_quick_orders_desc">' + t("account_quick_orders_desc") + "</span>" +
      "      </span>" +
      '      <span class="account-dash-card__chev" aria-hidden="true">›</span>' +
      "    </a>" +
      '    <a class="account-dash-card" href="/wishlist">' +
      '      <span class="account-dash-card__icon" aria-hidden="true">♡</span>' +
      '      <span class="account-dash-card__body">' +
      '        <span class="account-dash-card__title" data-i18n="account_quick_wishlist">' + t("account_quick_wishlist") + "</span>" +
      '        <span class="account-dash-card__desc" data-i18n="account_quick_wishlist_desc">' + t("account_quick_wishlist_desc") + "</span>" +
      '        <span class="account-dash-card__meta" data-wishlist-meta hidden></span>' +
      "      </span>" +
      '      <span class="account-dash-card__chev" aria-hidden="true">›</span>' +
      "    </a>" +
      '    <a class="account-dash-card" href="#account-address">' +
      '      <span class="account-dash-card__icon" aria-hidden="true">⌖</span>' +
      '      <span class="account-dash-card__body">' +
      '        <span class="account-dash-card__title" data-i18n="account_quick_addresses">' + t("account_quick_addresses") + "</span>" +
      '        <span class="account-dash-card__desc" data-i18n="account_quick_addresses_desc">' + t("account_quick_addresses_desc") + "</span>" +
      "      </span>" +
      '      <span class="account-dash-card__chev" aria-hidden="true">›</span>' +
      "    </a>" +
      "  </nav>" +
      '  <section class="account-dashboard__orders" id="account-orders" hidden>' +
      '    <h2 class="account-orders__title" data-i18n="account_orders_title">' + t("account_orders_title") + "</h2>" +
      '    <div class="account-orders__list" id="account-orders-list"></div>' +
      "  </section>" +
      buildAccountPanels() +
      "</div>"
    );
  }

  function hasApi() {
    return !!(window.NostalgiaAPI && window.NostalgiaAPI.isAvailable());
  }

  function dashField(type, name, labelKey, autocomplete, readonly, wide) {
    return (
      '<label class="account-field' + (wide ? " account-field--wide" : "") + '">' +
      '<span data-i18n="' + labelKey + '">' + t(labelKey) + "</span>" +
      '<input type="' + type + '" name="' + name + '"' +
      (autocomplete ? ' autocomplete="' + autocomplete + '"' : "") +
      (readonly ? " readonly" : "") +
      " /></label>"
    );
  }

  function dashSelect(name, labelKey, id, wide) {
    return (
      '<label class="account-field account-field--select' + (wide ? " account-field--wide" : "") + '">' +
      '<span data-i18n="' + labelKey + '">' + t(labelKey) + "</span>" +
      '<span class="account-select-wrap"><select name="' + name + '" id="' + id + '"></select></span></label>'
    );
  }

  /* Editable panels (profile, address, password). Without API, only the help card. */
  function buildAccountPanels() {
    if (!hasApi()) return buildHelpPanel();
    return (
      '<section class="account-card" id="account-details">' +
      '  <h2 class="account-card__title" data-i18n="account_details_title">' + t("account_details_title") + "</h2>" +
      '  <form class="account-edit" id="account-profile-form" novalidate>' +
      '    <div class="account-edit__grid">' +
      dashField("text", "firstname", "account_first_label", "given-name") +
      dashField("text", "lastname", "account_last_label", "family-name") +
      dashField("email", "email", "account_email_label", "email", true, true) +
      dashField("date", "birthDate", "account_birth_label", "bday") +
      "    </div>" +
      '    <p class="account-form__hint" data-i18n="account_email_hint">' + t("account_email_hint") + "</p>" +
      '    <p class="account-edit__msg" data-msg hidden></p>' +
      '    <button type="submit" class="account-btn account-btn--gold" data-i18n="account_save">' + t("account_save") + "</button>" +
      "  </form>" +
      "</section>" +
      '<section class="account-card" id="account-address">' +
      '  <h2 class="account-card__title" data-i18n="account_address_title">' + t("account_address_title") + "</h2>" +
      '  <div class="account-addr-summary" id="account-addr-summary" data-addr-summary></div>' +
      '  <div class="account-addr-actions" data-addr-actions>' +
      '    <button type="button" class="account-btn account-btn--outline" data-addr-edit data-i18n="account_addr_edit">' + t("account_addr_edit") + "</button>" +
      '    <button type="button" class="account-btn account-btn--outline account-addr-actions__delete" data-addr-delete data-i18n="account_addr_delete">' + t("account_addr_delete") + "</button>" +
      '    <button type="button" class="account-btn account-btn--outline" data-addr-add hidden data-i18n="account_addr_add">' + t("account_addr_add") + "</button>" +
      "  </div>" +
      '  <form class="account-edit" id="account-address-form" data-addr-form hidden novalidate>' +
      '    <div class="account-edit__grid">' +
      dashField("text", "firstname", "checkout_firstname_label", "given-name") +
      dashField("text", "lastname", "checkout_lastname_label", "family-name") +
      dashField("tel", "phone", "checkout_phone_label", "tel-national") +
      dashField("tel", "mobile", "checkout_mobile_label", "tel") +
      dashSelect("country", "checkout_country_label", "account-addr-country") +
      dashField("text", "postal", "checkout_postal_label", "postal-code") +
      dashField("text", "street", "checkout_street_label", "address-line1", false, true) +
      dashField("text", "streetNumber", "checkout_street_number_label", "off") +
      dashField("text", "city", "checkout_city_label", "address-level2") +
      '      <div class="account-field account-field--select account-field--wide" id="account-addr-prefecture-wrap">' +
      '<span data-i18n="checkout_prefecture_label">' + t("checkout_prefecture_label") + "</span>" +
      '<span class="account-select-wrap"><select name="prefecture" id="account-addr-prefecture"></select></span></div>' +
      dashSelect("floor", "checkout_floor_label", "account-addr-floor") +
      dashSelect("locationType", "checkout_location_type_label", "account-addr-location") +
      "    </div>" +
      '    <p class="account-form__hint" data-i18n="account_address_hint">' + t("account_address_hint") + "</p>" +
      '    <p class="account-edit__msg" data-msg hidden></p>' +
      '    <div class="account-form__row">' +
      '      <button type="button" class="account-link" data-addr-cancel data-i18n="account_delete_modal_cancel">' + t("account_delete_modal_cancel") + "</button>" +
      '      <button type="submit" class="account-btn account-btn--gold" data-i18n="account_save">' + t("account_save") + "</button>" +
      "    </div>" +
      "  </form>" +
      "</section>" +
      '<section class="account-card" id="account-newsletter">' +
      '  <h2 class="account-card__title" data-i18n="account_newsletter_title">' + t("account_newsletter_title") + "</h2>" +
      '  <form class="account-edit" id="account-newsletter-form" novalidate>' +
      '    <label class="account-toggle"><input type="checkbox" name="newsletterOptin" />' +
      '      <span data-i18n="account_newsletter_toggle">' + t("account_newsletter_toggle") + "</span></label>" +
      '    <p class="account-edit__msg" data-msg hidden></p>' +
      '    <button type="submit" class="account-btn account-btn--gold" data-i18n="account_save">' + t("account_save") + "</button>" +
      "  </form>" +
      "</section>" +
      '<section class="account-card" id="account-security">' +
      '  <h2 class="account-card__title" data-i18n="account_security_title">' + t("account_security_title") + "</h2>" +
      '  <form class="account-edit" id="account-password-form" novalidate>' +
      '    <div class="account-pw-step" data-pw-step1>' +
      '      <p class="account-pw-step__label" data-i18n="account_pw_step1">' + t("account_pw_step1") + "</p>" +
      '      <p class="account-form__hint" data-i18n="account_pw_code_hint">' + t("account_pw_code_hint") + "</p>" +
      '      <button type="button" class="account-btn account-btn--outline" data-pw-send data-i18n="account_pw_send">' + t("account_pw_send") + "</button>" +
      "    </div>" +
      '    <div class="account-pw-step2" data-pw-step2 hidden>' +
      '      <p class="account-pw-step__label" data-i18n="account_pw_step2">' + t("account_pw_step2") + "</p>" +
      '      <div class="account-edit__grid">' +
      dashField("text", "code", "account_pw_code", "one-time-code") +
      '        <label class="account-field account-field--password account-field--wide">' +
      '          <span data-i18n="account_new_pw">' + t("account_new_pw") + "</span>" +
      passwordFieldHTML("newPassword", "new-password") +
      "        </label>" +
      '        <label class="account-field account-field--password account-field--wide">' +
      '          <span data-i18n="account_pw_confirm">' + t("account_pw_confirm") + "</span>" +
      passwordFieldHTML("passwordConfirm", "new-password") +
      "        </label>" +
      "      </div>" +
      '      <div class="account-pw-strength" data-pw-strength hidden aria-live="polite">' +
      '        <div class="account-pw-strength__track"><span class="account-pw-strength__fill" data-pw-strength-fill></span></div>' +
      '        <span class="account-pw-strength__text" data-pw-strength-label></span>' +
      "      </div>" +
      '      <button type="submit" class="account-btn account-btn--gold" data-i18n="account_pw_save">' + t("account_pw_save") + "</button>" +
      "    </div>" +
      '    <p class="account-edit__msg" data-msg hidden></p>' +
      "  </form>" +
      "</section>" +
      buildPrivacyPanel() +
      buildDangerPanel() +
      buildHelpPanel() +
      buildDeleteModal()
    );
  }

  function buildPrivacyPanel() {
    return (
      '<section class="account-card" id="account-privacy">' +
      '  <h2 class="account-card__title" data-i18n="account_privacy_title">' + t("account_privacy_title") + "</h2>" +
      '  <div class="account-privacy__block">' +
      '    <h3 class="account-card__subtitle" data-i18n="account_privacy_data_title">' + t("account_privacy_data_title") + "</h3>" +
      '    <p class="account-form__hint" data-i18n="account_privacy_data_desc">' + t("account_privacy_data_desc") + "</p>" +
      '    <a class="account-btn account-btn--outline" id="account-export-btn" href="/api/auth/export" download="nostalgia-my-data.json" data-i18n="account_privacy_export_btn">' +
      t("account_privacy_export_btn") +
      "</a>" +
      "  </div>" +
      "</section>"
    );
  }

  function buildDangerPanel() {
    return (
      '<section class="account-card account-card--danger" id="account-danger">' +
      '  <h2 class="account-card__title" data-i18n="account_danger_title">' + t("account_danger_title") + "</h2>" +
      '  <p class="account-form__hint" data-i18n="account_danger_desc">' + t("account_danger_desc") + "</p>" +
      '  <button type="button" class="account-btn account-btn--danger" id="account-delete-open" data-i18n="account_delete_btn">' + t("account_delete_btn") + "</button>" +
      "</section>"
    );
  }

  function buildHelpPanel() {
    return (
      '<section class="account-card account-card--help" id="account-help">' +
      '  <h2 class="account-card__title" data-i18n="account_help_title">' + t("account_help_title") + "</h2>" +
      '  <p class="account-form__hint" data-i18n="account_help_desc">' + t("account_help_desc") + "</p>" +
      '  <a class="account-btn account-btn--outline" href="/contact" data-i18n="account_help_contact">' + t("account_help_contact") + "</a>" +
      "</section>"
    );
  }

  function buildDeleteModal() {
    return (
      '<div class="account-modal" id="account-delete-modal" hidden aria-hidden="true">' +
      '  <div class="account-modal__backdrop" data-delete-close tabindex="-1" aria-hidden="true"></div>' +
      '  <div class="account-modal__panel" role="dialog" aria-labelledby="account-delete-modal-title">' +
      '    <h2 class="account-modal__title" id="account-delete-modal-title" data-i18n="account_delete_modal_title">' + t("account_delete_modal_title") + "</h2>" +
      '    <p class="account-form__hint" data-i18n="account_delete_modal_lead">' + t("account_delete_modal_lead") + "</p>" +
      '    <form class="account-edit" id="account-delete-form" novalidate>' +
      '      <label class="account-field account-field--password account-field--wide">' +
      '        <span data-i18n="account_password_label">' + t("account_password_label") + "</span>" +
      passwordFieldHTML("deletePassword", "current-password") +
      "      </label>" +
      '      <p class="account-edit__msg" data-msg hidden></p>' +
      '      <div class="account-form__row">' +
      '        <button type="button" class="account-link" data-delete-close data-i18n="account_delete_modal_cancel">' + t("account_delete_modal_cancel") + "</button>" +
      '        <button type="submit" class="account-btn account-btn--danger" data-i18n="account_delete_modal_confirm">' + t("account_delete_modal_confirm") + "</button>" +
      "      </div>" +
      "    </form>" +
      "  </div>" +
      "</div>"
    );
  }

  function hasSavedAddress(a) {
    if (!a) return false;
    return !!(a.street || a.city || a.postal || a.firstname || a.lastname);
  }

  function formatAddressSummaryHtml(a) {
    var name = escapeHtml(((a.firstname || "") + " " + (a.lastname || "")).trim());
    var line1 = escapeHtml([a.street, a.streetNumber].filter(Boolean).join(" "));
    var line2 = escapeHtml([a.postal, a.city].filter(Boolean).join(" "));
    var country = escapeHtml(a.country || countryLabelFor(a.countryCode));
    var phone = escapeHtml(a.phone || a.mobile || "");
    var html =
      '<div class="account-addr-summary__card">' +
      '<p class="account-addr-summary__badge" data-i18n="account_addr_primary">' + t("account_addr_primary") + "</p>";
    if (name) html += '<p class="account-addr-summary__name">' + name + "</p>";
    if (line1) html += '<p class="account-addr-summary__line">' + line1 + "</p>";
    if (line2) html += '<p class="account-addr-summary__line">' + line2 + "</p>";
    if (country) html += '<p class="account-addr-summary__line">' + country + "</p>";
    if (phone) html += '<p class="account-addr-summary__phone">' + phone + "</p>";
    return html + "</div>";
  }

  function renderAddressSummary() {
    var summary = document.getElementById("account-addr-summary");
    var editBtn = document.querySelector("[data-addr-edit]");
    var addBtn = document.querySelector("[data-addr-add]");
    var delBtn = document.querySelector("[data-addr-delete]");
    if (!summary) return;
    var saved = hasSavedAddress(cachedAddress);
    if (saved) {
      summary.innerHTML = formatAddressSummaryHtml(cachedAddress);
    } else {
      summary.innerHTML =
        '<p class="account-addr-summary__empty" data-i18n="account_addr_empty">' + t("account_addr_empty") + "</p>";
    }
    summary.hidden = false;
    if (editBtn) editBtn.hidden = !saved;
    if (delBtn) delBtn.hidden = !saved;
    if (addBtn) addBtn.hidden = saved;
  }

  function setAddressEditing(editing) {
    var form = document.getElementById("account-address-form");
    var summary = document.getElementById("account-addr-summary");
    var actions = document.querySelector("[data-addr-actions]");
    if (form) form.hidden = !editing;
    if (summary) summary.hidden = editing;
    if (actions) actions.hidden = editing;
  }

  function updateWishlistMeta() {
    var el = document.querySelector("[data-wishlist-meta]");
    if (!el || !window.NostalgiaWishlist || typeof window.NostalgiaWishlist.getCount !== "function") return;
    var n = window.NostalgiaWishlist.getCount();
    if (n <= 0) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = n === 1 ? t("account_wishlist_count_one") : t("account_wishlist_count").replace("{n}", String(n));
    el.hidden = false;
  }

  function scorePassword(pw) {
    if (!pw) return 0;
    var score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return 1;
    if (score <= 3) return 2;
    return 3;
  }

  function updatePasswordStrength(form) {
    if (!form) return;
    var input = form.elements.newPassword;
    var meter = form.querySelector("[data-pw-strength]");
    var fill = form.querySelector("[data-pw-strength-fill]");
    var label = form.querySelector("[data-pw-strength-label]");
    if (!input || !meter) return;
    var score = scorePassword(input.value);
    if (!input.value) {
      meter.hidden = true;
      if (fill) fill.style.width = "0%";
      if (label) label.textContent = "";
      meter.removeAttribute("data-level");
      return;
    }
    meter.hidden = false;
    meter.setAttribute("data-level", String(score));
    var keys = ["account_pw_strength_weak", "account_pw_strength_weak", "account_pw_strength_medium", "account_pw_strength_strong"];
    if (label) label.textContent = t(keys[score] || keys[1]);
    if (fill) fill.style.width = Math.round((score / 3) * 100) + "%";
  }

  function openDeleteModal() {
    var modal = document.getElementById("account-delete-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    var form = document.getElementById("account-delete-form");
    if (form) {
      form.reset();
      var msg = form.querySelector("[data-msg]");
      if (msg) msg.hidden = true;
      bindPasswordToggles(form);
    }
    window.requestAnimationFrame(function () {
      modal.classList.add("is-visible");
    });
  }

  function closeDeleteModal() {
    var modal = document.getElementById("account-delete-modal");
    if (!modal) return;
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (!modal.classList.contains("is-visible")) modal.hidden = true;
    }, 320);
  }

  function setFormVal(formId, name, value) {
    var f = document.getElementById(formId);
    if (!f || !f.elements[name]) return;
    f.elements[name].value = value || "";
  }

  function showBirthday(birthDate) {
    var el = document.querySelector("[data-account-bday]");
    if (!el) return;
    var d = birthDate ? new Date(birthDate) : null;
    if (!d || isNaN(d.getTime())) {
      el.hidden = true;
      return;
    }
    var formatted = d.toLocaleDateString(isEnglish() ? "en-GB" : "el-GR", {
      day: "numeric",
      month: "long",
    });
    el.textContent = "🎂 " + t("account_bday_prefix") + " · " + formatted;
    el.hidden = false;
  }

  function showFormMsg(form, key, ok) {
    var msg = form.querySelector("[data-msg]");
    if (!msg) return;
    msg.textContent = t(key);
    msg.classList.toggle("is-error", !ok);
    msg.classList.toggle("is-ok", !!ok);
    msg.hidden = false;
  }

  function initAccountPanels() {
    updateWishlistMeta();

    if (!hasApi()) return;

    populateAccountAddressSelects();
    bindProfileForm();
    bindAddressForm();
    bindPasswordForm();
    bindNewsletterForm();
    bindAddressCardUI();
    bindDeleteModal();
    bindDeleteForm();

    window.NostalgiaAPI.get("/api/auth/me").then(function (res) {
      if (!res || !res.ok || !res.user) return;
      var u = res.user;
      showBirthday(u.birthDate);
      setFormVal("account-profile-form", "firstname", u.firstname);
      setFormVal("account-profile-form", "lastname", u.lastname);
      setFormVal("account-profile-form", "email", u.email);
      setFormVal("account-profile-form", "birthDate", u.birthDate);
      cachedAddress = u.address || null;
      loadAddressIntoForm(cachedAddress || {});
      renderAddressSummary();
      setAddressEditing(false);
      var nl = document.querySelector('#account-newsletter-form input[name="newsletterOptin"]');
      if (nl) nl.checked = !!u.newsletterOptin;
    });

    enhanceDateInputs(document.getElementById("account-profile-form"));
  }

  function setSelectVal(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.value = value;
  }

  function loadAddressIntoForm(a) {
    a = a || {};
    ["firstname", "lastname", "phone", "mobile", "postal", "street", "streetNumber", "city"].forEach(function (k) {
      setFormVal("account-address-form", k, a[k] || "");
    });
    setSelectVal("account-addr-country", a.countryCode || "GR");
    setSelectVal("account-addr-prefecture", a.prefecture);
    setSelectVal("account-addr-floor", a.floor);
    setSelectVal("account-addr-location", a.locationType);
    toggleAccountPrefecture();
  }

  /* Populate the account address selects with the same data the checkout uses,
     so the saved address mirrors the checkout form exactly. */
  function populateAccountAddressSelects() {
    var lang = isEnglish() ? "en" : "el";
    var country = document.getElementById("account-addr-country");
    if (country && window.NostalgiaEuropeCountries) {
      country.innerHTML = window.NostalgiaEuropeCountries
        .sorted(lang)
        .map(function (e) {
          return '<option value="' + e.code + '">' + (e[lang] || e.en) + "</option>";
        })
        .join("");
      country.value = "GR";
      if (country.dataset.bound !== "1") {
        country.dataset.bound = "1";
        country.addEventListener("change", toggleAccountPrefecture);
      }
    }
    if (window.NostalgiaPrefectures) {
      window.NostalgiaPrefectures.populateSelect(
        document.getElementById("account-addr-prefecture"),
        t("checkout_prefecture_placeholder")
      );
    }
    if (window.NostalgiaAddressOptions) {
      var AO = window.NostalgiaAddressOptions;
      AO.populateSelect(document.getElementById("account-addr-floor"), AO.floors, t("checkout_floor_placeholder"), t);
      AO.populateSelect(document.getElementById("account-addr-location"), AO.locationTypes, t("checkout_location_type_placeholder"), t);
    }
    toggleAccountPrefecture();
  }

  /* Prefecture only applies to Greece (matches checkout behaviour). */
  function toggleAccountPrefecture() {
    var country = document.getElementById("account-addr-country");
    var wrap = document.getElementById("account-addr-prefecture-wrap");
    if (!country || !wrap) return;
    wrap.hidden = country.value !== "GR";
  }

  function countryLabelFor(code) {
    if (!window.NostalgiaEuropeCountries) return code || "";
    var lang = isEnglish() ? "en" : "el";
    var m = window.NostalgiaEuropeCountries.sorted(lang).filter(function (e) {
      return e.code === code;
    })[0];
    return m ? m[lang] || m.en : code || "";
  }

  function bindProfileForm() {
    var form = document.getElementById("account-profile-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      window.NostalgiaAPI
        .patch("/api/auth/me", {
          firstname: form.elements.firstname.value.trim(),
          lastname: form.elements.lastname.value.trim(),
          birthDate: form.elements.birthDate.value,
        })
        .then(function (res) {
          if (btn) btn.disabled = false;
          if (res && res.ok && res.user) {
            showFormMsg(form, "account_saved", true);
            showBirthday(res.user.birthDate);
            var nameEl = document.querySelector(".account-dashboard__name");
            if (nameEl) {
              nameEl.textContent =
                ((res.user.firstname || "") + " " + (res.user.lastname || "")).trim() || res.user.email;
            }
            if (window.NostalgiaAPI.syncSession) window.NostalgiaAPI.syncSession();
          } else {
            showFormMsg(form, "account_save_error", false);
          }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          showFormMsg(form, "account_save_error", false);
        });
    });
  }

  function bindNewsletterForm() {
    var form = document.getElementById("account-newsletter-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      var nl = form.elements.newsletterOptin;
      window.NostalgiaAPI
        .post("/api/auth/newsletter", { optin: !!(nl && nl.checked) })
        .then(function (res) {
          if (btn) btn.disabled = false;
          showFormMsg(form, res && res.ok ? "account_saved" : "account_save_error", !!(res && res.ok));
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          showFormMsg(form, "account_save_error", false);
        });
    });
  }

  function bindAddressForm() {
    var form = document.getElementById("account-address-form");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      var val = function (name) {
        return form.elements[name] ? form.elements[name].value.trim() : "";
      };
      var selVal = function (id) {
        var el = document.getElementById(id);
        return el ? el.value : "";
      };
      var code = selVal("account-addr-country");
      var body = {
        firstname: val("firstname"),
        lastname: val("lastname"),
        phone: val("phone"),
        mobile: val("mobile"),
        postal: val("postal"),
        countryCode: code,
        country: countryLabelFor(code),
        street: val("street"),
        streetNumber: val("streetNumber"),
        city: val("city"),
        prefecture: selVal("account-addr-prefecture"),
        floor: selVal("account-addr-floor"),
        locationType: selVal("account-addr-location"),
      };
      window.NostalgiaAPI
        .put("/api/auth/address", body)
        .then(function (res) {
          if (btn) btn.disabled = false;
          showFormMsg(form, res && res.ok ? "account_saved" : "account_save_error", !!(res && res.ok));
          if (res && res.ok) {
            cachedAddress = res.address || null;
            renderAddressSummary();
            setAddressEditing(false);
          }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          showFormMsg(form, "account_save_error", false);
        });
    });
  }

  function langCode() {
    return isEnglish() ? "en" : "el";
  }

  /* Shared "code to email → verify → set new password" wiring, used by both the
     logged-in change-password card and the logged-out forgot-password panel.
     opts.getEmail: null for logged-in (server uses the session), or a function
     returning the typed email for the forgot flow. opts.onSuccess: callback. */
  function wireCodeReset(form, opts) {
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    var sendBtn = form.querySelector("[data-pw-send]");
    var step2 = form.querySelector("[data-pw-step2]");

    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        var email = opts.getEmail ? opts.getEmail() : null;
        if (opts.getEmail && (!email || email.indexOf("@") === -1)) {
          showFormMsg(form, "account_save_error", false);
          return;
        }
        sendBtn.disabled = true;
        var body = { lang: langCode() };
        if (email) body.email = email;
        window.NostalgiaAPI
          .post("/api/auth/request-code", body)
          .then(function (res) {
            sendBtn.disabled = false;
            if (res && res.ok) {
              if (step2) step2.hidden = false;
              showFormMsg(form, "account_pw_sent", true);
            } else {
              showFormMsg(form, "account_save_error", false);
            }
          })
          .catch(function () {
            sendBtn.disabled = false;
            showFormMsg(form, "account_save_error", false);
          });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var next = form.elements.newPassword ? form.elements.newPassword.value : "";
      if (!next || next.length < 6) {
        showFormMsg(form, "account_pw_weak", false);
        return;
      }
      if (form.elements.passwordConfirm) {
        var confirmPw = form.elements.passwordConfirm.value;
        if (next !== confirmPw) {
          showFormMsg(form, "account_password_mismatch", false);
          return;
        }
      }
      var code = form.elements.code ? form.elements.code.value.trim() : "";
      if (!code) {
        showFormMsg(form, "account_code_invalid", false);
        return;
      }
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      var body = { code: code, newPassword: next, lang: langCode() };
      if (opts.getEmail) {
        var em = opts.getEmail();
        if (em) body.email = em;
      }
      window.NostalgiaAPI
        .post("/api/auth/reset-password", body)
        .then(function (res) {
          if (btn) btn.disabled = false;
          if (res && res.ok) {
            if (opts.onSuccess) opts.onSuccess();
          } else if (res && (res.error === "invalid_code" || res.error === "code_expired")) {
            showFormMsg(form, "account_code_invalid", false);
          } else if (res && isPwStrengthError(res.error)) {
            showRawFormMsg(form, pwStrengthMsg(res.error), false);
          } else {
            showFormMsg(form, "account_save_error", false);
          }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          showFormMsg(form, "account_save_error", false);
        });
    });
  }

  function initPasswordStrength(form) {
    if (!form || form.dataset.strengthBound === "1") return;
    form.dataset.strengthBound = "1";
    var input = form.elements.newPassword;
    if (!input) return;
    input.addEventListener("input", function () {
      updatePasswordStrength(form);
    });
    bindPasswordToggles(form);
  }

  function bindPasswordForm() {
    var form = document.getElementById("account-password-form");
    wireCodeReset(form, {
      getEmail: null, /* logged-in — server uses the session email */
      onSuccess: function () {
        showFormMsg(form, "account_pw_changed", true);
        var step2 = form.querySelector("[data-pw-step2]");
        if (step2) step2.hidden = true;
        form.reset();
        updatePasswordStrength(form);
      },
    });
    initPasswordStrength(form);
  }

  function bindAddressCardUI() {
    var section = document.getElementById("account-address");
    if (!section || section.dataset.addrUiBound === "1") return;
    section.dataset.addrUiBound = "1";

    section.addEventListener("click", function (e) {
      if (e.target.closest("[data-addr-edit]") || e.target.closest("[data-addr-add]")) {
        setAddressEditing(true);
        return;
      }
      if (e.target.closest("[data-addr-cancel]")) {
        loadAddressIntoForm(cachedAddress || {});
        var form = document.getElementById("account-address-form");
        if (form) {
          var msg = form.querySelector("[data-msg]");
          if (msg) msg.hidden = true;
        }
        setAddressEditing(false);
        return;
      }
      if (e.target.closest("[data-addr-delete]")) {
        var delBtn = e.target.closest("[data-addr-delete]");
        if (delBtn) delBtn.disabled = true;
        window.NostalgiaAPI
          .put("/api/auth/address", {})
          .then(function (res) {
            if (delBtn) delBtn.disabled = false;
            if (res && res.ok) {
              cachedAddress = null;
              loadAddressIntoForm({});
              renderAddressSummary();
              setAddressEditing(false);
            }
          })
          .catch(function () {
            if (delBtn) delBtn.disabled = false;
          });
      }
    });
  }

  function bindDeleteModal() {
    var openBtn = document.getElementById("account-delete-open");
    if (openBtn && openBtn.dataset.bound !== "1") {
      openBtn.dataset.bound = "1";
      openBtn.addEventListener("click", openDeleteModal);
    }
    document.querySelectorAll("[data-delete-close]").forEach(function (el) {
      if (el.dataset.bound === "1") return;
      el.dataset.bound = "1";
      el.addEventListener("click", closeDeleteModal);
    });
    if (document.documentElement.dataset.deleteModalEscBound === "1") return;
    document.documentElement.dataset.deleteModalEscBound = "1";
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = document.getElementById("account-delete-modal");
      if (modal && !modal.hidden) closeDeleteModal();
    });
  }

  /* GDPR account deletion — password confirmed in modal (no window.confirm). */
  function bindDeleteForm() {
    var form = document.getElementById("account-delete-form");
    if (!form || form.dataset.bound === "1" || !hasApi()) return;
    form.dataset.bound = "1";
    bindPasswordToggles(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var pass = form.elements.deletePassword ? form.elements.deletePassword.value : "";
      if (!pass) {
        showFormMsg(form, "account_save_error", false);
        return;
      }
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      window.NostalgiaAPI
        .post("/api/auth/delete-account", { password: pass })
        .then(function (res) {
          if (btn) btn.disabled = false;
          if (res && res.ok) {
            closeDeleteModal();
            setTimeout(function () {
              window.location.href = "/";
            }, 400);
          } else if (res && res.error === "wrong_password") {
            showFormMsg(form, "account_pw_wrong", false);
          } else if (res && res.error === "too_many_attempts") {
            showFormMsg(form, "account_save_error", false);
          } else {
            showFormMsg(form, "account_save_error", false);
          }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          showFormMsg(form, "account_save_error", false);
        });
    });
  }

  function isPwStrengthError(code) {
    return /^password_(too_short|too_long|needs_)/.test(String(code || ""));
  }

  function pwStrengthMsg(code) {
    var en = isEnglish();
    var map = {
      password_too_short: en ? "Password must be at least 8 characters." : "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
      password_too_long: en ? "Password is too long." : "Ο κωδικός είναι πολύ μεγάλος.",
      password_needs_lowercase: en ? "Password must include a lowercase letter." : "Ο κωδικός πρέπει να περιέχει πεζό γράμμα.",
      password_needs_uppercase: en ? "Password must include an uppercase letter." : "Ο κωδικός πρέπει να περιέχει κεφαλαίο γράμμα.",
      password_needs_digit: en ? "Password must include a number." : "Ο κωδικός πρέπει να περιέχει αριθμό.",
    };
    return map[code] || (en ? "Password is too weak." : "Ο κωδικός είναι πολύ αδύναμος.");
  }

  /* Like showFormMsg but for literal text (the GDPR strings aren't in i18n). */
  function showRawFormMsg(form, text, ok) {
    var msg = form.querySelector("[data-msg]");
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle("is-error", !ok);
    msg.classList.toggle("is-ok", !!ok);
    msg.hidden = false;
  }

  function animateDashboard() {
    var dash = document.getElementById("account-dashboard");
    if (!dash) return;
    window.requestAnimationFrame(function () {
      dash.classList.add("is-visible");
    });
  }

  function updateOrdersStat(count) {
    var stat = document.getElementById("account-orders-stat");
    var num = document.getElementById("account-orders-count");
    var label = document.getElementById("account-orders-count-label");
    if (!stat || !num || !label) return;
    if (!count) {
      stat.hidden = true;
      return;
    }
    num.textContent = String(count);
    label.textContent = t("account_orders_label");
    stat.hidden = false;
  }

  function renderMyOrders() {
    var wrap = document.getElementById("account-orders");
    var list = document.getElementById("account-orders-list");
    if (!wrap || !list) return;
    wrap.hidden = false;
    if (!window.NostalgiaAPI || !window.NostalgiaAPI.isAvailable()) {
      list.innerHTML =
        '<div class="account-orders__empty-wrap">' +
        '  <p class="account-orders__empty" data-i18n="account_orders_empty">' + t("account_orders_empty") + "</p>" +
        '  <a class="account-btn account-btn--gold account-orders__empty-cta" href="/collection" data-i18n="account_orders_empty_cta">' +
        t("account_orders_empty_cta") +
        "</a>" +
        "</div>";
      if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
        window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
      }
      return;
    }
    list.innerHTML = '<div class="account-orders__loading" aria-hidden="true"></div>';
    window.NostalgiaAPI.get("/api/orders/mine").then(function (res) {
      if (!res.ok) {
        list.innerHTML = "";
        return;
      }
      updateOrdersStat(res.orders ? res.orders.length : 0);
      if (!res.orders || !res.orders.length) {
        list.innerHTML =
          '<div class="account-orders__empty-wrap account-orders__empty-wrap--reveal">' +
          '  <p class="account-orders__empty" data-i18n="account_orders_empty">' + t("account_orders_empty") + "</p>" +
          '  <a class="account-btn account-btn--gold account-orders__empty-cta" href="/collection" data-i18n="account_orders_empty_cta">' +
          t("account_orders_empty_cta") +
          "</a>" +
          "</div>";
        return;
      }
      accountOrders = res.orders;
      list.innerHTML = res.orders
        .map(function (o, idx) {
          var d = new Date(o.createdAt);
          var items = (o.items || [])
            .map(function (it) {
              return (
                '<li class="account-order__item">' +
                (it.image
                  ? '<img src="' + escapeHtml(it.image) + '" alt="" loading="lazy" width="40" height="40" />'
                  : '<span class="account-order__item-ph" aria-hidden="true">✦</span>') +
                "<span class=\"account-order__item-text\">" +
                escapeHtml(it.title) +
                " × " +
                it.qty +
                (it.price != null
                  ? ' <em>€' + Number(it.price * it.qty).toFixed(2) + "</em>"
                  : "") +
                "</span></li>"
              );
            })
            .join("");
          var courier = o.courier || (o.customer && o.customer.courier) || "";
          return (
            '<article class="account-order account-order--reveal" data-order-id="' + escapeHtml(o.id) + '" style="--reveal-i:' +
            idx +
            '">' +
            '  <header class="account-order__head">' +
            '    <span class="account-order__num">' + escapeHtml(o.number) + "</span>" +
            '    <time class="account-order__date" datetime="' + d.toISOString() + '">' +
            d.toLocaleDateString(isEnglish() ? "en-GB" : "el-GR", { day: "numeric", month: "short", year: "numeric" }) +
            "</time>" +
            "  </header>" +
            '  <div class="account-order__badges">' +
            '    <span class="account-order__badge account-order__badge--order account-order__status--' + escapeHtml(o.status) + '">' + escapeHtml(orderStatusLabel(o.status)) + "</span>" +
            '    <span class="account-order__badge account-order__badge--pay">' + escapeHtml(payMethodLabel(o) + " · " + payStatusLabel(o.paymentStatus)) + "</span>" +
            '    <span class="account-order__badge account-order__badge--ship">' + escapeHtml(shipStatusLabel(o.shippingStatus)) + "</span>" +
            "  </div>" +
            (o.tracking
              ? '  <p class="account-order__tracking">' + t("account_order_tracking") + ": <strong>" + escapeHtml(o.tracking) + "</strong>" +
                (courier ? " · " + escapeHtml(courierLabelAcc(courier)) : "") + "</p>"
              : (courier ? '  <p class="account-order__tracking">' + t("account_order_courier") + ": <strong>" + escapeHtml(courierLabelAcc(courier)) + "</strong></p>" : "")) +
            '  <ul class="account-order__items">' + items + "</ul>" +
            (o.total
              ? '<p class="account-order__total">' + (isEnglish() ? "Total" : "Σύνολο") + ": <strong>€" + Number(o.total).toFixed(2) + "</strong></p>"
              : "") +
            '  <div class="account-order__actions">' +
            '    <button type="button" class="account-order__btn account-order__btn--reorder" data-reorder="' + escapeHtml(o.id) + '">' + t("account_order_reorder") + "</button>" +
            (orderCancellable(o)
              ? '    <button type="button" class="account-order__btn account-order__btn--cancel" data-cancel-order="' + escapeHtml(o.id) + '">' + t("account_order_cancel") + "</button>"
              : "") +
            "  </div>" +
            "</article>"
          );
        })
        .join("");
    });
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
        if (hasApi()) {
          panelMode = "forgot";
          renderPanel();
          focusFirstAccountField();
        } else {
          alert(t("account_forgot_help"));
        }
        return;
      }
      if (e.target.closest("#account-back-login")) {
        e.preventDefault();
        panelMode = "login";
        renderPanel();
        focusFirstAccountField();
        return;
      }
      if (e.target.closest("#account-logout")) {
        e.preventDefault();
        if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
          window.NostalgiaAPI.post("/api/auth/logout");
        }
        clearSession();
        panelMode = "login";
        renderPanel({ leaving: true });
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

  function accountPath(mode) {
    return mode === "register" ? "/account/register" : "/account";
  }

  function accountModeFromLocation() {
    var path = (window.location.pathname || "").replace(/\/$/, "");
    if (path.endsWith("/register")) return "register";
    return "login";
  }

  function syncAccountUrl() {
    if (!isAccountPage()) return;
    var target = getSession() ? "/account" : accountPath(panelMode);
    try {
      history.replaceState(null, "", target);
    } catch (e) {}
  }

  function navigateToAccountPage(mode) {
    if (isAccountPage()) {
      panelMode = mode === "register" ? "register" : "login";
      renderPanel();
      focusFirstAccountField();
      syncAccountUrl();
      return;
    }
    if (redirectingToAccountPage) return;
    redirectingToAccountPage = true;
    window.location.href = accountPath(mode);
  }

  function handleLoginSubmit(loginForm) {
    var loginError = document.getElementById("account-login-error");
    if (!loginForm.reportValidity()) return;
    var remember = !(loginForm.remember && !loginForm.remember.checked);
    loginUser(
      loginForm.email.value,
      loginForm.password.value,
      remember,
      captchaToken(loginCaptcha)
    ).then(function (result) {
      if (!result.ok) {
        if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(loginCaptcha);
        if (loginError) {
          loginError.hidden = false;
          loginError.textContent =
            result.error === "captcha_failed"
              ? (isEnglish() ? "Please complete the verification." : "Ολοκληρώστε την επαλήθευση.")
              : t("account_login_error");
        }
        return;
      }
      if (loginError) loginError.hidden = true;
      renderPanel({ leaving: true });
    });
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
    registerUser({
      email: registerForm.email.value,
      firstname: registerForm.firstname.value,
      lastname: registerForm.lastname.value,
      birthDate: registerForm.birthDate ? registerForm.birthDate.value : "",
      newsletterOptin: !!(registerForm.newsletterOptin && registerForm.newsletterOptin.checked),
      password: registerForm.password.value,
      captchaToken: captchaToken(registerCaptcha),
    }).then(function (result) {
      if (!result.ok) {
        if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(registerCaptcha);
        if (registerError) {
          registerError.hidden = false;
          registerError.textContent = result.error === "captcha_failed"
            ? (isEnglish() ? "Please complete the verification." : "Ολοκληρώστε την επαλήθευση.")
            : isPwStrengthError(result.error)
            ? pwStrengthMsg(result.error)
            : t("account_exists_error");
        }
        return;
      }
      if (registerError) registerError.hidden = true;
      renderPanel({ leaving: true });
    });
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

  function renderPanel(opts) {
    opts = opts || {};
    ensureStylesheet();
    var root = getPanelRoot();
    if (!root) return;
    var session = getSession();
    if (isAccountPage()) {
      document.body.classList.remove(
        "account-view--login",
        "account-view--register",
        "account-view--logged"
      );
    }
    if (opts.leaving) {
      var leaving = root.querySelector(".account-panel, .account-dashboard");
      if (leaving) {
        leaving.classList.add("account-panel--leaving");
        window.setTimeout(function () {
          renderPanel({ skipLeaving: true });
        }, 280);
        return;
      }
    }
    if (session) {
      root.innerHTML = buildLoggedInHTML(session);
      if (isAccountPage()) document.body.classList.add("account-view--logged");
      if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
        window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
      }
      renderMyOrders();
      initAccountPanels();
      animateDashboard();
    } else if (panelMode === "register") {
      root.innerHTML = buildRegisterHTML();
      if (isAccountPage()) document.body.classList.add("account-view--register");
      if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
        window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
      }
      prefillRegisterFromQuery(root);
      bindPasswordToggles(root);
      enhanceDateInputs(root);
      registerCaptcha = mountCaptcha("account-register-captcha");
      window.requestAnimationFrame(function () {
        var panel = root.querySelector(".account-panel");
        if (panel) panel.classList.add("account-panel--entered");
      });
    } else if (panelMode === "forgot") {
      root.innerHTML = buildForgotHTML();
      if (isAccountPage()) document.body.classList.add("account-view--login");
      if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
        window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
      }
      bindForgotForm();
      window.requestAnimationFrame(function () {
        var panel = root.querySelector(".account-panel");
        if (panel) panel.classList.add("account-panel--entered");
      });
    } else {
      root.innerHTML = buildLoginHTML();
      if (isAccountPage()) document.body.classList.add("account-view--login");
      if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
        window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
      }
      bindPasswordToggles(root);
      loginCaptcha = mountCaptcha("account-login-captcha");
      window.requestAnimationFrame(function () {
        var panel = root.querySelector(".account-panel");
        if (panel) panel.classList.add("account-panel--entered");
      });
    }
    syncAccountUrl();
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
      el.setAttribute("href", "/account");
      el.removeAttribute("data-side-panel");
      if (el.tagName === "BUTTON") {
        var a = document.createElement("a");
        a.className = el.className;
        a.href = "/account";
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
      '    <a class="newsletter-popup__privacy" href="/privacy" data-i18n="footer_privacy">Προστασία Δεδομένων</a>' +
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
    var active = document.activeElement;
    if (active && modal.contains(active)) {
      active.blur();
    }
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
      panelMode = accountModeFromLocation();
      var params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "register") panelMode = "register";
    }
    disableLegacyDrawerAccountUI();
    bindAccountDelegation();
    bindNewsletter();
    ensurePanelRoot();
    setupHeaderAccount();
    /* Newsletter band above footer — popup only via data-newsletter-open */

    window.addEventListener("load", ensureHeaderAccountVisible);
    document.addEventListener("nostalgia-side-nav-ready", ensureHeaderAccountVisible);

    /* Backend session re-synced (api.js) — refresh the account UI. */
    document.addEventListener("nostalgia-api-session", function () {
      updateHeaderAccount();
      if (isAccountPage()) renderPanel();
    });

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
    saveNewsletter: saveNewsletter,
    getSession: getSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
