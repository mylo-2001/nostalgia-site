(function () {
  "use strict";

  var ICON = {
    search:
      '<circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2L21 21"/>',
    cart:
      '<path d="M4 6h2.2l2.1 10h9.8l2-7.5H9"/><circle cx="10.2" cy="19" r="1.35"/><circle cx="16.6" cy="19" r="1.35"/>',
    heart:
      '<path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    bag: '<rect x="5" y="8" width="14" height="11" rx="1.5"/><path d="M9 8V6.8a3 3 0 0 1 6 0V8"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5.2-5.5"/>',
    mail: '<rect x="3.5" y="6" width="17" height="12" rx="1.8"/><path d="M4 8l8 6 8-6"/>',
    truck:
      '<path d="M3 8h11v9H3z"/><path d="M14 11h4l3 3v3h-7"/><circle cx="7" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
    home: '<path d="M4 11l8-5 8 5v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7z"/><path d="M10 19v-6h4v6"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.2c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8"/>',
    edit: '<path d="M5 19h14"/><path d="M7.5 16.5L16 8l2.5 2.5-8.5 8.5H7.5z"/>',
    key: '<circle cx="8.5" cy="14.5" r="3.2"/><path d="M11.2 12.8L19 5l2 2-2.2 2.2"/><path d="M16.5 7.5l2 2"/>',
    spark:
      '<path d="M12 3.5l1.4 4.4L18 9.3l-3.8 2.8L15.4 17 12 14.6 8.6 17l1.2-4.9L6 9.3l4.6-1.4z"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M4 14h16M12 10v10"/><path d="M12 10c-2.2-3.2-5.5-2.2-5.5 0S10.5 12 12 10c2.2-3.2 5.5-2.2 5.5 0S13.5 12 12 10z"/>',
    quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.4a2.8 2.8 0 0 1 5.3 1.2c0 1.6-2.5 2-2.5 3.4"/><path d="M12 17.2h.01"/>',
    star: '<path d="M12 4.2l1.8 3.8 4.2.6-3 2.9.7 4.2L12 14.8 8.3 15.7l.7-4.2-3-2.9 4.2-.6z"/>',
    google:
      '<path d="M12 5.2a6.8 6.8 0 1 0 6.8 6.8h-3.4A3.4 3.4 0 1 1 12 8.6V5.2z"/><path d="M12 5.2v3.4h6.5A6.8 6.8 0 0 0 12 5.2z"/>',
    flow: '<circle cx="6" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M8.2 12h1.6M14.2 12h1.6"/>',
  };

  var JOURNEYS = {
    order: {
      eyebrow: "of_eyebrow",
      title: "of_title",
      lead: "of_lead",
      svgTitle: "of_svg_title",
      kind: "fork",
      ctas: [
        { href: "/collection", label: "of_cta_shop", icon: "search", primary: true },
        { href: "/payments", label: "of_cta_pay", icon: "card" },
        { href: "/shipping-returns", label: "of_cta_ship", icon: "truck" },
      ],
      legend: [
        { step: "01", title: "of_s1_title", text: "of_s1_text", icon: "search", stage: 0 },
        { step: "02", title: "of_s2a_title", text: "of_s2a_text", icon: "cart", branch: "cart", stage: 1 },
        { step: "02", title: "of_s2b_title", text: "of_s2b_text", icon: "heart", branch: "wish", stage: 1 },
        { step: "03", title: "of_s4_title", text: "of_s4_text", icon: "bag", stage: 4 },
        { step: "04", title: "of_s5_title", text: "of_s5_text", icon: "card", stage: 5 },
        { step: "05", title: "of_s6_title", text: "of_s6_text", icon: "check", stage: 6 },
        { step: "06", title: "of_s7_title", text: "of_s7_text", icon: "mail", stage: 7 },
        { step: "07", title: "of_s8_title", text: "of_s8_text", icon: "truck", stage: 8 },
        { step: "08", title: "of_s9_title", text: "of_s9_text", icon: "home", stage: 9 },
      ],
    },
    account: {
      eyebrow: "of_acc_eyebrow",
      title: "of_acc_title",
      lead: "of_acc_lead",
      svgTitle: "of_acc_svg_title",
      kind: "account",
      ctas: [
        { href: "/account/register", label: "of_acc_cta", icon: "user", primary: true },
        { href: "/api/auth/google", label: "of_acc_cta_google", icon: "google" },
        { href: "/account", label: "of_acc_cta_login", icon: "key" },
        { href: "/privacy", label: "of_cta_privacy", icon: "check" },
      ],
      legend: [
        { step: "01", title: "of_acc_1", text: "of_acc_1t", icon: "user", stage: 0 },
        { step: "02", title: "of_acc_email", text: "of_acc_email_t", icon: "edit", branch: "email", stage: 1 },
        { step: "02", title: "of_acc_google", text: "of_acc_google_t", icon: "google", branch: "google", stage: 1 },
        { step: "03", title: "of_acc_3", text: "of_acc_3t", icon: "check", stage: 3 },
        { step: "04", title: "of_acc_4", text: "of_acc_4t", icon: "key", stage: 4 },
        { step: "05", title: "of_acc_5", text: "of_acc_5t", icon: "bag", stage: 5 },
      ],
      nodes: [
        { key: "of_acc_1", sub: "of_acc_1s", icon: "user", step: "01", text: "of_acc_1t" },
        { key: "of_acc_email", sub: "of_acc_email_s", icon: "edit", step: "02", text: "of_acc_email_t" },
        { key: "of_acc_google", sub: "of_acc_google_s", icon: "google", step: "02", text: "of_acc_google_t" },
        { key: "of_acc_3", sub: "of_acc_3s", icon: "check", step: "03", text: "of_acc_3t" },
        { key: "of_acc_4", sub: "of_acc_4s", icon: "key", step: "04", text: "of_acc_4t" },
        { key: "of_acc_5", sub: "of_acc_5s", icon: "bag", step: "05", text: "of_acc_5t" },
      ],
    },
    newsletter: {
      eyebrow: "of_nl_eyebrow",
      title: "of_nl_title",
      lead: "of_nl_lead",
      svgTitle: "of_nl_svg_title",
      kind: "linear",
      ctas: [
        { href: "#", label: "of_nl_cta", icon: "mail", primary: true, openWelcomeOffer: true },
        { href: "/privacy#newsletter", label: "of_cta_privacy", icon: "check" },
      ],
      nodes: [
        { key: "of_nl_1", sub: "of_nl_1s", icon: "mail", step: "01", text: "of_nl_1t" },
        { key: "of_nl_2", sub: "of_nl_2s", icon: "check", step: "02", text: "of_nl_2t" },
        { key: "of_nl_3", sub: "of_nl_3s", icon: "spark", step: "03", text: "of_nl_3t" },
        { key: "of_nl_4", sub: "of_nl_4s", icon: "star", step: "04", text: "of_nl_4t" },
        { key: "of_nl_5", sub: "of_nl_5s", icon: "heart", step: "05", text: "of_nl_5t" },
      ],
    },
    gift: {
      eyebrow: "of_gift_eyebrow",
      title: "of_gift_title",
      lead: "of_gift_lead",
      svgTitle: "of_gift_svg_title",
      kind: "linear",
      ctas: [
        { href: "/scent-finder", label: "of_gift_cta_scent", icon: "quiz", primary: true },
        { href: "/gift-experience", label: "of_gift_cta_exp", icon: "gift" },
        { href: "/collection", label: "of_cta_shop", icon: "search" },
      ],
      nodes: [
        { key: "of_gift_1", sub: "of_gift_1s", icon: "gift", step: "01", text: "of_gift_1t" },
        { key: "of_gift_2", sub: "of_gift_2s", icon: "quiz", step: "02", text: "of_gift_2t" },
        { key: "of_gift_3", sub: "of_gift_3s", icon: "spark", step: "03", text: "of_gift_3t" },
        { key: "of_gift_4", sub: "of_gift_4s", icon: "search", step: "04", text: "of_gift_4t" },
        { key: "of_gift_5", sub: "of_gift_5s", icon: "cart", step: "05", text: "of_gift_5t" },
        { key: "of_gift_6", sub: "of_gift_6s", icon: "home", step: "06", text: "of_gift_6t" },
      ],
    },
  };

  function t(key, fallback) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      var v = window.NostalgiaI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconGroup(name, stage, x, y) {
    return (
      '<g class="of-icon" data-stage="' +
      stage +
      '" transform="translate(' +
      x +
      " " +
      y +
      ')">' +
      (ICON[name] || "") +
      "</g>"
    );
  }

  function buildOrderSvg() {
    return (
      '<svg class="order-flow__svg" viewBox="0 0 1000 720" role="img">' +
      '<title>' +
      esc(t("of_svg_title")) +
      "</title>" +
      '<path class="of-path of-path--draw" data-stage="0" d="M500 78 L500 118" />' +
      '<path class="of-path of-path--draw of-branch--cart" data-stage="1" d="M500 118 C500 118 500 140 360 155" />' +
      '<path class="of-path of-path--draw of-branch--wish" data-stage="1" d="M500 118 C500 118 500 140 640 155" />' +
      '<g class="of-branch--cart">' +
      '<path class="of-path of-path--draw" data-stage="2" d="M360 195 L360 250" />' +
      '<path class="of-path of-path--draw" data-stage="3" d="M360 290 C360 310 420 318 500 318" />' +
      "</g>" +
      '<g class="of-branch--wish">' +
      '<path class="of-path of-path--draw" data-stage="2" d="M640 195 L640 230" />' +
      '<path class="of-path of-path--draw" data-stage="3" d="M640 270 L640 290 C640 310 580 318 500 318" />' +
      "</g>" +
      '<path class="of-path of-path--draw" data-stage="4" d="M500 318 L500 650" />' +
      '<polygon class="of-arrow" data-stage="9" points="500,662 493,648 507,648" />' +
      '<circle class="of-traveler" r="4.5" cx="500" cy="318" data-stage="9" />' +
      '<circle class="of-pulse" cx="500" cy="650" r="5" data-stage="9" />' +
      '<circle class="of-node" data-stage="0" cx="500" cy="48" r="28" />' +
      iconGroup("search", 0, 488, 36) +
      '<text class="of-label" data-stage="0" text-anchor="middle" x="500" y="92">' +
      esc(t("of_svg_s1", "Επιλογή")) +
      "</text>" +
      '<g class="of-branch--cart">' +
      '<circle class="of-node" data-stage="1" cx="360" cy="175" r="26" />' +
      iconGroup("cart", 1, 348, 163) +
      '<text class="of-label" data-stage="1" text-anchor="middle" x="360" y="218">' +
      esc(t("of_svg_s2a", "Καλάθι")) +
      "</text>" +
      '<text class="of-sub" data-stage="1" text-anchor="middle" x="360" y="236">' +
      esc(t("of_s2a_sub")) +
      "</text>" +
      "</g>" +
      '<g class="of-branch--wish">' +
      '<circle class="of-node" data-stage="1" cx="640" cy="175" r="26" />' +
      iconGroup("heart", 1, 628, 163) +
      '<text class="of-label" data-stage="1" text-anchor="middle" x="640" y="218">' +
      esc(t("of_svg_s2b", "Αγαπημένα")) +
      "</text>" +
      '<text class="of-sub" data-stage="1" text-anchor="middle" x="640" y="236">' +
      esc(t("of_s2b_sub")) +
      "</text>" +
      '<circle class="of-node" data-stage="2" cx="640" cy="250" r="22" />' +
      iconGroup("plus", 2, 629, 239) +
      '<text class="of-label" data-stage="2" text-anchor="start" x="672" y="248">' +
      esc(t("of_s3b_title")) +
      "</text>" +
      '<text class="of-sub" data-stage="2" text-anchor="start" x="672" y="264">' +
      esc(t("of_s3b_sub")) +
      "</text>" +
      "</g>" +
      linearTrunkNodes([
        { y: 360, stage: 4, icon: "bag", title: "of_s4_title", sub: "of_s4_sub" },
        { y: 420, stage: 5, icon: "card", title: "of_s5_title", sub: "of_s5_sub" },
        { y: 480, stage: 6, icon: "check", title: "of_s6_title", sub: "of_s6_sub" },
        { y: 540, stage: 7, icon: "mail", title: "of_s7_title", sub: "of_s7_sub" },
        { y: 600, stage: 8, icon: "truck", title: "of_s8_title", sub: "of_s8_sub" },
        { y: 660, stage: 9, icon: "home", title: "of_s9_title", sub: null, centerLabel: true },
      ]) +
      "</svg>"
    );
  }

  function linearTrunkNodes(items) {
    return items
      .map(function (n) {
        var label =
          n.centerLabel
            ? '<text class="of-label" data-stage="' +
              n.stage +
              '" text-anchor="middle" x="500" y="' +
              (n.y + 44) +
              '">' +
              esc(t(n.title)) +
              "</text>"
            : '<text class="of-label" data-stage="' +
              n.stage +
              '" text-anchor="start" x="540" y="' +
              (n.y - 4) +
              '">' +
              esc(t(n.title)) +
              "</text>" +
              (n.sub
                ? '<text class="of-sub" data-stage="' +
                  n.stage +
                  '" text-anchor="start" x="540" y="' +
                  (n.y + 14) +
                  '">' +
                  esc(t(n.sub)) +
                  "</text>"
                : "");
        return (
          '<circle class="of-node" data-stage="' +
          n.stage +
          '" cx="500" cy="' +
          n.y +
          '" r="26" />' +
          iconGroup(n.icon, n.stage, 488, n.y - 12) +
          label
        );
      })
      .join("");
  }

  function buildAccountSvg() {
    return (
      '<svg class="order-flow__svg order-flow__svg--account" viewBox="0 0 1000 560" role="img">' +
      "<title>" +
      esc(t("of_acc_svg_title")) +
      "</title>" +
      '<path class="of-path of-path--draw" data-stage="0" d="M500 78 L500 118" />' +
      '<path class="of-path of-path--draw of-branch--email" data-stage="1" d="M500 118 C500 140 360 150 360 170" />' +
      '<path class="of-path of-path--draw of-branch--google" data-stage="1" d="M500 118 C500 140 640 150 640 170" />' +
      '<g class="of-branch--email">' +
      '<path class="of-path of-path--draw" data-stage="2" d="M360 210 L360 250 C360 270 430 290 500 290" />' +
      "</g>" +
      '<g class="of-branch--google">' +
      '<path class="of-path of-path--draw" data-stage="2" d="M640 210 L640 250 C640 270 570 290 500 290" />' +
      "</g>" +
      '<path class="of-path of-path--draw" data-stage="3" d="M500 290 L500 500" />' +
      '<polygon class="of-arrow" data-stage="5" points="500,514 493,500 507,500" />' +
      '<circle class="of-traveler" r="4.5" cx="500" cy="290" data-stage="5" />' +
      '<circle class="of-node" data-stage="0" cx="500" cy="48" r="28" />' +
      iconGroup("user", 0, 488, 36) +
      '<text class="of-label" data-stage="0" text-anchor="middle" x="500" y="92">' +
      esc(t("of_acc_1")) +
      "</text>" +
      '<g class="of-branch--email">' +
      '<circle class="of-node" data-stage="1" cx="360" cy="190" r="26" />' +
      iconGroup("edit", 1, 348, 178) +
      '<text class="of-label" data-stage="1" text-anchor="middle" x="360" y="234">' +
      esc(t("of_acc_email")) +
      "</text>" +
      '<text class="of-sub" data-stage="1" text-anchor="middle" x="360" y="252">' +
      esc(t("of_acc_email_s")) +
      "</text>" +
      "</g>" +
      '<g class="of-branch--google">' +
      '<circle class="of-node" data-stage="1" cx="640" cy="190" r="26" />' +
      iconGroup("google", 1, 628, 178) +
      '<text class="of-label" data-stage="1" text-anchor="middle" x="640" y="234">' +
      esc(t("of_acc_google")) +
      "</text>" +
      '<text class="of-sub" data-stage="1" text-anchor="middle" x="640" y="252">' +
      esc(t("of_acc_google_s")) +
      "</text>" +
      "</g>" +
      linearTrunkNodes([
        { y: 330, stage: 3, icon: "check", title: "of_acc_3", sub: "of_acc_3s" },
        { y: 400, stage: 4, icon: "key", title: "of_acc_4", sub: "of_acc_4s" },
        { y: 470, stage: 5, icon: "bag", title: "of_acc_5", sub: "of_acc_5s" },
      ]) +
      "</svg>"
    );
  }

  function isNarrow() {
    return window.matchMedia && window.matchMedia("(max-width: 860px)").matches;
  }

  function buildOrderSvgMobile() {
    /* Vertical mobile-friendly order rail — same stages, readable on small screens. */
    var nodes = [
      { key: "of_svg_s1", sub: "of_s1_text", icon: "search", stage: 0 },
      { key: "of_svg_s2a", sub: "of_s2a_sub", icon: "cart", stage: 1, branch: "cart" },
      { key: "of_svg_s2b", sub: "of_s2b_sub", icon: "heart", stage: 1, branch: "wish" },
      { key: "of_s3b_title", sub: "of_s3b_sub", icon: "plus", stage: 2, branch: "wish" },
      { key: "of_s4_title", sub: "of_s4_sub", icon: "bag", stage: 4 },
      { key: "of_s5_title", sub: "of_s5_sub", icon: "card", stage: 5 },
      { key: "of_s6_title", sub: "of_s6_sub", icon: "check", stage: 6 },
      { key: "of_s7_title", sub: "of_s7_sub", icon: "mail", stage: 7 },
      { key: "of_s8_title", sub: "of_s8_sub", icon: "truck", stage: 8 },
      { key: "of_s9_title", sub: null, icon: "home", stage: 9 },
    ];
    return buildStackedSvg(nodes, t("of_svg_title"), "order-flow__svg--mobile");
  }

  function buildStackedSvg(nodes, title, extraClass) {
    var top = 48;
    var gap = 78;
    var h = top + (nodes.length - 1) * gap + 56;
    var parts = [];
    parts.push(
      '<svg class="order-flow__svg order-flow__svg--linear ' +
        (extraClass || "") +
        '" viewBox="0 0 640 ' +
        h +
        '" role="img"><title>' +
        esc(title) +
        "</title>"
    );
    parts.push(
      '<path class="of-path of-path--draw" data-stage="0" d="M72 ' +
        top +
        " L72 " +
        (top + (nodes.length - 1) * gap) +
        '" />'
    );
    parts.push(
      '<polygon class="of-arrow" data-stage="' +
        (nodes[nodes.length - 1].stage || nodes.length - 1) +
        '" points="72,' +
        (top + (nodes.length - 1) * gap + 14) +
        " 65," +
        (top + (nodes.length - 1) * gap) +
        " 79," +
        (top + (nodes.length - 1) * gap) +
        '" />'
    );
    nodes.forEach(function (n, i) {
      var y = top + i * gap;
      var stage = typeof n.stage === "number" ? n.stage : i;
      var branchClass = n.branch ? " of-branch--" + n.branch : "";
      parts.push('<g class="' + branchClass.trim() + '">');
      parts.push(
        '<circle class="of-node" data-stage="' + stage + '" cx="72" cy="' + y + '" r="24" />'
      );
      parts.push(iconGroup(n.icon, stage, 60, y - 12));
      parts.push(
        '<text class="of-label" data-stage="' +
          stage +
          '" text-anchor="start" x="112" y="' +
          (y - 2) +
          '">' +
          esc(t(n.key)) +
          "</text>"
      );
      if (n.sub) {
        parts.push(
          '<text class="of-sub" data-stage="' +
            stage +
            '" text-anchor="start" x="112" y="' +
            (y + 16) +
            '">' +
            esc(t(n.sub)) +
            "</text>"
        );
      }
      parts.push("</g>");
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function buildAccountSvgMobile() {
    return buildStackedSvg(
      [
        { key: "of_acc_1", sub: "of_acc_1s", icon: "user", stage: 0 },
        { key: "of_acc_email", sub: "of_acc_email_s", icon: "edit", stage: 1, branch: "email" },
        { key: "of_acc_google", sub: "of_acc_google_s", icon: "google", stage: 1, branch: "google" },
        { key: "of_acc_3", sub: "of_acc_3s", icon: "check", stage: 3 },
        { key: "of_acc_4", sub: "of_acc_4s", icon: "key", stage: 4 },
        { key: "of_acc_5", sub: "of_acc_5s", icon: "bag", stage: 5 },
      ],
      t("of_acc_svg_title"),
      "order-flow__svg--mobile"
    );
  }

  function buildLinearSvg(journey) {
    var nodes = journey.nodes || [];
    var top = 56;
    var gap = 88;
    var bottom = top + (nodes.length - 1) * gap + 40;
    var h = Math.max(420, bottom + 36);
    var parts = [];
    parts.push(
      '<svg class="order-flow__svg order-flow__svg--linear" viewBox="0 0 1000 ' +
        h +
        '" role="img"><title>' +
        esc(t(journey.svgTitle)) +
        "</title>"
    );
    parts.push(
      '<path class="of-path of-path--draw" data-stage="0" d="M500 ' +
        top +
        " L500 " +
        (top + (nodes.length - 1) * gap) +
        '" />'
    );
    parts.push(
      '<polygon class="of-arrow" data-stage="' +
        (nodes.length - 1) +
        '" points="500,' +
        (top + (nodes.length - 1) * gap + 14) +
        " 493," +
        (top + (nodes.length - 1) * gap) +
        " 507," +
        (top + (nodes.length - 1) * gap) +
        '" />'
    );
    parts.push('<circle class="of-traveler" r="4.5" cx="500" cy="' + top + '" data-stage="0" />');
    nodes.forEach(function (n, i) {
      var y = top + i * gap;
      parts.push(
        '<circle class="of-node" data-stage="' + i + '" cx="500" cy="' + y + '" r="28" />'
      );
      parts.push(iconGroup(n.icon, i, 488, y - 12));
      parts.push(
        '<text class="of-label" data-stage="' +
          i +
          '" text-anchor="start" x="548" y="' +
          (y - 4) +
          '">' +
          esc(t(n.key)) +
          "</text>"
      );
      parts.push(
        '<text class="of-sub" data-stage="' +
          i +
          '" text-anchor="start" x="548" y="' +
          (y + 16) +
          '">' +
          esc(t(n.sub)) +
          "</text>"
      );
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function buildStrip(journey) {
    var icons = [];
    if (journey.kind === "fork") {
      icons = [
        { icon: "search", branch: "shared" },
        { icon: "cart", branch: "cart" },
        { icon: "heart", branch: "wish" },
        { icon: "card", branch: "shared" },
        { icon: "check", branch: "shared" },
        { icon: "mail", branch: "shared" },
        { icon: "truck", branch: "shared" },
        { icon: "home", branch: "shared" },
      ];
    } else if (journey.kind === "account") {
      icons = [
        { icon: "user", branch: "shared" },
        { icon: "edit", branch: "email" },
        { icon: "google", branch: "google" },
        { icon: "check", branch: "shared" },
        { icon: "key", branch: "shared" },
        { icon: "bag", branch: "shared" },
      ];
    } else {
      icons = (journey.nodes || []).map(function (n) {
        return { icon: n.icon, branch: "shared" };
      });
    }
    var html = '<div class="order-flow__strip" aria-hidden="true">';
    icons.forEach(function (item, i) {
      if (i) {
        html +=
          '<span class="order-flow__strip-arrow"><svg viewBox="0 0 24 12"><path d="M2 6h16"/><path d="M14 2l6 4-6 4"/></svg></span>';
      }
      html +=
        '<span class="order-flow__strip-node" data-branch="' +
        item.branch +
        '" data-stage="' +
        i +
        '"><svg viewBox="0 0 24 24">' +
        (ICON[item.icon] || "") +
        "</svg></span>";
    });
    html += "</div>";
    return html;
  }

  function buildLegend(journey) {
    var items =
      journey.kind === "fork" || journey.kind === "account"
        ? journey.legend
        : (journey.nodes || []).map(function (n, i) {
            return {
              step: n.step,
              title: n.key,
              text: n.text,
              icon: n.icon,
              stage: i,
            };
          });
    var html = '<ol class="order-flow__legend">';
    items.forEach(function (item, i) {
      var stage = typeof item.stage === "number" ? item.stage : i;
      html +=
        '<li class="order-flow__legend-item"' +
        (item.branch ? ' data-branch="' + item.branch + '"' : "") +
        ' data-stage="' +
        stage +
        '">' +
        '<span class="order-flow__legend-icon" data-step="' +
        esc(item.step) +
        '" aria-hidden="true"><svg viewBox="0 0 24 24">' +
        (ICON[item.icon] || "") +
        "</svg></span>" +
        "<div><strong>" +
        esc(t(item.title)) +
        "</strong><span>" +
        esc(t(item.text)) +
        "</span></div></li>";
    });
    html += "</ol>";
    return html;
  }

  function buildCtas(journey) {
    var html = '<div class="order-flow__cta">';
    (journey.ctas || []).forEach(function (c) {
      var attrs = c.openWelcomeOffer
        ? ' href="#" data-welcome-offer-open role="button"'
        : ' href="' + esc(c.href) + '"';
      html +=
        '<a class="' +
        (c.primary ? "order-flow__cta-primary" : "order-flow__cta-secondary") +
        '"' +
        attrs +
        '><svg viewBox="0 0 24 24" aria-hidden="true">' +
        (ICON[c.icon] || "") +
        "</svg><span>" +
        esc(t(c.label)) +
        "</span></a>";
    });
    html += "</div>";
    return html;
  }

  function preparePaths(root) {
    root.querySelectorAll(".of-path--draw").forEach(function (path) {
      var len = 0;
      try {
        len = path.getTotalLength();
      } catch (e) {
        len = 900;
      }
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
    });
  }

  function clearStages(root) {
    root.classList.remove("is-drawn", "is-playing");
    root.querySelectorAll("[data-stage]").forEach(function (el) {
      el.classList.remove("is-on");
    });
    root.querySelectorAll(".of-path--draw").forEach(function (path) {
      var len = path.style.strokeDasharray || "900";
      path.style.strokeDashoffset = len;
      path.style.transition = "none";
    });
  }

  function playStages(root) {
    var reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    preparePaths(root);
    if (reduce) {
      root.classList.add("is-drawn");
      root.querySelectorAll("[data-stage]").forEach(function (el) {
        el.classList.add("is-on");
      });
      root.querySelectorAll(".of-path--draw").forEach(function (path) {
        path.style.strokeDashoffset = "0";
      });
      return;
    }

    clearStages(root);
    /* Force reflow so restarting a journey replays cleanly. */
    void root.offsetWidth;
    root.classList.add("is-playing");

    var maxStage = 0;
    root.querySelectorAll("[data-stage]").forEach(function (el) {
      maxStage = Math.max(maxStage, parseInt(el.getAttribute("data-stage"), 10) || 0);
    });

    var i = 0;
    function step() {
      root.querySelectorAll('[data-stage="' + i + '"]').forEach(function (el) {
        el.classList.add("is-on");
        if (el.classList.contains("of-path--draw")) {
          el.style.transition = "stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1)";
          el.style.strokeDashoffset = "0";
        }
      });
      i += 1;
      if (i <= maxStage) {
        window.setTimeout(step, 420);
      } else {
        root.classList.add("is-drawn");
      }
    }
    window.setTimeout(step, 80);
  }

  function setOrderBranch(root, mode) {
    root.setAttribute("data-mode", mode);
    root.querySelectorAll("button[data-flow-mode]").forEach(function (btn) {
      var active = btn.getAttribute("data-flow-mode") === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function setJourney(root, journeyId, branchMode, opts) {
    var journey = JOURNEYS[journeyId] || JOURNEYS.order;
    var options = opts || {};
    root.setAttribute("data-journey", journeyId);
    root.setAttribute("data-mode", journeyId === "order" ? branchMode || "both" : "both");
    root.setAttribute("data-acc", journeyId === "account" ? "both" : "");

    var eyebrow = document.querySelector("[data-of-eyebrow]");
    var title = document.getElementById("order-flow-heading");
    var lead = document.querySelector("[data-of-lead]");
    if (eyebrow) eyebrow.textContent = t(journey.eyebrow);
    if (title) title.textContent = t(journey.title);
    if (lead) lead.textContent = t(journey.lead);

    root.querySelectorAll("button[data-journey]").forEach(function (btn) {
      var active = btn.getAttribute("data-journey") === journeyId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    var sub = root.querySelector("[data-order-submodes]");
    if (sub) sub.hidden = journeyId !== "order";

    var stage = root.querySelector("[data-flow-stage]");
    if (!stage) return;
    var svg;
    if (journey.kind === "fork") {
      svg = isNarrow() ? buildOrderSvgMobile() : buildOrderSvg();
    } else if (journey.kind === "account") {
      svg = isNarrow() ? buildAccountSvgMobile() : buildAccountSvg();
    } else {
      svg = isNarrow()
        ? buildStackedSvg(
            (journey.nodes || []).map(function (n, i) {
              return {
                key: n.key,
                sub: n.sub,
                icon: n.icon,
                stage: i,
              };
            }),
            t(journey.svgTitle),
            "order-flow__svg--mobile"
          )
        : buildLinearSvg(journey);
    }
    stage.innerHTML = svg + buildStrip(journey) + buildLegend(journey);

    var ctaHost = root.querySelector("[data-flow-ctas]");
    if (ctaHost) ctaHost.innerHTML = buildCtas(journey);

    if (journeyId === "order") setOrderBranch(root, branchMode || "both");

    if (options.deferPlay) {
      clearStages(root);
      preparePaths(root);
    } else {
      playStages(root);
    }
  }

  function boot() {
    var root = document.getElementById("order-flow");
    if (!root) return;

    var currentJourney = "order";
    var currentBranch = "both";
    var armed = false;

    setJourney(root, currentJourney, currentBranch, { deferPlay: true });

    function ensurePlay() {
      if (armed) return;
      armed = true;
      playStages(root);
    }

    var reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      ensurePlay();
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            ensurePlay();
            io.disconnect();
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -4% 0px" }
      );
      io.observe(root);
      /* Mobile fallback — IO can miss short viewports. */
      window.setTimeout(ensurePlay, 1200);
    }

    var narrow = isNarrow();
    window.addEventListener("resize", function () {
      var nowNarrow = isNarrow();
      if (nowNarrow === narrow) return;
      narrow = nowNarrow;
      setJourney(root, currentJourney, currentBranch, { deferPlay: !armed });
      if (armed) playStages(root);
    });

    function scrollToDiagram() {
      var target =
        document.getElementById("order-flow-heading") ||
        root.querySelector("[data-flow-stage]") ||
        root;
      if (!target || typeof target.scrollIntoView !== "function") return;
      var reduceMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }

    root.querySelectorAll("button[data-journey]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentJourney = btn.getAttribute("data-journey") || "order";
        armed = true;
        setJourney(root, currentJourney, currentBranch);
        scrollToDiagram();
      });
    });

    root.querySelectorAll("button[data-flow-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentBranch = btn.getAttribute("data-flow-mode") || "both";
        setOrderBranch(root, currentBranch);
      });
    });

    document.addEventListener("nostalgia-i18n-updated", function () {
      setJourney(root, currentJourney, currentBranch, { deferPlay: !armed });
      if (armed) playStages(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
