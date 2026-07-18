(function () {
  "use strict";

  var STATUS_LABELS = {
    new: "Νέα",
    processing: "Σε επεξεργασία",
    shipped: "Απεστάλη",
    completed: "Ολοκληρώθηκε",
    cancelled: "Ακυρώθηκε",
  };

  var state = {
    orders: [],
    ordersFilter: "",
    ordersPage: 1,
    ordersPagination: null,
    usersPage: 1,
    usersPagination: null,
    newsletterPage: 1,
    newsletterPagination: null,
    messagesPage: 1,
    messagesPagination: null,
    expanded: {},
  };

  /* ---------- helpers ---------- */

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Local path or full Cloudinary HTTPS URL. */
  function imgSrc(image) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    return "/" + image;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("el-GR") + " " + d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
  }

  function pagerHtml(kind, meta) {
    if (!meta || meta.pages <= 1) return "";
    var from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
    var to = Math.min(meta.total, meta.page * meta.limit);
    return (
      '<div class="pager" data-pager="' + esc(kind) + '">' +
      '<button class="btn btn--small btn--ghost" data-page-prev="' + esc(kind) + '"' + (meta.page <= 1 ? " disabled" : "") + '>Prev</button>' +
      '<span class="pager__meta">' + from + "-" + to + " / " + meta.total + "</span>" +
      '<button class="btn btn--small btn--ghost" data-page-next="' + esc(kind) + '"' + (meta.page >= meta.pages ? " disabled" : "") + '>Next</button>' +
      "</div>"
    );
  }

  function pageUrl(path, page, extra) {
    var params = new URLSearchParams();
    params.set("page", String(page || 1));
    params.set("limit", "50");
    Object.keys(extra || {}).forEach(function (key) {
      if (extra[key]) params.set(key, extra[key]);
    });
    return path + "?" + params.toString();
  }

  /* Unique, human-readable product code (SKU) derived from the unique id —
     e.g. "cat1-1" → "NI-CAT1-1", "cu-12" → "NI-CU-12". */
  function prodCode(p) {
    return "NI-" + String(p.id || "").toUpperCase();
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    }).then(function (res) {
      if (res.status === 401 && path.indexOf("/api/admin/login") === -1) {
        showLogin();
        throw new Error("unauthorized");
      }
      return res.json();
    });
  }

  function errMsg(code) {
    var map = {
      invalid_sale_price: "Η τιμή έκπτωσης πρέπει να είναι μικρότερη από την κανονική τιμή.",
      invalid_sale_days: "Μη έγκυρη διάρκεια έκπτωσης (1–3650 μέρες).",
      invalid_price: "Μη έγκυρη τιμή.",
      invalid_stock: "Μη έγκυρη τιμή stock.",
      missing_title: "Συμπληρώστε όνομα προϊόντος.",
      invalid_category: "Μη έγκυρη κατηγορία.",
      invalid_image: "Μη έγκυρη εικόνα.",
    };
    return map[code] || code || "αποτυχία";
  }

  var toastTimer = null;
  function toast(text) {
    var el = $("#toast");
    el.textContent = text;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, 2600);
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    var overlay = $("#confirm-dialog");
    var titleEl = $("#confirm-title");
    var msgEl = $("#confirm-message");
    var okBtn = $("#confirm-ok");
    var cancelBtn = $("#confirm-cancel");
    var title = opts.title || "Επιβεβαίωση";
    var confirmLabel = opts.confirm || "Διαγραφή";
    var cancelLabel = opts.cancel || "Ακύρωση";

    return new Promise(function (resolve) {
      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmLabel;
      cancelBtn.textContent = cancelLabel;
      okBtn.className = "btn" + (opts.danger === false ? " btn--primary" : " btn--danger");

      function finish(result) {
        overlay.classList.remove("is-open");
        overlay.classList.add("is-closing");
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
        setTimeout(function () {
          overlay.hidden = true;
          overlay.classList.remove("is-closing");
          resolve(result);
        }, 220);
      }

      function onKey(e) {
        if (e.key === "Escape") finish(false);
      }

      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(function () {
        overlay.classList.add("is-open");
      });
      document.addEventListener("keydown", onKey);
      cancelBtn.onclick = function () { finish(false); };
      okBtn.onclick = function () { finish(true); };
      overlay.onclick = function (e) {
        if (e.target === overlay) finish(false);
      };
      cancelBtn.focus();
    });
  }

  /* ---------- views ---------- */

  function showLogin() {
    $("#login-view").hidden = false;
    $("#app-view").hidden = true;
  }

  function showApp() {
    $("#login-view").hidden = true;
    $("#app-view").hidden = false;
    setSection("overview");
  }

  function setSection(name) {
    document.querySelectorAll(".sidebar__nav button").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-section") === name);
    });
    document.querySelectorAll("[data-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-panel") !== name;
    });
    var loaders = {
      overview: loadOverview,
      orders: loadOrders,
      "new-product": function () { fillCategorySelect(); setMode("new"); },
      products: loadProducts,
      coupons: loadCoupons,
      reviews: loadReviews,
      users: loadUsers,
      newsletter: loadNewsletter,
      messages: loadMessages,
      settings: loadSettings,
    };
    if (loaders[name]) loaders[name]();
  }

  /* ---------- overview ---------- */

  function loadOverview() {
    api("/api/admin/overview").then(function (data) {
      if (!data.ok) return;
      var c = data.counts;
      $("#stats-grid").innerHTML = [
        stat(c.newOrders, "Νέες παραγγελίες"),
        stat(c.orders, "Σύνολο παραγγελιών"),
        stat(c.users, "Πελάτες"),
        stat(c.newsletter, "Newsletter"),
        stat(c.unreadMessages, "Αδιάβαστα μηνύματα"),
        stat(c.pendingReviews || 0, "Κριτικές προς έγκριση"),
      ].join("");

      updatePills(c);

      if (!data.recentOrders.length) {
        $("#recent-orders").innerHTML = '<p class="empty">Καμία παραγγελία ακόμη.</p>';
        return;
      }
      $("#recent-orders").innerHTML =
        "<table><thead><tr><th>Αρ.</th><th>Πελάτης</th><th>Προϊόντα</th><th>Πληρωμή</th><th>Κατάσταση</th><th>Ημερομηνία</th></tr></thead><tbody>" +
        data.recentOrders
          .map(function (o) {
            return (
              "<tr><td>" + esc(o.number) + "</td><td>" +
              esc(o.customer.firstname + " " + o.customer.lastname) +
              "</td><td>" + o.items.reduce(function (s, it) { return s + it.qty; }, 0) +
              "</td><td>" + esc(paymentMethodLabel(o)) +
              (o.customer.courier ? " · " + esc(courierLabel(o.customer.courier)) : "") +
              "</td><td>" + statusBadge(o.status) +
              "</td><td>" + fmtDate(o.createdAt) + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    }).catch(function () {});
  }

  function stat(value, label) {
    return (
      '<div class="stat"><div class="stat__value">' + value +
      '</div><div class="stat__label">' + label + "</div></div>"
    );
  }

  function statusBadge(status) {
    return (
      '<span class="status status--' + esc(status) + '">' +
      esc(STATUS_LABELS[status] || status) +
      "</span>"
    );
  }

  function updatePills(counts) {
    var po = $("#pill-orders");
    po.hidden = !counts.newOrders;
    po.textContent = counts.newOrders;
    var pm = $("#pill-messages");
    pm.hidden = !counts.unreadMessages;
    pm.textContent = counts.unreadMessages;
    var pr = $("#pill-reviews");
    if (pr) {
      pr.hidden = !counts.pendingReviews;
      pr.textContent = counts.pendingReviews;
    }
  }

  function refreshPills() {
    api("/api/admin/overview").then(function (data) {
      if (data.ok) updatePills(data.counts);
    }).catch(function () {});
  }

  /* ---------- orders ---------- */

  function loadOrders() {
    var extra = state.ordersFilter ? { status: state.ordersFilter } : {};
    api(pageUrl("/api/admin/orders", state.ordersPage, extra)).then(function (data) {
      if (!data.ok) return;
      state.orders = data.orders;
      state.ordersPagination = data.pagination || null;
      renderOrders();
    }).catch(function () {});
  }

  function renderOrders() {
    var list = state.orders;
    if (!list.length) {
      $("#orders-list").innerHTML = '<p class="empty">Δεν υπάρχουν παραγγελίες.</p>';
      return;
    }
    $("#orders-list").innerHTML = list.map(orderCard).join("") + pagerHtml("orders", state.ordersPagination);
  }

  function courierLabel(key) {
    var id = String(key || "").toLowerCase();
    if (id === "acs") return "ACS";
    if (id === "elta") return "ELTA";
    return "—";
  }

  function paymentMethodLabel(o) {
    if (o.payment === "cod") return "Αντικαταβολή (μετρητά)";
    return "Κάρτα (Stripe)";
  }

  function paymentStatusLabel(o) {
    if (o.payment === "cod") return "Πληρωμή στον courier κατά την παράδοση";
    if (o.paymentStatus === "paid") return "Πληρώθηκε online";
    if (o.paymentStatus === "pending") return "Εκκρεμεί πληρωμή με κάρτα";
    if (o.paymentStatus === "offline") return "Χωρίς online πληρωμή (επιβεβαίωση χειροκίνητα)";
    return o.paymentStatus || "—";
  }

  function orderFeesHtml(o) {
    var itemsSum = (o.items || []).reduce(function (s, it) {
      return s + (it.price != null ? Number(it.price) * it.qty : 0);
    }, 0);
    var discount = Number(o.discount) || 0;
    var shipping = 0;
    var cod = o.payment === "cod" ? 3.5 : 0;
    if (itemsSum > 0 && o.total != null) {
      shipping = Math.max(0, Number(o.total) - itemsSum + discount - cod);
      shipping = Math.round(shipping * 100) / 100;
    }
    var parts = [];
    if (shipping > 0) parts.push("Μεταφορικά: €" + shipping.toFixed(2));
    else if (itemsSum > 0) parts.push("Μεταφορικά: Δωρεάν" + (itemsSum >= 80 ? " (από 80€)" : o.coupon ? " (κουπόνι)" : ""));
    if (cod > 0) parts.push("Αντικαταβολή: €" + cod.toFixed(2));
    return parts.length ? "<p>" + parts.join(" · ") + "</p>" : "";
  }

  function orderCard(o) {
    var open = !!state.expanded[o.id];
    var c = o.customer;
    var giftBits = [];
    if (o.gift && o.gift.isGift) {
      if (o.gift.wrap) giftBits.push("Περιτύλιγμα");
      if (o.gift.message) giftBits.push("Μήνυμα: «" + esc(o.gift.messageText) + "»");
      if (o.gift.box) giftBits.push("Κουτί: " + esc(o.gift.boxType === "wood" ? "ξύλινο" : o.gift.boxType));
      if (o.gift.shipOther) giftBits.push("Αποστολή σε παραλήπτη: " + esc(o.gift.recipient));
      if (!giftBits.length) giftBits.push("Ναι");
    }
    var body = !open ? "" :
      '<div class="order-body">' +
      "<div>" +
      "<h4>Στοιχεία αποστολής</h4>" +
      "<p><strong>Courier:</strong> " + esc(courierLabel(c.courier)) + "</p>" +
      "<p>" + esc(c.firstname + " " + c.lastname) + "<br>" +
      esc(c.street + " " + c.streetNumber + ", " + c.postal + " " + c.city) +
      (c.prefecture ? ", " + esc(c.prefecture) : "") + "<br>" +
      esc(c.country || c.countryCode) +
      (c.floor ? "<br>Όροφος: " + esc(c.floor) : "") +
      (c.locationType ? " · Χώρος: " + esc(c.locationType) : "") +
      "</p>" +
      "<p>Email: " + esc(c.email) + "<br>Κινητό: " + esc(c.mobile) +
      (c.phone ? "<br>Σταθερό: " + esc(c.phone) : "") + "</p>" +
      (c.docType === "invoice"
        ? "<p><strong>Τιμολόγιο</strong><br>" + esc(c.company) + " · ΑΦΜ " + esc(c.afm) + " · ΔΟΥ " + esc(c.doy) +
          (c.activity ? "<br>Δραστηριότητα: " + esc(c.activity) : "") + "</p>"
        : "<p>Παραστατικό: Απόδειξη</p>") +
      (c.notes ? "<p>Σημειώσεις: " + esc(c.notes) + "</p>" : "") +
      "<h4>Πληρωμή</h4>" +
      "<p><strong>Τρόπος:</strong> " + esc(paymentMethodLabel(o)) + "<br>" +
      "<strong>Κατάσταση:</strong> " + esc(paymentStatusLabel(o)) + "</p>" +
      (giftBits.length ? "<p>🎁 Δώρο — " + giftBits.join(" · ") + "</p>" : "") +
      (o.coupon ? "<p>Κουπόνι: <strong>" + esc(o.coupon) + "</strong>" +
        (o.discount ? " (−€" + Number(o.discount).toFixed(2) + ")" : "") + "</p>" : "") +
      (o.total ? "<p>Σύνολο: <strong>€" + Number(o.total).toFixed(2) + "</strong></p>" : "") +
      orderFeesHtml(o) +
      "</div>" +
      "<div>" +
      "<h4>Προϊόντα</h4>" +
      '<ul class="order-items">' +
      o.items
        .map(function (it) {
          return (
            "<li>" +
            (it.image ? '<img src="' + esc(imgSrc(it.image)) + '" alt="" loading="lazy" />' : "") +
            "<span>" + esc(it.title) + " × " + it.qty + "</span></li>"
          );
        })
        .join("") +
      "</ul>" +
      '<div class="order-actions">' +
      '<select data-order-status="' + esc(o.id) + '">' +
      Object.keys(STATUS_LABELS)
        .map(function (s) {
          return '<option value="' + s + '"' + (o.status === s ? " selected" : "") + ">" + STATUS_LABELS[s] + "</option>";
        })
        .join("") +
      "</select>" +
      "</div>" +
      "</div>" +
      "</div>";

    return (
      '<div class="card">' +
      '<div class="order-head" data-order-toggle="' + esc(o.id) + '">' +
      '<span class="order-head__num">' + esc(o.number) + "</span>" +
      '<span class="order-head__name">' + esc(c.firstname + " " + c.lastname) +
      " · " + o.items.reduce(function (s, it) { return s + it.qty; }, 0) + " τεμ." +
      " · " + esc(paymentMethodLabel(o)) +
      (c.courier ? " · " + esc(courierLabel(c.courier)) : "") +
      (o.total ? " · €" + Number(o.total).toFixed(2) : "") +
      paymentBadge(o) + "</span>" +
      statusBadge(o.status) +
      '<span class="order-head__date">' + fmtDate(o.createdAt) + "</span>" +
      "</div>" + body + "</div>"
    );
  }

  function paymentBadge(o) {
    if (o.payment === "cod") return "";
    if (o.paymentStatus === "paid") return ' <span class="paystat paystat--paid">Πληρώθηκε</span>';
    if (o.paymentStatus === "pending") return ' <span class="paystat paystat--pending">Εκκρεμεί πληρωμή</span>';
    return "";
  }

  /* ---------- products ---------- */

  var CATEGORIES = {
    cat1: "Art Class Murano Candle",
    cat2: "Driftwood Beeswax Flame",
    cat3: "Liquid Eternal",
    cat4: "Vintage Unique Objects",
    cat5: "NI Terra",
    cat6: "Perfume",
    cat7: "Diffusers",
    cat8: "Gift Sets",
    cat9: "Nostalgia Exclusive Mirror Candles",
  };

  function fillCategorySelect() {
    var sel = $("#new-product-cat");
    if (!sel || sel.options.length) return;
    sel.innerHTML = Object.keys(CATEGORIES)
      .map(function (id) {
        return '<option value="' + id + '">' + esc(CATEGORIES[id]) + "</option>";
      })
      .join("");
  }

  function fillCategorySelect() {
    var sel = $("#new-product-cat");
    if (!sel || sel.options.length) return;
    sel.innerHTML = Object.keys(CATEGORIES)
      .map(function (id) {
        return '<option value="' + id + '">' + esc(CATEGORIES[id]) + "</option>";
      })
      .join("");
  }

  function detailsFormValues(d) {
    d = d || {};
    var specsToText = function (specs) {
      return (specs || []).map(function (s) { return s.label + ": " + s.value; }).join("\n");
    };
    return {
      variantGroup: d.variantGroup || "",
      variantColor: d.variantColor || "",
      variantColorEn: d.variantColorEn || "",
      variantColorHex: d.variantColorHex || "",
      badges: (d.badges || []).join(", "),
      badgesEn: (d.badgesEn || []).join(", "),
      features: (d.features || []).join("\n"),
      featuresEn: (d.featuresEn || []).join("\n"),
      longDescription: d.longDescription || "",
      longDescriptionEn: d.longDescriptionEn || "",
      specs: specsToText(d.specs),
      specsEn: specsToText(d.specsEn),
      care: Array.isArray(d.care) ? d.care.join("\n\n") : String(d.care || ""),
      careEn: Array.isArray(d.careEn) ? d.careEn.join("\n\n") : String(d.careEn || ""),
      shipping: (d.shipping || []).join("\n"),
      shippingEn: (d.shippingEn || []).join("\n"),
      includes: (d.includes || []).join("\n"),
      includesEn: (d.includesEn || []).join("\n"),
      scentTop: (d.scentNotes && d.scentNotes.top) || "",
      scentHeart: (d.scentNotes && d.scentNotes.heart) || "",
      scentBase: (d.scentNotes && d.scentNotes.base) || "",
      scentTopEn: (d.scentNotesEn && d.scentNotesEn.top) || "",
      scentHeartEn: (d.scentNotesEn && d.scentNotesEn.heart) || "",
      scentBaseEn: (d.scentNotesEn && d.scentNotesEn.base) || "",
      diffuserNotes: (d.diffuser && d.diffuser.notes) || "",
      diffuserDuration: (d.diffuser && d.diffuser.duration) || "",
      diffuserCapacity: (d.diffuser && d.diffuser.capacity) || "",
      diffuserNotesEn: (d.diffuserEn && d.diffuserEn.notes) || "",
      diffuserDurationEn: (d.diffuserEn && d.diffuserEn.duration) || "",
      diffuserCapacityEn: (d.diffuserEn && d.diffuserEn.capacity) || "",
    };
  }

  function langTabsHtml() {
    return (
      '<div class="lang-tabs" role="tablist" aria-label="Γλώσσα περιεχομένου">' +
      '<button type="button" class="lang-tab is-active" data-lang-set="el" aria-selected="true">Ελληνικά</button>' +
      '<button type="button" class="lang-tab" data-lang-set="en" aria-selected="false">English</button>' +
      "</div>"
    );
  }

  function detailsFieldsInner(d, shortDesc) {
    var v = detailsFormValues(d);
    var shortDescEn = (d && d.descriptionEn) || "";
    return (
      '<div data-lang-scope>' +
      langTabsHtml() +
      '<div class="prod-variant-box">' +
      '<p class="prod-variant-box__title">Χρώμα / Παραλλαγή</p>' +
      '<p class="prod-variant-box__hint">Ίδιο προϊόν σε άλλο χρώμα; Βάλε το <strong>ίδιο όνομα ομάδας</strong> σε όλα τα χρώματα και θα συνδεθούν αυτόματα στη σελίδα προϊόντος (καθένα με δική του τιμή).</p>' +
      '<div class="prod-variant-box__grid">' +
      '<label class="field"><span>Ομάδα χρώματος</span><input type="text" data-d="variantGroup" value="' + esc(v.variantGroup) + '" placeholder="π.χ. mirror-classic" /></label>' +
      '<label class="field"><span>Χρώμα (ετικέτα)</span><input type="text" data-d="variantColor" data-lang="el" value="' + esc(v.variantColor) + '" placeholder="Ασημί" /><input type="text" data-d="variantColorEn" data-lang="en" value="' + esc(v.variantColorEn) + '" placeholder="Silver" /></label>' +
      '<label class="field field--color"><span>Χρώμα (swatch)</span><span class="color-input"><input type="color" data-color-sync="variantColorHex" value="' + esc(v.variantColorHex || "#cccccc") + '" /><input type="text" data-d="variantColorHex" value="' + esc(v.variantColorHex) + '" placeholder="#c3c6c9" /></span></label>' +
      "</div></div>" +
      '<div class="prod-details__grid">' +
      '<label class="field"><span>Badges (χωρισμένα με κόμμα)</span><input type="text" data-d="badges" data-lang="el" value="' + esc(v.badges) + '" placeholder="Χειροποίητο, Μοναδικό κομμάτι" /><input type="text" data-d="badgesEn" data-lang="en" value="' + esc(v.badgesEn) + '" placeholder="Handmade, One of a kind" /></label>' +
      '<label class="field field--full"><span>Σύντομη περιγραφή (δίπλα στη φωτογραφία)</span><textarea data-d="shortDescription" data-lang="el" rows="3" maxlength="2000">' + esc(shortDesc || (d && d.description) || "") + '</textarea><textarea data-d="shortDescriptionEn" data-lang="en" rows="3" maxlength="2000" placeholder="Short description (English)">' + esc(shortDescEn) + '</textarea></label>' +
      '<label class="field field--full"><span>Βασικά χαρακτηριστικά (μία γραμμή ανά bullet)</span><textarea data-d="features" data-lang="el" rows="4" placeholder="Φυσικό driftwood&#10;Κερί μέλισσας">' + esc(v.features) + '</textarea><textarea data-d="featuresEn" data-lang="en" rows="4" placeholder="One bullet per line (English)">' + esc(v.featuresEn) + "</textarea></label>" +
      '<label class="field field--full"><span>Πλήρης περιγραφή (accordion)</span><textarea data-d="longDescription" data-lang="el" rows="5">' + esc(v.longDescription) + '</textarea><textarea data-d="longDescriptionEn" data-lang="en" rows="5" placeholder="Full description (English)">' + esc(v.longDescriptionEn) + "</textarea></label>" +
      '<label class="field field--full"><span>Χαρακτηριστικά (μία γραμμή: Ετικέτα: τιμή)</span><textarea data-d="specs" data-lang="el" rows="5" placeholder="Υλικό βάσης: Φυσικό ξύλο">' + esc(v.specs) + '</textarea><textarea data-d="specsEn" data-lang="en" rows="5" placeholder="Base material: Natural wood">' + esc(v.specsEn) + "</textarea></label>" +
      '<label class="field field--full"><span>Φροντίδα / οδηγίες (μία παράγραφος ανά γραμμή)</span><textarea data-d="care" data-lang="el" rows="4">' + esc(v.care) + '</textarea><textarea data-d="careEn" data-lang="en" rows="4" placeholder="Care / instructions (English)">' + esc(v.careEn) + "</textarea></label>" +
      '<label class="field field--full"><span>Αποστολή & επιστροφές (μία γραμμή ανά bullet)</span><textarea data-d="shipping" data-lang="el" rows="3">' + esc(v.shipping) + '</textarea><textarea data-d="shippingEn" data-lang="en" rows="3" placeholder="Shipping & returns (English)">' + esc(v.shippingEn) + "</textarea></label>" +
      '<label class="field field--full"><span>Περιλαμβάνει (Gift Sets — μία γραμμή ανά item)</span><textarea data-d="includes" data-lang="el" rows="3">' + esc(v.includes) + '</textarea><textarea data-d="includesEn" data-lang="en" rows="3" placeholder="Includes (English)">' + esc(v.includesEn) + "</textarea></label>" +
      '<label class="field"><span>Perfume — νότες κορυφής</span><input type="text" data-d="scentTop" data-lang="el" value="' + esc(v.scentTop) + '" /><input type="text" data-d="scentTopEn" data-lang="en" value="' + esc(v.scentTopEn) + '" placeholder="Top notes (English)" /></label>' +
      '<label class="field"><span>Perfume — νότες καρδιάς</span><input type="text" data-d="scentHeart" data-lang="el" value="' + esc(v.scentHeart) + '" /><input type="text" data-d="scentHeartEn" data-lang="en" value="' + esc(v.scentHeartEn) + '" placeholder="Heart notes (English)" /></label>' +
      '<label class="field"><span>Perfume — νότες βάσης</span><input type="text" data-d="scentBase" data-lang="el" value="' + esc(v.scentBase) + '" /><input type="text" data-d="scentBaseEn" data-lang="en" value="' + esc(v.scentBaseEn) + '" placeholder="Base notes (English)" /></label>' +
      '<label class="field"><span>Diffuser — νότες</span><input type="text" data-d="diffuserNotes" data-lang="el" value="' + esc(v.diffuserNotes) + '" /><input type="text" data-d="diffuserNotesEn" data-lang="en" value="' + esc(v.diffuserNotesEn) + '" placeholder="Notes (English)" /></label>' +
      '<label class="field"><span>Diffuser — διάρκεια</span><input type="text" data-d="diffuserDuration" data-lang="el" value="' + esc(v.diffuserDuration) + '" placeholder="Έως 3 μήνες" /><input type="text" data-d="diffuserDurationEn" data-lang="en" value="' + esc(v.diffuserDurationEn) + '" placeholder="Up to 3 months" /></label>' +
      '<label class="field"><span>Diffuser — χωρητικότητα</span><input type="text" data-d="diffuserCapacity" data-lang="el" value="' + esc(v.diffuserCapacity) + '" placeholder="200ml" /><input type="text" data-d="diffuserCapacityEn" data-lang="en" value="' + esc(v.diffuserCapacityEn) + '" placeholder="200ml" /></label>' +
      "</div></div>"
    );
  }

  function readDetailsFromCard(card) {
    function val(name) {
      var el = card.querySelector('[data-d="' + name + '"]');
      return el ? el.value : "";
    }
    return {
      variantGroup: val("variantGroup"),
      variantColor: val("variantColor"),
      variantColorEn: val("variantColorEn"),
      variantColorHex: val("variantColorHex"),
      badges: val("badges"),
      badgesEn: val("badgesEn"),
      features: val("features"),
      featuresEn: val("featuresEn"),
      longDescription: val("longDescription"),
      longDescriptionEn: val("longDescriptionEn"),
      specs: val("specs"),
      specsEn: val("specsEn"),
      care: val("care"),
      careEn: val("careEn"),
      shipping: val("shipping"),
      shippingEn: val("shippingEn"),
      includes: val("includes"),
      includesEn: val("includesEn"),
      scentNotes: { top: val("scentTop"), heart: val("scentHeart"), base: val("scentBase") },
      scentNotesEn: { top: val("scentTopEn"), heart: val("scentHeartEn"), base: val("scentBaseEn") },
      diffuser: {
        notes: val("diffuserNotes"),
        duration: val("diffuserDuration"),
        capacity: val("diffuserCapacity"),
      },
      diffuserEn: {
        notes: val("diffuserNotesEn"),
        duration: val("diffuserDurationEn"),
        capacity: val("diffuserCapacityEn"),
      },
      description: val("shortDescription"),
      descriptionEn: val("shortDescriptionEn"),
    };
  }

  function staticProdCard(p) {
    var code = prodCode(p);
    return (
      '<div class="prod" data-static-id="' + esc(p.id) + '" data-search="' +
      esc((code + " " + (p.category || "") + " Νο " + p.index).toLowerCase()) + '">' +
      (p.image ? '<img src="' + esc(imgSrc(p.image)) + '" alt="" loading="lazy" />' : "") +
      '<div class="prod__name">Νο ' + p.index + "</div>" +
      '<div class="prod__code" title="Κωδικός προϊόντος">' + esc(code) + "</div>" +
      '<div class="prod__inputs">' +
      '<label class="prod__lbl">Τιμή €<input class="prod__price" type="number" min="0" step="0.01" placeholder="—" value="' +
      (p.price != null ? p.price : "") + '" data-price-id="' + esc(p.id) + '" /></label>' +
      '<label class="prod__lbl">Έκπτ. €<input class="prod__sale" type="number" min="0" step="0.01" placeholder="—" value="' +
      (p.salePrice != null ? p.salePrice : "") + '" data-sale-id="' + esc(p.id) + '" /></label>' +
      '<label class="prod__lbl">Μέρες<input class="prod__saledays" type="number" min="1" max="3650" step="1" placeholder="' +
      (p.saleUntil ? "λήγει " + esc(new Date(p.saleUntil).toLocaleDateString("el-GR")) : "—") + '" data-saledays-id="' + esc(p.id) + '" /></label>' +
      '<label class="prod__lbl">Stock<input class="stock-input" type="number" min="0" max="9999" placeholder="∞" value="' +
      (p.stock == null ? "" : p.stock) + '" data-stock-id="' + esc(p.id) + '" /></label>' +
      '<button class="btn btn--small btn--primary" data-static-save="' + esc(p.id) + '">OK</button>' +
      "</div>" +
      '<button class="btn btn--small btn--ghost prod__details-btn" data-open-details="' + esc(p.id) + '">Περιεχόμενο προϊόντος</button>' +
      variantsSectionHtml(p) +
      "</div>"
    );
  }

  function customProdCard(p) {
    var code = prodCode(p);
    return (
      '<div class="card custom-prod' + (p.active === false ? " custom-prod--inactive" : "") + '" data-lang-scope data-custom-id="' + esc(p.id) +
      '" data-search="' + esc((code + " " + (p.title || "") + " " + (p.titleEn || "") + " " + (CATEGORIES[p.catId] || "")).toLowerCase()) + '">' +
      '<div class="custom-prod__code" title="Κωδικός προϊόντος">' + esc(code) + "</div>" +
      langTabsHtml() +
      '<div class="custom-prod__row">' +
      (p.image
        ? '<img class="custom-prod__img" src="' + esc(imgSrc(p.image)) + '" alt="" loading="lazy" />'
        : '<div class="custom-prod__img custom-prod__img--empty">—</div>') +
      '<div class="custom-prod__fields">' +
      '<div class="custom-prod__grid">' +
      '<label class="field"><span>Όνομα</span><input type="text" data-f="title" data-lang="el" value="' + esc(p.title) + '" maxlength="160" /><input type="text" data-f="title_en" data-lang="en" value="' + esc(p.titleEn || "") + '" maxlength="160" placeholder="Product name (English)" /></label>' +
      '<label class="field"><span>Τιμή (€)</span><input type="number" data-f="price" min="0" step="0.01" placeholder="—" value="' +
      (p.price != null ? p.price : "") + '" /></label>' +
      '<label class="field"><span>Τιμή έκπτωσης (€)</span><input type="number" data-f="salePrice" min="0" step="0.01" placeholder="—" value="' +
      (p.salePrice != null ? p.salePrice : "") + '" /></label>' +
      '<label class="field"><span>Διάρκεια έκπτ. (μέρες)</span><input type="number" data-f="saleDays" min="1" max="3650" step="1" placeholder="' +
      (p.saleUntil ? "λήγει " + esc(new Date(p.saleUntil).toLocaleDateString("el-GR")) : "χωρίς λήξη") + '" /></label>' +
      '<label class="field"><span>Stock</span><input type="number" data-f="stock" min="0" max="9999" placeholder="∞" value="' +
      (p.stock == null ? "" : p.stock) + '" /></label>' +
      '<label class="field"><span>Κατηγορία</span><select data-f="catId">' +
      Object.keys(CATEGORIES)
        .map(function (id) {
          return '<option value="' + id + '"' + (p.catId === id ? " selected" : "") + ">" + esc(CATEGORIES[id]) + "</option>";
        })
        .join("") +
      "</select></label>" +
      "</div>" +
      '<label class="field"><span>Περιγραφή (σύντομη)</span><textarea data-f="description" data-lang="el" rows="3" maxlength="4000">' + esc(p.description || "") + '</textarea><textarea data-f="description_en" data-lang="en" rows="3" maxlength="4000" placeholder="Short description (English)">' + esc(p.descriptionEn || "") + "</textarea></label>" +
      '<div class="custom-prod__actions">' +
      '<button class="btn btn--small btn--primary" data-prod-save="' + esc(p.id) + '">Αποθήκευση</button>' +
      '<button class="btn btn--small btn--ghost" data-open-details="' + esc(p.id) + '">Περιεχόμενο προϊόντος</button>' +
      '<label class="btn btn--small btn--ghost custom-prod__upload">Αλλαγή φωτό (έως 3)<input type="file" hidden multiple data-prod-image="' + esc(p.id) + '" accept="image/png,image/jpeg,image/webp,image/gif" /></label>' +
      '<button class="btn btn--small btn--ghost" data-prod-toggle="' + esc(p.id) + '" data-active="' + (p.active === false ? "0" : "1") + '">' +
      (p.active === false ? "Ενεργοποίηση" : "Απόκρυψη από το site") +
      "</button>" +
      '<button class="btn btn--small btn--danger" data-prod-del="' + esc(p.id) + '">Διαγραφή</button>' +
      "</div>" +
      variantsSectionHtml(p) +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  /* ---------- product variants (colours) ---------- */

  function variantRowHtml(v) {
    return (
      '<div class="pvar" data-variant-id="' + esc(v.id) + '">' +
      (v.images && v.images.length
        ? '<img class="pvar__img" src="' + esc(imgSrc(v.images[0])) + '" alt="" loading="lazy" />'
        : '<div class="pvar__img pvar__img--empty">—</div>') +
      '<div class="pvar__grid">' +
      '<label class="field field--color"><span>Swatch</span><span class="color-input"><input type="color" class="pvar__picker" value="' + esc(v.colorHex || "#cccccc") + '" /><input type="text" data-v="colorHex" value="' + esc(v.colorHex || "") + '" placeholder="#b0342c" /></span></label>' +
      '<label class="field"><span>Χρώμα</span><input type="text" data-v="color" value="' + esc(v.color || "") + '" maxlength="80" /></label>' +
      '<label class="field"><span>Colour (EN)</span><input type="text" data-v="colorEn" value="' + esc(v.colorEn || "") + '" maxlength="80" /></label>' +
      '<label class="field"><span>SKU</span><input type="text" data-v="sku" value="' + esc(v.sku || "") + '" maxlength="80" /></label>' +
      '<label class="field"><span>Stock</span><input type="number" data-v="stock" min="0" max="9999" placeholder="∞" value="' + (v.stock == null ? "" : v.stock) + '" /></label>' +
      '<label class="field"><span>Τιμή (€) — αν διαφέρει</span><input type="number" data-v="price" min="0" step="0.01" placeholder="κληρονομεί" value="' + (v.price != null ? v.price : "") + '" /></label>' +
      '<label class="field"><span>Τιμή έκπτ. (€)</span><input type="number" data-v="salePrice" min="0" step="0.01" placeholder="—" value="' + (v.salePrice != null ? v.salePrice : "") + '" /></label>' +
      '<label class="field field--checkbox"><input type="checkbox" data-v="available" ' + (v.available !== false ? "checked" : "") + ' /><span>Διαθέσιμο</span></label>' +
      "</div>" +
      '<div class="pvar__actions">' +
      '<button class="btn btn--small btn--primary" data-variant-save="' + esc(v.id) + '">Αποθήκευση</button>' +
      '<label class="btn btn--small btn--ghost">Φωτό<input type="file" hidden multiple data-variant-image="' + esc(v.id) + '" accept="image/png,image/jpeg,image/webp,image/gif" /></label>' +
      '<button class="btn btn--small btn--danger" data-variant-del="' + esc(v.id) + '" title="Διαγραφή χρώματος">✕</button>' +
      "</div>" +
      "</div>"
    );
  }

  function variantsSectionHtml(p) {
    var vs = Array.isArray(p.variants) ? p.variants : [];
    if (!vs.length) {
      return (
        '<div class="pvars pvars--empty" data-pvars-for="' + esc(p.id) + '">' +
        '<button class="btn btn--small btn--ghost pvars__add" data-variant-add="' + esc(p.id) + '">＋ Προσθήκη χρώματος</button>' +
        "</div>"
      );
    }
    return (
      '<div class="pvars" data-pvars-for="' + esc(p.id) + '">' +
      '<div class="pvars__head">Παραλλαγές / χρώματα <span class="pvars__count">' + vs.length + "</span></div>" +
      vs.map(variantRowHtml).join("") +
      '<button class="btn btn--small btn--ghost pvars__add" data-variant-add="' + esc(p.id) + '">＋ Προσθήκη χρώματος</button>' +
      "</div>"
    );
  }

  function bindVariantColorSync(container) {
    if (!container) return;
    container.querySelectorAll(".pvar").forEach(function (row) {
      var picker = row.querySelector(".pvar__picker");
      var text = row.querySelector('[data-v="colorHex"]');
      if (!picker || !text) return;
      picker.addEventListener("input", function () { text.value = picker.value; });
      text.addEventListener("input", function () {
        if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value;
      });
    });
  }

  function readVariantFromRow(row) {
    function val(name) {
      var el = row.querySelector('[data-v="' + name + '"]');
      return el ? el.value : "";
    }
    var avail = row.querySelector('[data-v="available"]');
    return {
      color: val("color"),
      colorEn: val("colorEn"),
      colorHex: val("colorHex"),
      sku: val("sku"),
      stock: val("stock") === "" ? null : val("stock"),
      price: val("price") === "" ? null : val("price"),
      salePrice: val("salePrice") === "" ? null : val("salePrice"),
      saleDays: undefined,
      available: avail ? !!avail.checked : true,
    };
  }

  var VARIANT_ERRORS = {
    missing_color: "Συμπλήρωσε χρώμα.",
    variant_color_exists: "Υπάρχει ήδη αυτό το χρώμα σε αυτό το προϊόν.",
    invalid_price: "Μη έγκυρη τιμή.",
    invalid_sale_price: "Η τιμή έκπτωσης πρέπει να είναι μικρότερη από την κανονική.",
    invalid_stock: "Μη έγκυρο stock (0–9999).",
    invalid_image: "Πρόβλημα με τη φωτογραφία.",
    not_found: "Το προϊόν δεν βρέθηκε.",
  };

  var allProducts = [];

  /* Searchable string per product (code + name + category). */
  function productHaystack(p) {
    var code = prodCode(p);
    if (p.custom) return (code + " " + (p.title || "") + " " + (CATEGORIES[p.catId] || "")).toLowerCase();
    return (code + " " + (p.category || "") + " νο " + p.index).toLowerCase();
  }

  var CAT_OPEN_KEY = "nostalgia-admin-cat-open";

  function isCatOpen(key, forceOpen) {
    if (forceOpen) return true;
    try {
      var m = JSON.parse(localStorage.getItem(CAT_OPEN_KEY) || "{}");
      return m[key] !== false; // default open
    } catch (e) { return true; }
  }

  function setCatOpen(key, open) {
    try {
      var m = JSON.parse(localStorage.getItem(CAT_OPEN_KEY) || "{}");
      m[key] = open;
      localStorage.setItem(CAT_OPEN_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  function catGroup(title, key, count, forceOpen, inner) {
    return (
      '<details class="prod-cat-group" data-cat-key="' + esc(key) + '"' + (isCatOpen(key, forceOpen) ? " open" : "") + ">" +
      '<summary class="prod-cat"><span class="prod-cat__chev" aria-hidden="true"></span>' +
      '<span class="prod-cat__name">' + esc(title) + "</span>" +
      '<span class="prod-cat__count">' + count + "</span></summary>" +
      inner +
      "</details>"
    );
  }

  function renderProductList(query) {
    var q = String(query || "").trim().toLowerCase();
    var list = q
      ? allProducts.filter(function (p) { return productHaystack(p).indexOf(q) !== -1; })
      : allProducts;
    var forceOpen = !!q;

    var customs = list.filter(function (p) { return p.custom; });
    var statics = list.filter(function (p) { return !p.custom; });

    var html = "";
    if (customs.length) {
      html += catGroup("Δικά σου προϊόντα", "custom", customs.length, forceOpen, customs.map(customProdCard).join(""));
    }
    var byCat = {};
    statics.forEach(function (p) {
      (byCat[p.category] = byCat[p.category] || []).push(p);
    });
    html += Object.keys(byCat)
      .map(function (cat) {
        return catGroup(
          cat, "cat:" + cat, byCat[cat].length, forceOpen,
          '<div class="prod-grid">' + byCat[cat].map(staticProdCard).join("") + "</div>"
        );
      })
      .join("");

    var listEl = $("#products-list");
    listEl.innerHTML = html || '<p class="empty">Κανένα προϊόν δεν ταιριάζει με την αναζήτηση.</p>';
    bindVariantColorSync(listEl);
    listEl.querySelectorAll(".prod-cat-group").forEach(function (d) {
      d.addEventListener("toggle", function () {
        setCatOpen(d.getAttribute("data-cat-key"), d.open);
      });
    });

    var countEl = $("#product-search-count");
    if (countEl) {
      countEl.textContent = q ? list.length + " από " + allProducts.length : allProducts.length + " προϊόντα";
    }
  }

  /* Keep the colour picker and its hex text field in sync inside a container. */
  function bindColorSync(container) {
    if (!container) return;
    container.querySelectorAll("[data-color-sync]").forEach(function (picker) {
      var name = picker.getAttribute("data-color-sync");
      var text = container.querySelector('[data-d="' + name + '"]');
      if (!text) return;
      picker.addEventListener("input", function () {
        text.value = picker.value;
      });
      text.addEventListener("input", function () {
        if (/^#[0-9a-fA-F]{6}$/.test(text.value.trim())) picker.value = text.value.trim();
      });
    });
  }

  function ensureDetailsModal() {
    if (document.getElementById("prod-details-modal")) return;
    var modal = document.createElement("div");
    modal.className = "admin-modal";
    modal.id = "prod-details-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="admin-modal__backdrop" data-details-close></div>' +
      '<div class="admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="prod-details-title">' +
      '<div class="admin-modal__head">' +
      '<h3 class="admin-modal__title" id="prod-details-title">Περιεχόμενο σελίδας προϊόντος</h3>' +
      '<button type="button" class="admin-modal__close" data-details-close aria-label="Κλείσιμο">×</button>' +
      "</div>" +
      '<div class="admin-modal__body" id="prod-details-fields"></div>' +
      '<div class="admin-modal__actions">' +
      '<button type="button" class="btn btn--ghost" data-details-close>Άκυρο</button>' +
      '<button type="button" class="btn btn--primary" id="prod-details-save">Αποθήκευση</button>' +
      "</div></div>";
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-details-close]").forEach(function (el) {
      el.addEventListener("click", closeDetailsModal);
    });
    document.getElementById("prod-details-save").addEventListener("click", saveDetailsModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeDetailsModal();
    });
  }

  function openDetailsModal(id) {
    ensureDetailsModal();
    var p = null;
    for (var i = 0; i < allProducts.length; i++) {
      if (allProducts[i].id === id) { p = allProducts[i]; break; }
    }
    if (!p) return;
    var modal = document.getElementById("prod-details-modal");
    var fields = document.getElementById("prod-details-fields");
    fields.innerHTML = detailsFieldsInner(p.details, p.description);
    bindColorSync(fields);
    document.getElementById("prod-details-title").textContent =
      "Περιεχόμενο — " + (p.custom ? (p.title || prodCode(p)) : ((p.category || "") + " · Νο " + p.index));
    modal.setAttribute("data-product-id", id);
    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
  }

  function closeDetailsModal() {
    var modal = document.getElementById("prod-details-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
  }

  function saveDetailsModal() {
    var modal = document.getElementById("prod-details-modal");
    var id = modal.getAttribute("data-product-id");
    if (!id) return;
    var saveBtn = document.getElementById("prod-details-save");
    saveBtn.disabled = true;
    api("/api/admin/products/" + id, {
      method: "PATCH",
      body: { details: readDetailsFromCard(modal) },
    }).then(function (res) {
      saveBtn.disabled = false;
      if (res.ok) {
        toast("Το περιεχόμενο αποθηκεύτηκε.");
        closeDetailsModal();
        loadProducts();
      } else {
        toast("Σφάλμα: " + errMsg(res.error));
      }
    });
  }

  function loadProducts() {
    fillCategorySelect();
    api("/api/admin/products").then(function (data) {
      if (!data.ok) return;
      allProducts = data.products || [];
      var search = $("#product-search");
      renderProductList(search ? search.value : "");
    }).catch(function () {});
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* Read up to `max` files (FileList) into an array of data URLs. */
  function readFilesAsDataURLs(fileList, max) {
    var files = Array.prototype.slice.call(fileList || [], 0, max || 3);
    return Promise.all(files.map(readFileAsDataURL));
  }

  /* ---------- users / newsletter / messages ---------- */

  function loadUsers() {
    api(pageUrl("/api/admin/users", state.usersPage)).then(function (data) {
      if (!data.ok) return;
      state.usersPagination = data.pagination || null;
      if (!data.users.length) {
        $("#users-list").innerHTML = '<p class="empty">Κανένας εγγεγραμμένος πελάτης.</p>';
        return;
      }
      $("#users-list").innerHTML =
        "<table><thead><tr><th>Ονοματεπώνυμο</th><th>Email</th><th>Γενέθλια</th><th>Newsletter</th><th>Εγγραφή</th></tr></thead><tbody>" +
        data.users
          .map(function (u) {
            return (
              "<tr><td>" + esc(u.firstname + " " + u.lastname) +
              "</td><td>" + esc(u.email) +
              "</td><td>" + esc(u.birthDate || "—") +
              "</td><td>" + (u.newsletterOptin ? "Ναι" : "Όχι") +
              "</td><td>" + fmtDate(u.createdAt) + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>" +
        pagerHtml("users", state.usersPagination);
    }).catch(function () {});
  }

  function loadNewsletter() {
    api(pageUrl("/api/admin/newsletter", state.newsletterPage)).then(function (data) {
      if (!data.ok) return;
      state.newsletterPagination = data.pagination || null;
      if (!data.subscribers.length) {
        $("#newsletter-list").innerHTML = '<p class="empty">Καμία εγγραφή στο newsletter.</p>';
        return;
      }
      $("#newsletter-list").innerHTML =
        "<table><thead><tr><th>Email</th><th>Όνομα</th><th>Πηγή</th><th>Ημερομηνία</th><th></th></tr></thead><tbody>" +
        data.subscribers
          .map(function (n) {
            return (
              "<tr><td>" + esc(n.email) +
              "</td><td>" + esc((n.firstname || "") + " " + (n.lastname || "")) +
              "</td><td>" + (n.source === "register" ? "Λογαριασμός" : "Site") +
              "</td><td>" + fmtDate(n.at) +
              '</td><td><button class="btn btn--small btn--danger" data-nl-del="' + esc(n.email) + '">Διαγραφή</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>" +
        pagerHtml("newsletter", state.newsletterPagination);
    }).catch(function () {});
  }

  function loadMessages() {
    api(pageUrl("/api/admin/messages", state.messagesPage)).then(function (data) {
      if (!data.ok) return;
      state.messagesPagination = data.pagination || null;
      if (!data.messages.length) {
        $("#messages-list").innerHTML = '<p class="empty">Κανένα μήνυμα.</p>';
        return;
      }
      $("#messages-list").innerHTML = data.messages
        .map(function (m) {
          return (
            '<div class="card' + (m.read ? "" : " msg--unread") + '">' +
            '<div class="msg__head">' +
            '<span class="msg__subject">' + esc(m.subject || "(χωρίς θέμα)") + "</span>" +
            '<span class="msg__meta">' +
            esc(m.firstName + " " + m.lastName) + " · " + esc(m.email) +
            (m.phone ? " · " + esc(m.phone) : "") +
            (m.country ? " · " + esc(m.country) : "") +
            " · " + fmtDate(m.at) +
            "</span></div>" +
            '<p class="msg__body">' + esc(m.message) + "</p>" +
            '<div class="msg__actions">' +
            '<button class="btn btn--small btn--ghost" data-msg-read="' + esc(m.id) + '" data-read-state="' + (m.read ? "1" : "0") + '">' +
            (m.read ? "Σήμανση ως αδιάβαστο" : "Σήμανση ως διαβασμένο") +
            "</button>" +
            '<a class="btn btn--small btn--ghost" href="mailto:' + esc(m.email) +
            '?subject=' + encodeURIComponent("Re: " + (m.subject || "Nostalgia")) + '">Απάντηση</a>' +
            '<button class="btn btn--small btn--danger" data-msg-del="' + esc(m.id) + '">Διαγραφή</button>' +
            "</div></div>"
          );
        })
        .join("") +
        pagerHtml("messages", state.messagesPagination);
    }).catch(function () {});
  }

  /* ---------- coupons ---------- */

  function suggestCouponCode(name, value) {
    var base = String(name || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 28);
    if (!base) return "";
    var num = parseFloat(value);
    var suffix = Number.isFinite(num) && num > 0 ? String(Math.round(num)) : "10";
    return (base + suffix).slice(0, 40);
  }

  function bindCouponCodeSuggest() {
    var form = $("#new-coupon-form");
    if (!form || form.dataset.codeSuggestBound) return;
    form.dataset.codeSuggestBound = "1";
    var codeInput = form.querySelector("#coupon-code");
    var nameInput = form.querySelector("#coupon-name");
    var valueInput = form.querySelector("#coupon-value");
    if (!codeInput || !nameInput) return;

    codeInput.addEventListener("input", function () {
      codeInput.dataset.manual = "1";
    });

    function maybeSuggest() {
      if (codeInput.dataset.manual === "1" || codeInput.value.trim()) return;
      var suggested = suggestCouponCode(nameInput.value, valueInput ? valueInput.value : "");
      if (suggested) codeInput.value = suggested;
    }

    nameInput.addEventListener("input", maybeSuggest);
    if (valueInput) valueInput.addEventListener("input", maybeSuggest);
  }

  function loadCoupons() {
    api("/api/admin/coupons").then(function (data) {
      if (!data.ok) return;
      if (!data.coupons.length) {
        $("#coupons-list").innerHTML = '<p class="empty">Κανένα κουπόνι ακόμη.</p>';
        return;
      }
      $("#coupons-list").innerHTML =
        "<table><thead><tr><th>Κωδικός</th><th>Όνομα</th><th>Έκπτωση</th><th>Λήξη</th><th>Χρήσεις</th><th>Κατάσταση</th><th></th></tr></thead><tbody>" +
        data.coupons
          .map(function (c) {
            var discParts = [];
            if (Number(c.value) > 0) {
              discParts.push(c.type === "percent" ? c.value + "%" : "€" + Number(c.value).toFixed(2));
            }
            if (c.freeShipping) discParts.push("δωρ. μεταφορικά");
            var disc = discParts.length ? discParts.join(" + ") : "—";
            var exp = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("el-GR") : "—";
            var expired = c.expiresAt && new Date(c.expiresAt) < new Date(new Date().toDateString());
            var limitHit = c.maxUses != null && c.uses >= c.maxUses;
            var uses = c.maxUses != null ? c.uses + " / " + c.maxUses : String(c.uses);
            if (limitHit) uses += ' <span class="paystat paystat--pending">όριο</span>';
            var status;
            if (!c.active) {
              status = '<span class="status status--cancelled">Ανενεργό</span>';
            } else if (expired || limitHit) {
              status = '<span class="status status--cancelled">Έληξε</span>';
            } else {
              status = '<span class="status status--completed">Ενεργό</span>';
            }
            return (
              "<tr><td><strong>" + esc(c.code) + "</strong></td>" +
              "<td>" + (c.name ? esc(c.name) : "—") + "</td>" +
              "<td>" + disc + "</td>" +
              "<td>" + exp + (expired ? ' <span class="paystat paystat--pending">έληξε</span>' : "") + "</td>" +
              "<td>" + uses + "</td>" +
              "<td>" + status + "</td>" +
              '<td><button class="btn btn--small btn--ghost" data-coupon-toggle="' + esc(c.code) + '" data-active="' + (c.active ? "1" : "0") + '">' +
              (c.active ? "Απενεργοποίηση" : "Ενεργοποίηση") + "</button> " +
              '<button class="btn btn--small btn--danger" data-coupon-del="' + esc(c.code) + '">Διαγραφή</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table>";
    }).catch(function () {});
  }

  /* ---------- reviews moderation ---------- */

  var REVIEW_STATUS = { pending: "Εκκρεμεί", approved: "Εγκεκριμένη", rejected: "Απορρίφθηκε" };

  function loadReviews() {
    api("/api/admin/reviews").then(function (data) {
      if (!data.ok) return;
      if (!data.reviews.length) {
        $("#reviews-list").innerHTML = '<p class="empty">Καμία κριτική ακόμη.</p>';
        return;
      }
      $("#reviews-list").innerHTML = data.reviews.map(reviewCard).join("");
    }).catch(function () {});
  }

  function reviewCard(r) {
    var stars = "";
    for (var i = 0; i < 5; i++) stars += i < r.rating ? "★" : "☆";
    var actions = [];
    if (r.status !== "approved") {
      actions.push('<button class="btn btn--small btn--primary" data-review-approve="' + esc(r.id) + '">Έγκριση</button>');
    }
    if (r.status !== "rejected") {
      actions.push('<button class="btn btn--small btn--ghost" data-review-reject="' + esc(r.id) + '">Απόρριψη</button>');
    }
    actions.push('<button class="btn btn--small btn--danger" data-review-del="' + esc(r.id) + '">Διαγραφή</button>');
    return (
      '<div class="card review' + (r.status === "pending" ? " review--pending" : "") + '">' +
      '<div class="review__head">' +
      '<span class="review__stars">' + stars + "</span>" +
      '<span class="review__name">' + esc(r.name) + "</span>" +
      '<span class="review__product">' + esc(r.productTitle) + "</span>" +
      '<span class="status status--' + (r.status === "approved" ? "completed" : r.status === "rejected" ? "cancelled" : "new") + '">' +
      (REVIEW_STATUS[r.status] || r.status) + "</span>" +
      '<span class="review__date">' + fmtDate(r.createdAt) + "</span>" +
      "</div>" +
      '<p class="review__text">' +
      (r.title ? "<strong>" + esc(r.title) + "</strong><br>" : "") +
      esc(r.text) + "</p>" +
      '<div class="review__actions">' + actions.join(" ") + "</div>" +
      "</div>"
    );
  }

  /* ---------- settings (Stripe) ---------- */

  function loadSettings() {
    api("/api/admin/settings").then(function (data) {
      if (!data.ok) return;
      var status = $("#stripe-status");
      if (!status) return;
      if (data.stripe.configured) {
        status.innerHTML =
          '<span class="paystat paystat--paid">Ενεργό</span> Κλειδί: ' +
          esc(data.stripe.keyHint) +
          (data.stripe.fromEnv ? " (από μεταβλητή περιβάλλοντος)" : "");
      } else {
        status.innerHTML = '<span class="paystat paystat--pending">Δεν έχει ρυθμιστεί</span>';
      }
    }).catch(function () {});
    loadMfaStatus();
  }

  /* ---------- events ---------- */

  var loginCaptcha = null;
  if (window.NostalgiaCaptcha) {
    loginCaptcha = window.NostalgiaCaptcha.mount(document.getElementById("login-captcha"));
  }
  function loginCaptchaToken() {
    return window.NostalgiaCaptcha ? window.NostalgiaCaptcha.getToken(loginCaptcha) : "";
  }

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var errEl = $("#login-error");
    var mfaField = $("#login-mfa-field");
    var trustField = $("#login-trust-field");
    errEl.hidden = true;
    api("/api/admin/login", {
      method: "POST",
      body: {
        username: form.username.value,
        password: form.password.value,
        code: form.code ? form.code.value : "",
        rememberDevice: !!(form.rememberDevice && form.rememberDevice.checked),
        captchaToken: loginCaptchaToken(),
      },
    }).then(function (data) {
      if (data.ok) {
        form.reset();
        mfaField.hidden = true;
        if (trustField) trustField.hidden = true;
        showApp();
      } else if (data.error === "mfa_required") {
        // Password was correct — reveal the 2FA field + trust option.
        mfaField.hidden = false;
        if (trustField) trustField.hidden = false;
        if (form.code) form.code.focus();
        errEl.hidden = false;
        errEl.textContent = "Εισάγετε τον κωδικό επαλήθευσης (2FA).";
      } else if (data.error === "invalid_mfa") {
        mfaField.hidden = false;
        if (trustField) trustField.hidden = false;
        errEl.hidden = false;
        errEl.textContent = "Λάθος κωδικός 2FA.";
      } else {
        if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(loginCaptcha);
        errEl.hidden = false;
        errEl.textContent =
          data.error === "captcha_failed"
            ? "Ολοκληρώστε την επαλήθευση."
            : data.error === "too_many_attempts"
            ? "Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε λίγο."
            : "Λάθος στοιχεία σύνδεσης.";
      }
    }).catch(function () {
      errEl.hidden = false;
      errEl.textContent = "Σφάλμα σύνδεσης με τον server.";
    });
  });

  $("#logout-btn").addEventListener("click", function () {
    api("/api/admin/logout", { method: "POST" }).finally(function () {
      showLogin();
    });
  });

  document.querySelectorAll(".sidebar__nav button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSection(btn.getAttribute("data-section"));
    });
  });

  /* "+ Νέο προϊόν" shortcut buttons that jump to another section. */
  document.addEventListener("click", function (e) {
    var goto = e.target.closest("[data-goto-section]");
    if (goto) {
      e.preventDefault();
      setSection(goto.getAttribute("data-goto-section"));
    }
  });

  /* Language tabs (Ελληνικά / English): toggle .is-en on the nearest scope so
     the EL/EN input pairs swap in place. Works for the new-product form and
     every edit card / details modal. */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-lang-set]");
    if (!tab) return;
    e.preventDefault();
    var scope = tab.closest("[data-lang-scope]");
    if (!scope) return;
    var lang = tab.getAttribute("data-lang-set");
    scope.classList.toggle("is-en", lang === "en");
    scope.querySelectorAll("[data-lang-set]").forEach(function (b) {
      var on = b.getAttribute("data-lang-set") === lang;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  });

  $("#orders-filter").addEventListener("change", function (e) {
    state.ordersFilter = e.target.value;
    state.ordersPage = 1;
    loadOrders();
  });

  document.addEventListener("click", function (e) {
    var prevPage = e.target.closest("[data-page-prev]");
    var nextPage = e.target.closest("[data-page-next]");
    if (prevPage || nextPage) {
      var kind = (prevPage || nextPage).getAttribute(prevPage ? "data-page-prev" : "data-page-next");
      var delta = prevPage ? -1 : 1;
      if (kind === "orders") {
        state.ordersPage = Math.max(1, state.ordersPage + delta);
        loadOrders();
      } else if (kind === "users") {
        state.usersPage = Math.max(1, state.usersPage + delta);
        loadUsers();
      } else if (kind === "newsletter") {
        state.newsletterPage = Math.max(1, state.newsletterPage + delta);
        loadNewsletter();
      } else if (kind === "messages") {
        state.messagesPage = Math.max(1, state.messagesPage + delta);
        loadMessages();
      }
      return;
    }

    var toggle = e.target.closest("[data-order-toggle]");
    if (toggle && !e.target.closest("select")) {
      var id = toggle.getAttribute("data-order-toggle");
      state.expanded[id] = !state.expanded[id];
      renderOrders();
      return;
    }
    var readBtn = e.target.closest("[data-msg-read]");
    if (readBtn) {
      api("/api/admin/messages/" + readBtn.getAttribute("data-msg-read"), {
        method: "PATCH",
        body: { read: readBtn.getAttribute("data-read-state") !== "1" },
      }).then(loadMessages);
      return;
    }
    var delMsg = e.target.closest("[data-msg-del]");
    if (delMsg) {
      confirmDialog("Θέλεις να διαγράψεις οριστικά αυτό το μήνυμα;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/messages/" + delMsg.getAttribute("data-msg-del"), {
          method: "DELETE",
        }).then(loadMessages);
      });
      return;
    }
    var delNl = e.target.closest("[data-nl-del]");
    if (delNl) {
      confirmDialog("Θέλεις να διαγράψεις αυτόν τον συνδρομητή;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/newsletter/" + encodeURIComponent(delNl.getAttribute("data-nl-del")), {
          method: "DELETE",
        }).then(loadNewsletter);
      });
      return;
    }
    var saveProd = e.target.closest("[data-prod-save]");
    if (saveProd) {
      var card = saveProd.closest("[data-custom-id]");
      var pid = saveProd.getAttribute("data-prod-save");
      var get = function (f) {
        var el = card.querySelector('[data-f="' + f + '"]');
        return el ? el.value : undefined;
      };
      var body = {
        title: get("title"),
        titleEn: get("title_en"),
        price: get("price") === "" ? null : get("price"),
        salePrice: get("salePrice") === "" ? null : get("salePrice"),
        saleDays: get("saleDays") === "" ? undefined : get("saleDays"),
        stock: get("stock") === "" ? null : get("stock"),
        catId: get("catId"),
        description: get("description"),
        descriptionEn: get("description_en"),
      };
      /* Only send details when the card actually renders detail fields, so a
         basic edit (price/stock/name) never wipes content set via the drawer. */
      if (card.querySelector("[data-d]")) {
        body.details = readDetailsFromCard(card);
      }
      api("/api/admin/products/" + pid, {
        method: "PATCH",
        body: body,
      }).then(function (res) {
        if (res.ok) {
          toast("Το προϊόν αποθηκεύτηκε.");
          loadProducts();
        } else {
          toast("Σφάλμα: " + errMsg(res.error));
        }
      });
      return;
    }
    var toggleProd = e.target.closest("[data-prod-toggle]");
    if (toggleProd) {
      api("/api/admin/products/" + toggleProd.getAttribute("data-prod-toggle"), {
        method: "PATCH",
        body: { active: toggleProd.getAttribute("data-active") !== "1" },
      }).then(function (res) {
        if (res.ok) loadProducts();
      });
      return;
    }
    var delProd = e.target.closest("[data-prod-del]");
    if (delProd) {
      confirmDialog("Θέλεις να διαγράψεις οριστικά αυτό το προϊόν;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/products/" + delProd.getAttribute("data-prod-del"), {
          method: "DELETE",
        }).then(function (res) {
          if (res.ok) {
            toast("Το προϊόν διαγράφηκε.");
            loadProducts();
          }
        });
      });
      return;
    }
    var staticSave = e.target.closest("[data-static-save]");
    if (staticSave) {
      var sc = staticSave.closest("[data-static-id]");
      var sid = staticSave.getAttribute("data-static-save");
      var priceEl = sc.querySelector("[data-price-id]");
      var saleEl = sc.querySelector("[data-sale-id]");
      var saleDaysEl = sc.querySelector("[data-saledays-id]");
      var stockEl = sc.querySelector("[data-stock-id]");
      api("/api/admin/products/" + sid, {
        method: "PATCH",
        body: {
          price: priceEl.value === "" ? null : priceEl.value,
          salePrice: saleEl.value === "" ? null : saleEl.value,
          saleDays: saleDaysEl.value === "" ? undefined : saleDaysEl.value,
          stock: stockEl.value === "" ? null : stockEl.value,
        },
      }).then(function (res) {
        if (res.ok) {
          toast("Αποθηκεύτηκε.");
          staticSave.classList.add("is-saved");
          setTimeout(function () { staticSave.classList.remove("is-saved"); }, 1000);
        } else {
          toast("Σφάλμα: " + errMsg(res.error));
        }
      });
      return;
    }
    var openDetails = e.target.closest("[data-open-details]");
    if (openDetails) {
      openDetailsModal(openDetails.getAttribute("data-open-details"));
      return;
    }
    var variantAdd = e.target.closest("[data-variant-add]");
    if (variantAdd) {
      setSection("new-product");
      setMode("variant", variantAdd.getAttribute("data-variant-add"));
      return;
    }
    var variantSave = e.target.closest("[data-variant-save]");
    if (variantSave) {
      var vrow = variantSave.closest("[data-variant-id]");
      var vid = variantSave.getAttribute("data-variant-save");
      var body = readVariantFromRow(vrow);
      body.saleDays = undefined;
      variantSave.disabled = true;
      api("/api/admin/variants/" + encodeURIComponent(vid), { method: "PATCH", body: body })
        .then(function (res) {
          variantSave.disabled = false;
          if (res.ok) { toast("Η παραλλαγή αποθηκεύτηκε."); loadProducts(); }
          else { toast(VARIANT_ERRORS[res.error] || ("Σφάλμα: " + errMsg(res.error))); }
        }).catch(function () { variantSave.disabled = false; toast("Σφάλμα επικοινωνίας."); });
      return;
    }
    var variantDel = e.target.closest("[data-variant-del]");
    if (variantDel) {
      confirmDialog("Θέλεις να διαγράψεις αυτό το χρώμα;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/variants/" + encodeURIComponent(variantDel.getAttribute("data-variant-del")), {
          method: "DELETE",
        }).then(function (res) {
          if (res.ok) { toast("Το χρώμα διαγράφηκε."); loadProducts(); }
          else { toast("Σφάλμα: " + errMsg(res.error)); }
        });
      });
      return;
    }
    var couponToggle = e.target.closest("[data-coupon-toggle]");
    if (couponToggle) {
      api("/api/admin/coupons/" + encodeURIComponent(couponToggle.getAttribute("data-coupon-toggle")), {
        method: "PATCH",
        body: { active: couponToggle.getAttribute("data-active") !== "1" },
      }).then(function (res) {
        if (res.ok) loadCoupons();
      });
      return;
    }
    var couponDel = e.target.closest("[data-coupon-del]");
    if (couponDel) {
      confirmDialog("Θέλεις να διαγράψεις αυτό το κουπόνι;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/coupons/" + encodeURIComponent(couponDel.getAttribute("data-coupon-del")), {
          method: "DELETE",
        }).then(function (res) {
          if (res.ok) {
            toast("Το κουπόνι διαγράφηκε.");
            loadCoupons();
          }
        });
      });
      return;
    }
    var revApprove = e.target.closest("[data-review-approve]");
    if (revApprove) {
      api("/api/admin/reviews/" + revApprove.getAttribute("data-review-approve"), {
        method: "PATCH",
        body: { status: "approved" },
      }).then(function (res) {
        if (res.ok) {
          toast("Η κριτική εγκρίθηκε και εμφανίζεται στο site.");
          loadReviews();
          refreshPills();
        }
      });
      return;
    }
    var revReject = e.target.closest("[data-review-reject]");
    if (revReject) {
      api("/api/admin/reviews/" + revReject.getAttribute("data-review-reject"), {
        method: "PATCH",
        body: { status: "rejected" },
      }).then(function (res) {
        if (res.ok) {
          toast("Η κριτική απορρίφθηκε.");
          loadReviews();
          refreshPills();
        }
      });
      return;
    }
    var revDel = e.target.closest("[data-review-del]");
    if (revDel) {
      confirmDialog("Θέλεις να διαγράψεις οριστικά αυτή την κριτική;").then(function (ok) {
        if (!ok) return;
        api("/api/admin/reviews/" + revDel.getAttribute("data-review-del"), {
          method: "DELETE",
        }).then(function (res) {
          if (res.ok) {
            toast("Η κριτική διαγράφηκε.");
            loadReviews();
            refreshPills();
          }
        });
      });
    }
  });

  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-order-status]");
    if (sel) {
      var id = sel.getAttribute("data-order-status");
      api("/api/admin/orders/" + id, {
        method: "PATCH",
        body: { status: sel.value },
      }).then(function (data) {
        if (data.ok) {
          var order = state.orders.find(function (o) { return o.id === id; });
          if (order) order.status = data.order.status;
          renderOrders();
          toast("Η παραγγελία ενημερώθηκε.");
        }
      });
      return;
    }
    var stockInput = e.target.closest("[data-stock-id]");
    if (stockInput) {
      var pid = stockInput.getAttribute("data-stock-id");
      api("/api/admin/products/" + pid, {
        method: "PATCH",
        body: { stock: stockInput.value === "" ? null : stockInput.value },
      }).then(function (data) {
        if (data.ok) {
          stockInput.classList.add("is-saved");
          setTimeout(function () {
            stockInput.classList.remove("is-saved");
          }, 1200);
          var small = stockInput.parentElement.querySelector("small");
          if (small) small.textContent = data.stock == null ? "Απεριόριστο" : "Stock: " + data.stock;
        } else {
          toast("Μη έγκυρη τιμή stock.");
        }
      });
    }
  });

  /* image replacement on an existing custom product */
  document.addEventListener("change", function (e) {
    var fileInput = e.target.closest("[data-prod-image]");
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    readFilesAsDataURLs(fileInput.files, 3).then(function (imagesData) {
      api("/api/admin/products/" + fileInput.getAttribute("data-prod-image"), {
        method: "PATCH",
        body: { imagesData: imagesData },
      }).then(function (res) {
        if (res.ok) {
          toast(imagesData.length > 1 ? "Οι φωτογραφίες ενημερώθηκαν." : "Η φωτογραφία ενημερώθηκε.");
          loadProducts();
        } else {
          toast("Μη έγκυρη εικόνα.");
        }
      });
    });
  });

  /* photos for a colour variant */
  document.addEventListener("change", function (e) {
    var vImg = e.target.closest("[data-variant-image]");
    if (!vImg || !vImg.files || !vImg.files[0]) return;
    readFilesAsDataURLs(vImg.files, 3).then(function (imagesData) {
      api("/api/admin/variants/" + encodeURIComponent(vImg.getAttribute("data-variant-image")), {
        method: "PATCH",
        body: { imagesData: imagesData },
      }).then(function (res) {
        if (res.ok) {
          toast(imagesData.length > 1 ? "Οι φωτογραφίες ενημερώθηκαν." : "Η φωτογραφία ενημερώθηκε.");
          loadProducts();
        } else {
          toast(VARIANT_ERRORS[res.error] || "Μη έγκυρη εικόνα.");
        }
      });
    });
  });

  (function bindProductSearch() {
    var search = $("#product-search");
    if (!search) return;
    search.addEventListener("input", function () {
      renderProductList(search.value);
    });
  })();

  bindColorSync($("#new-product-form"));

  $("#new-product-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $("#new-product-msg");
    msg.hidden = true;
    if (!form.title.value.trim()) {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Συμπληρώστε όνομα προϊόντος.";
      return;
    }
    var files = form.image.files;
    var imagePromise = files && files.length
      ? readFilesAsDataURLs(files, 3)
      : Promise.resolve([]);
    imagePromise.then(function (imagesData) {
      var fv = function (name) { return form[name] ? form[name].value : ""; };
      var details = {
        variantGroup: fv("details_variantGroup"),
        variantColor: fv("details_variantColor"),
        variantColorEn: fv("details_variantColorEn"),
        variantColorHex: fv("details_variantColorHex"),
        badges: fv("details_badges"),
        badgesEn: fv("details_badgesEn"),
        features: fv("details_features"),
        featuresEn: fv("details_featuresEn"),
        longDescription: fv("details_longDescription"),
        longDescriptionEn: fv("details_longDescriptionEn"),
        specs: fv("details_specs"),
        specsEn: fv("details_specsEn"),
        care: fv("details_care"),
        careEn: fv("details_careEn"),
        shipping: fv("details_shipping"),
        shippingEn: fv("details_shippingEn"),
        includes: fv("details_includes"),
        includesEn: fv("details_includesEn"),
        scentNotes: {
          top: fv("details_scentTop"),
          heart: fv("details_scentHeart"),
          base: fv("details_scentBase"),
        },
        scentNotesEn: {
          top: fv("details_scentTopEn"),
          heart: fv("details_scentHeartEn"),
          base: fv("details_scentBaseEn"),
        },
        diffuser: {
          notes: fv("details_diffuserNotes"),
          duration: fv("details_diffuserDuration"),
          capacity: fv("details_diffuserCapacity"),
        },
        diffuserEn: {
          notes: fv("details_diffuserNotesEn"),
          duration: fv("details_diffuserDurationEn"),
          capacity: fv("details_diffuserCapacityEn"),
        },
      };
      return api("/api/admin/products", {
        method: "POST",
        body: {
          catId: form.catId.value,
          title: form.title.value,
          titleEn: fv("title_en"),
          price: form.price.value === "" ? null : form.price.value,
          salePrice: form.salePrice.value === "" ? null : form.salePrice.value,
          saleDays: form.saleDays.value === "" ? null : form.saleDays.value,
          stock: form.stock.value === "" ? null : form.stock.value,
          description: form.description.value,
          descriptionEn: fv("description_en"),
          imagesData: imagesData,
          details: details,
        },
      });
    }).then(function (res) {
      msg.hidden = false;
      if (res.ok) {
        msg.className = "form-msg ok";
        msg.textContent = "Το προϊόν δημιουργήθηκε και είναι ορατό στο site.";
        form.reset();
        form.classList.remove("is-en");
        form.querySelectorAll("[data-lang-set]").forEach(function (b) {
          var on = b.getAttribute("data-lang-set") === "el";
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        loadProducts();
      } else {
        msg.className = "form-msg err";
        msg.textContent = "Σφάλμα: " + errMsg(res.error);
      }
    }).catch(function () {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Σφάλμα επικοινωνίας με τον server.";
    });
  });

  /* ---------- new-product page: mode toggle (new / add variant) ---------- */

  function setMode(mode, presetProductId) {
    document.querySelectorAll("[data-mode-set]").forEach(function (b) {
      var on = b.getAttribute("data-mode-set") === mode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-mode-pane]").forEach(function (p) {
      p.hidden = p.getAttribute("data-mode-pane") !== mode;
    });
    if (mode === "variant" && presetProductId) selectVariantBase(presetProductId);
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-mode-set]");
    if (tab) {
      e.preventDefault();
      setMode(tab.getAttribute("data-mode-set"));
    }
  });

  function baseDisplayName(p) {
    if (!p) return "";
    return p.custom ? (p.title || prodCode(p)) : ((p.category || "") + " · Νο " + p.index);
  }

  function selectVariantBase(id) {
    var p = null;
    for (var i = 0; i < allProducts.length; i++) {
      if (allProducts[i].id === id) { p = allProducts[i]; break; }
    }
    if (!p) return;
    var hid = $("#variant-product-id");
    var chosen = $("#variant-product-chosen");
    var results = $("#variant-product-results");
    var search = $("#variant-product-search");
    hid.value = p.id;
    chosen.innerHTML =
      "Επιλέχθηκε: <strong>" + esc(baseDisplayName(p)) + "</strong> · " + esc(prodCode(p)) +
      ' <button type="button" class="btn btn--small btn--ghost" data-variant-clear>Αλλαγή</button>';
    chosen.hidden = false;
    if (results) results.hidden = true;
    if (search) { search.value = ""; search.hidden = true; }
  }

  function clearVariantBase() {
    $("#variant-product-id").value = "";
    $("#variant-product-chosen").hidden = true;
    var search = $("#variant-product-search");
    if (search) { search.hidden = false; search.value = ""; search.focus(); }
  }

  /* live product search inside the variant form */
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "variant-product-search") {
      var q = e.target.value.trim().toLowerCase();
      var box = $("#variant-product-results");
      if (!q) { box.hidden = true; box.innerHTML = ""; return; }
      var matches = allProducts.filter(function (p) {
        return productHaystack(p).indexOf(q) !== -1;
      }).slice(0, 12);
      box.innerHTML = matches.length
        ? matches.map(function (p) {
            return '<button type="button" class="variant-search__item" data-variant-pick="' + esc(p.id) + '">' +
              (p.image ? '<img src="' + esc(imgSrc(p.image)) + '" alt="" />' : "") +
              "<span>" + esc(baseDisplayName(p)) + ' <em>' + esc(prodCode(p)) + "</em></span></button>";
          }).join("")
        : '<p class="variant-search__none">Κανένα προϊόν.</p>';
      box.hidden = false;
    }
  });

  document.addEventListener("click", function (e) {
    var pick = e.target.closest("[data-variant-pick]");
    if (pick) { e.preventDefault(); selectVariantBase(pick.getAttribute("data-variant-pick")); return; }
    var clr = e.target.closest("[data-variant-clear]");
    if (clr) { e.preventDefault(); clearVariantBase(); return; }
  });

  /* colour picker sync inside the variant form */
  (function () {
    var picker = $("#variant-color-picker");
    var hex = $("#variant-color-hex");
    if (picker && hex) {
      picker.addEventListener("input", function () { hex.value = picker.value; });
      hex.addEventListener("input", function () {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
      });
    }
  })();

  $("#new-variant-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $("#new-variant-msg");
    msg.hidden = true;
    var baseId = $("#variant-product-id").value;
    if (!baseId) {
      msg.hidden = false; msg.className = "form-msg err";
      msg.textContent = "Διάλεξε πρώτα ένα προϊόν."; return;
    }
    if (!form.color.value.trim()) {
      msg.hidden = false; msg.className = "form-msg err";
      msg.textContent = "Συμπλήρωσε χρώμα."; return;
    }
    var files = form.image.files;
    var imgPromise = files && files.length ? readFilesAsDataURLs(files, 3) : Promise.resolve([]);
    imgPromise.then(function (imagesData) {
      return api("/api/admin/products/" + encodeURIComponent(baseId) + "/variants", {
        method: "POST",
        body: {
          color: form.color.value,
          colorEn: form.colorEn.value,
          colorHex: form.colorHex.value,
          sku: form.sku.value,
          stock: form.stock.value === "" ? null : form.stock.value,
          price: form.price.value === "" ? null : form.price.value,
          salePrice: form.salePrice.value === "" ? null : form.salePrice.value,
          saleDays: form.saleDays.value === "" ? null : form.saleDays.value,
          available: !!(form.available && form.available.checked),
          imagesData: imagesData,
        },
      });
    }).then(function (res) {
      msg.hidden = false;
      if (res.ok) {
        msg.className = "form-msg ok";
        msg.textContent = "Η παραλλαγή προστέθηκε.";
        form.reset();
        clearVariantBase();
        loadProducts();
      } else {
        msg.className = "form-msg err";
        msg.textContent = VARIANT_ERRORS[res.error] || ("Σφάλμα: " + errMsg(res.error));
      }
    }).catch(function () {
      msg.hidden = false; msg.className = "form-msg err";
      msg.textContent = "Σφάλμα επικοινωνίας με τον server.";
    });
  });

  $("#new-coupon-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $("#new-coupon-msg");
    msg.hidden = true;
    api("/api/admin/coupons", {
      method: "POST",
      body: {
        name: form.name.value,
        code: form.code.value,
        type: form.type.value,
        value: form.value.value,
        freeShipping: !!(form.freeShipping && form.freeShipping.checked),
        maxUses: form.maxUses.value || null,
        durationDays: form.durationDays.value || null,
        expiresAt: form.expiresAt.value || null,
      },
    }).then(function (res) {
      msg.hidden = false;
      if (res.ok) {
        msg.className = "form-msg ok";
        msg.textContent = "Το κουπόνι δημιουργήθηκε και στάλθηκε με email στους πελάτες.";
        form.reset();
        delete form.querySelector("#coupon-code").dataset.manual;
        loadCoupons();
      } else {
        var errors = {
          invalid_code: "Μη έγκυρος κωδικός (2–40 χαρακτήρες: A-Z, 0-9, - _).",
          invalid_value: "Βάλε έκπτωση ή τσέκαρε «Δωρεάν μεταφορικά» (ή και τα δύο).",
          invalid_duration: "Μη έγκυρη διάρκεια (1–3650 μέρες).",
          invalid_max_uses: "Μη έγκυρο όριο χρήσεων (1–1.000.000).",
          exists: "Υπάρχει ήδη κουπόνι με αυτόν τον κωδικό.",
        };
        msg.className = "form-msg err";
        msg.textContent = errors[res.error] || "Σφάλμα δημιουργίας.";
      }
    }).catch(function () {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Σφάλμα επικοινωνίας με τον server.";
    });
  });

  $("#stripe-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $("#stripe-msg");
    msg.hidden = true;
    api("/api/admin/settings/stripe", {
      method: "POST",
      body: { secretKey: form.secretKey.value.trim() },
    }).then(function (res) {
      msg.hidden = false;
      if (res.ok) {
        msg.className = "form-msg ok";
        msg.textContent = res.configured
          ? "Το κλειδί Stripe αποθηκεύτηκε. Οι πληρωμές με κάρτα είναι ενεργές."
          : "Το κλειδί Stripe αφαιρέθηκε.";
        form.reset();
        loadSettings();
      } else {
        msg.className = "form-msg err";
        msg.textContent =
          res.error === "invalid_key"
            ? "Μη έγκυρο κλειδί. Πρέπει να αρχίζει με sk_live_ ή sk_test_."
            : "Σφάλμα αποθήκευσης.";
      }
    }).catch(function () {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Σφάλμα επικοινωνίας με τον server.";
    });
  });

  $("#password-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $("#password-msg");
    msg.hidden = true;
    if (form.next.value !== form.confirm.value) {
      msg.hidden = false;
      msg.className = "form-msg err";
      msg.textContent = "Οι νέοι κωδικοί δεν ταιριάζουν.";
      return;
    }
    api("/api/admin/password", {
      method: "POST",
      body: { current: form.current.value, next: form.next.value },
    }).then(function (data) {
      msg.hidden = false;
      if (data.ok) {
        msg.className = "form-msg ok";
        msg.textContent = "Ο κωδικός άλλαξε.";
        form.reset();
      } else {
        msg.className = "form-msg err";
        msg.textContent = pwErrMsg(data.error) || "Λάθος τρέχων κωδικός.";
      }
    });
  });

  /* ---------- MFA (2FA) ---------- */

  function pwErrMsg(code) {
    var map = {
      password_too_short: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
      password_too_long: "Ο κωδικός είναι πολύ μεγάλος.",
      password_needs_lowercase: "Ο κωδικός πρέπει να περιέχει πεζό γράμμα.",
      password_needs_uppercase: "Ο κωδικός πρέπει να περιέχει κεφαλαίο γράμμα.",
      password_needs_digit: "Ο κωδικός πρέπει να περιέχει αριθμό.",
    };
    return map[code] || null;
  }

  function mfaMsg(text, ok) {
    var el = $("#mfa-msg");
    if (!el) return;
    el.hidden = false;
    el.className = "form-msg " + (ok ? "ok" : "err");
    el.textContent = text;
  }

  function loadMfaStatus() {
    api("/api/admin/mfa/status").then(function (data) {
      if (!data.ok) return;
      var enabled = !!data.enabled;
      var status = $("#mfa-status");
      if (status) {
        status.innerHTML = enabled
          ? '<span class="paystat paystat--paid">Ενεργό</span>'
          : '<span class="paystat paystat--pending">Ανενεργό</span>';
      }
      $("#mfa-enabled-view").hidden = !enabled;
      $("#mfa-disabled-view").hidden = enabled;
      $("#mfa-setup-box").hidden = true;
      var msg = $("#mfa-msg");
      if (msg) msg.hidden = true;
    }).catch(function () {});
  }

  var mfaSetupBtn = $("#mfa-setup-btn");
  if (mfaSetupBtn) {
    mfaSetupBtn.addEventListener("click", function () {
      api("/api/admin/mfa/setup", { method: "POST" }).then(function (data) {
        if (!data.ok) { mfaMsg("Αποτυχία εκκίνησης 2FA.", false); return; }
        $("#mfa-secret").textContent = data.secret;
        // No external QR service (CSP): show the otpauth URI for apps that
        // accept a pasted link, plus the manual secret above.
        $("#mfa-qr").textContent = data.otpauth;
        $("#mfa-setup-box").hidden = false;
        $("#mfa-enable-code").focus();
      });
    });
  }

  var mfaEnableBtn = $("#mfa-enable-btn");
  if (mfaEnableBtn) {
    mfaEnableBtn.addEventListener("click", function () {
      var code = $("#mfa-enable-code").value.trim();
      api("/api/admin/mfa/enable", { method: "POST", body: { code: code } }).then(function (data) {
        if (data.ok) {
          mfaMsg("Το 2FA ενεργοποιήθηκε.", true);
          loadMfaStatus();
        } else {
          mfaMsg("Λάθος κωδικός επαλήθευσης. Δοκιμάστε ξανά.", false);
        }
      });
    });
  }

  var mfaDisableBtn = $("#mfa-disable-btn");
  if (mfaDisableBtn) {
    mfaDisableBtn.addEventListener("click", function () {
      var pass = $("#mfa-disable-pass").value;
      var code = $("#mfa-disable-code").value.trim();
      api("/api/admin/mfa/disable", { method: "POST", body: { password: pass, code: code } }).then(function (data) {
        if (data.ok) {
          $("#mfa-disable-pass").value = "";
          $("#mfa-disable-code").value = "";
          mfaMsg("Το 2FA απενεργοποιήθηκε.", true);
          loadMfaStatus();
        } else {
          mfaMsg(
            data.error === "invalid_credentials" ? "Λάθος κωδικός λογαριασμού." : "Λάθος κωδικός 2FA.",
            false
          );
        }
      });
    });
  }

  /* ---------- boot ---------- */

  bindCouponCodeSuggest();

  api("/api/admin/me").then(function (data) {
    if (data.ok && data.admin) {
      showApp();
    } else {
      showLogin();
    }
  }).catch(showLogin);
})();
