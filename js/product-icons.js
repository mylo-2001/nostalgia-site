/**
 * Line-art SVG icons for product page — category-aware (matches design mockups).
 */
(function () {
  var SVG_OPEN =
    '<svg class="product-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
  var STROKE = ' fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

  var PATHS = {
    hand:
      '<path d="M8 11V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 11V7.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V9a1.5 1.5 0 0 1 3 0v5.5a5.5 5.5 0 0 1-11 0V12"' +
      STROKE +
      "/>",
    sun:
      '<circle cx="12" cy="12" r="3.5"' +
      STROKE +
      '/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"' +
      STROKE +
      "/>",
    gem:
      '<path d="M12 3l7 5.5L12 21 5 8.5 12 3z"' +
      STROKE +
      '/><path d="M5 8.5h14M9 8.5L12 3l3 5.5"' +
      STROKE +
      "/>",
    wood:
      '<path d="M6 18c2-4 4-6 6-6s4 2 6 6"' +
      STROKE +
      '/><path d="M8 14c1.5-2 3-3 4-3s2.5 1 4 3M10 10c.5-1.5 1.5-2.5 2-2.5s1.5 1 2 2.5"' +
      STROKE +
      "/>",
    jar:
      '<path d="M9 4h6l1 3H8l1-3zM8 7h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7z"' +
      STROKE +
      '/><path d="M10 12h4"' +
      STROKE +
      "/>",
    drop:
      '<path d="M12 3c3 4.5 6 7.5 6 10.5a6 6 0 1 1-12 0C6 10.5 9 7.5 12 3z"' +
      STROKE +
      "/>",
    candle:
      '<path d="M12 2v2M10 4h4M8 7h8l-1 13H9L8 7z"' +
      STROKE +
      '/><path d="M12 5c.5 1 .5 2 0 2.5"' +
      STROKE +
      "/>",
    wand:
      '<path d="M4 20 18 6M15 5l3 3M12 8l3 3"' +
      STROKE +
      "/>",
    leaf:
      '<path d="M12 21c-4-3-7-7-7-11a7 7 0 0 1 14 0c0 4-3 8-7 11z"' +
      STROKE +
      '/><path d="M12 21V11M9 14c1.5-1 3-1.5 3-1.5s1.5.5 3 1.5"' +
      STROKE +
      "/>",
    sparkle:
      '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1"' +
      STROKE +
      '/><circle cx="12" cy="12" r="2"' +
      STROKE +
      "/>",
    decor:
      '<path d="M8 7h8l1 2v10H7V9l1-2z"' +
      STROKE +
      '/><path d="M10 7V5h4v2M12 12v4"' +
      STROKE +
      "/>",
    bottle:
      '<path d="M10 3h4v3l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3V3z"' +
      STROKE +
      '/><path d="M10 9h4"' +
      STROKE +
      "/>",
    unisex:
      '<circle cx="9" cy="9" r="3"' +
      STROKE +
      '/><path d="M12 12l5 5M16 12h3v3"' +
      STROKE +
      '/><circle cx="16.5" cy="16.5" r="2.5"' +
      STROKE +
      "/>",
    house:
      '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"' +
      STROKE +
      "/>",
    gift:
      '<path d="M4 10h16v10H4V10zM12 10v10M4 10V8a2 2 0 0 1 2-2h1.5M20 10V8a2 2 0 0 0-2-2H16.5M12 6v4M9.5 6C8.5 4.5 10 3 12 3s3.5 1.5 2.5 3"' +
      STROKE +
      "/>",
    flower:
      '<circle cx="12" cy="12" r="2"' +
      STROKE +
      '/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"' +
      STROKE +
      "/>",
    hourglass:
      '<path d="M8 4h8M8 20h8M9 4v4l3 4-3 4v4h6v-4l-3-4 3-4V4"' +
      STROKE +
      "/>",
    flask:
      '<path d="M10 3h4v5l4 8a3 3 0 0 1-2.6 4.5H8.6A3 3 0 0 1 6 16l4-8V3z"' +
      STROKE +
      '/><path d="M10 8h4"' +
      STROKE +
      "/>",
    doc:
      '<path d="M8 4h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"' +
      STROKE +
      '/><path d="M14 4v4h4M10 13h4M10 17h4"' +
      STROKE +
      "/>",
    heart:
      '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"' +
      STROKE +
      "/>",
    shield:
      '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z"' +
      STROKE +
      '/><path d="M9 12l2 2 4-4"' +
      STROKE +
      "/>",
    truck:
      '<path d="M3 7h11v8H3V7zM14 10h4l2 3v2h-6v-5zM7 17a1.5 1.5 0 1 0 0 .01M17 17a1.5 1.5 0 1 0 0 .01"' +
      STROKE +
      "/>",
    list:
      '<path d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01"' +
      STROKE +
      "/>",
    check:
      '<path d="M5 12.5 9.5 17 19 7"' +
      STROKE +
      "/>",
    mirror:
      '<rect x="6" y="5" width="12" height="14" rx="1.5"' +
      STROKE +
      '/><path d="M9 9l6 6M15 9l-6 6"' +
      STROKE +
      '/><path d="M12 19v2M9 21h6"' +
      STROKE +
      "/>",
  };

  var CAT_BADGE_ICONS = {
    cat1: ["hand", "sun", "gem"],
    cat2: ["hand", "sun"],
    cat3: ["hand", "sun", "drop"],
    cat4: ["hand", "sun", "decor"],
    cat5: ["hand", "sun", "leaf"],
    cat9: ["hand", "sun", "mirror"],
  };

  var LAYOUT_BADGE_ICONS = {
    perfume: ["bottle", "unisex"],
    diffuser: ["house", "leaf"],
    gift: ["gift"],
    candle: ["hand", "sun"],
    object: ["hand", "sun"],
  };

  var CAT_FEATURE_ICONS = {
    cat1: ["gem", "candle", "wand"],
    cat2: ["wood", "jar", "wand"],
    cat3: ["drop", "candle", "wand"],
    cat4: ["sparkle", "decor", "wand"],
    cat5: ["leaf", "drop", "wand"],
    cat9: ["mirror", "candle", "wand"],
  };

  var LAYOUT_FEATURE_ICONS = {
    perfume: ["flower", "flower", "flower"],
    diffuser: ["flower", "hourglass", "flask"],
    gift: ["gift", "gift", "gift"],
    candle: ["hand", "sun", "leaf"],
    object: ["sparkle", "decor", "wand"],
  };

  var ACCORDION_ICONS = {
    product_acc_description: "doc",
    product_acc_specs: "heart",
    product_acc_care: "shield",
    product_acc_usage: "drop",
    product_acc_shipping: "truck",
  };

  function svg(name) {
    return SVG_OPEN + (PATHS[name] || PATHS.check) + "</svg>";
  }

  function badgeIcons(layout, catId) {
    return CAT_BADGE_ICONS[catId] || LAYOUT_BADGE_ICONS[layout] || LAYOUT_BADGE_ICONS.candle;
  }

  function featureIcons(layout, catId, count) {
    var list = CAT_FEATURE_ICONS[catId] || LAYOUT_FEATURE_ICONS[layout] || LAYOUT_FEATURE_ICONS.candle;
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push(list[i] || list[list.length - 1] || "check");
    }
    return out;
  }

  function featureLayoutMode(layout) {
    return layout === "candle" || layout === "object" ? "row" : "stack";
  }

  window.NostalgiaProductIcons = {
    svg: svg,
    badgeIcons: badgeIcons,
    featureIcons: featureIcons,
    featureLayoutMode: featureLayoutMode,
    accordionIcon: function (titleKey) {
      return ACCORDION_ICONS[titleKey] || "doc";
    },
  };
})();
