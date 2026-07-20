(function () {
  /* Public guest order tracking. Reads a capability token from the URL,
     fetches the safe order view, and renders status + a progress stepper.
     Self-contained (own label maps) so it needs no i18n bundles. */

  var lang = "el";
  try { lang = localStorage.getItem("nostalgia-lang") === "en" ? "en" : "el"; } catch (e) {}
  document.documentElement.lang = lang;
  var EN = lang === "en";

  var L = {
    title: EN ? "Track your order" : "Παρακολούθηση παραγγελίας",
    intro: EN ? "Here is the latest status of your order." : "Δες την τελευταία κατάσταση της παραγγελίας σου.",
    number: EN ? "Order number" : "Αριθμός παραγγελίας",
    date: EN ? "Date" : "Ημερομηνία",
    payment: EN ? "Payment" : "Πληρωμή",
    shipping: EN ? "Shipping" : "Αποστολή",
    tracking: EN ? "Tracking" : "Tracking",
    courier: EN ? "Courier" : "Courier",
    products: EN ? "Products" : "Προϊόντα",
    total: EN ? "Total" : "Σύνολο",
    notFound: EN ? "We couldn't find this order. The link may be invalid or expired." : "Δεν βρέθηκε η παραγγελία. Ο σύνδεσμος ίσως είναι λανθασμένος ή έληξε.",
    noToken: EN ? "Missing tracking link." : "Λείπει ο σύνδεσμος παρακολούθησης.",
    help: EN ? "Need help?" : "Χρειάζεστε βοήθεια;",
    contact: EN ? "Contact us" : "Επικοινωνία",
    cancelled: EN ? "This order has been cancelled." : "Αυτή η παραγγελία έχει ακυρωθεί.",
    steps: EN
      ? ["Order placed", "Processing", "Shipping", "Delivery"]
      : ["Παραγγελία ολοκληρώθηκε", "Επεξεργασία", "Αποστολή", "Παράδοση"],
  };

  var PAY_METHOD = { cod: EN ? "Cash on delivery" : "Αντικαταβολή", card: EN ? "Card" : "Κάρτα" };
  var PAY_STATUS = EN
    ? { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded", partial_refund: "Partial refund", offline: "Offline", cod_pending: "Not collected", cod_collected: "Collected", cod_not_delivered: "Not delivered", cod_awaiting_remittance: "Awaiting remittance", cod: "Not collected" }
    : { pending: "Εκκρεμεί", paid: "Πληρώθηκε", failed: "Απέτυχε", refunded: "Επιστροφή χρημάτων", partial_refund: "Μερική επιστροφή", offline: "Offline", cod_pending: "Δεν εισπράχθηκε", cod_collected: "Εισπράχθηκε", cod_not_delivered: "Δεν παραδόθηκε", cod_awaiting_remittance: "Αναμονή απόδοσης", cod: "Δεν εισπράχθηκε" };
  var SHIP_STATUS = EN
    ? { not_ready: "Not prepared", ready_courier: "Ready for courier", handed: "Handed to courier", transit: "In transit", delivered: "Delivered", failed: "Delivery failed", returning: "Returning", returned: "Returned" }
    : { not_ready: "Δεν ετοιμάστηκε", ready_courier: "Έτοιμη για courier", handed: "Στο courier", transit: "Σε μεταφορά", delivered: "Παραδόθηκε", failed: "Αποτυχία παράδοσης", returning: "Επιστρέφεται", returned: "Επιστράφηκε" };
  var COURIERS = { acs: "ACS Courier", elta: "ELTA Courier", speedex: "Speedex", geniki: EN ? "Geniki" : "Γενική Ταχυδρομική", box: "BOX NOW" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function courierLabel(k) { var id = String(k || "").toLowerCase(); return COURIERS[id] || (k ? String(k) : ""); }
  function payMethod(o) { return o.payment === "cod" ? PAY_METHOD.cod : PAY_METHOD.card; }
  function money(v) { return "€" + Number(v).toFixed(2); }

  /* Which of the 4 steps is the current stage (0-based). */
  function stageOf(o) {
    if (o.shippingStatus === "delivered" || o.status === "completed") return 3;
    if (o.shippingStatus === "handed" || o.shippingStatus === "transit") return 2;
    if (o.shippingStatus === "ready_courier" || o.status === "processing" || o.status === "ready") return 1;
    return 0;
  }

  function stepsHtml(o) {
    var stage = stageOf(o);
    return '<ol class="order-success__steps" aria-label="' + esc(L.title) + '">' +
      L.steps.map(function (label, i) {
        var cls = "order-success__step" + (i <= stage ? " is-done" : "");
        var dot = i < stage
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>'
          : String(i + 1);
        return '<li class="' + cls + '"><span class="order-success__step-dot" aria-hidden="true">' + dot + '</span><span class="order-success__step-text">' + esc(label) + "</span></li>";
      }).join("") +
      "</ol>";
  }

  function render(o) {
    var courier = courierLabel(o.courier);
    var items = (o.items || []).map(function (it) {
      return '<li class="oitems__row"><span>' + esc(it.title) + " × " + it.qty + "</span>" +
        (it.price != null ? "<span>" + money(it.price * it.qty) + "</span>" : "") + "</li>";
    }).join("");
    var d = new Date(o.createdAt);
    var locale = EN ? "en-GB" : "el-GR";

    var html =
      '<div class="track-head">' +
      '<h1 class="track-title">' + esc(L.title) + "</h1>" +
      '<p class="track-intro">' + esc(o.status === "cancelled" ? L.cancelled : L.intro) + "</p>" +
      "</div>" +
      (o.status === "cancelled" ? "" : stepsHtml(o)) +
      '<div class="track-grid">' +
      '<div class="track-field"><span>' + esc(L.number) + '</span><strong>#' + esc(o.number) + "</strong></div>" +
      '<div class="track-field"><span>' + esc(L.date) + "</span><strong>" + esc(d.toLocaleDateString(locale) + " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })) + "</strong></div>" +
      '<div class="track-field"><span>' + esc(L.payment) + "</span><strong>" + esc(payMethod(o) + " · " + (PAY_STATUS[o.paymentStatus] || o.paymentStatus)) + "</strong></div>" +
      '<div class="track-field"><span>' + esc(L.shipping) + "</span><strong>" + esc(SHIP_STATUS[o.shippingStatus] || o.shippingStatus) + "</strong></div>" +
      (courier ? '<div class="track-field"><span>' + esc(L.courier) + "</span><strong>" + esc(courier) + "</strong></div>" : "") +
      (o.tracking ? '<div class="track-field"><span>' + esc(L.tracking) + "</span><strong>" + esc(o.tracking) + "</strong></div>" : "") +
      "</div>" +
      (items ? '<div class="track-items"><h2>' + esc(L.products) + '</h2><ul class="oitems-plain">' + items + "</ul>" +
        (o.total ? '<p class="track-total">' + esc(L.total) + ": <strong>" + money(o.total) + "</strong></p>" : "") + "</div>" : "") +
      '<div class="order-success__help"><span class="order-success__help-text"><strong>' + esc(L.help) + '</strong></span>' +
      '<a class="order-success__help-btn" href="/contact">' + esc(L.contact) + "</a></div>";

    document.getElementById("track-card").innerHTML = html;
  }

  function renderError(msg) {
    document.getElementById("track-card").innerHTML =
      '<div class="track-head"><h1 class="track-title">' + esc(L.title) + '</h1>' +
      '<p class="track-intro">' + esc(msg) + "</p></div>" +
      '<div class="order-success__help"><span class="order-success__help-text"><strong>' + esc(L.help) + '</strong></span>' +
      '<a class="order-success__help-btn" href="/contact">' + esc(L.contact) + "</a></div>";
  }

  function init() {
    var token = new URLSearchParams(location.search).get("token") || "";
    if (!token) { renderError(L.noToken); return; }
    fetch("/api/orders/track?token=" + encodeURIComponent(token), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); })
      .then(function (data) {
        if (data && data.ok && data.order) render(data.order);
        else renderError(L.notFound);
      })
      .catch(function () { renderError(L.notFound); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
