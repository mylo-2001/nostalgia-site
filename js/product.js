(function () {
  var REVIEWS_KEY = "nostalgia-reviews";
  var RELATED_PRODUCT_LIMIT = 8;
  var relatedMotionObserver = null;

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  /* ---- bilingual helpers: prefer the admin's English content when the site
     is in English and that content exists, otherwise fall back to Greek. ---- */
  function curLang() {
    return document.documentElement.lang === "en" ? "en" : "el";
  }
  function hasVal(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim() !== "";
  }
  /* Read saved.<key>, preferring saved.<key>En when in English mode. */
  function sv(saved, key) {
    if (curLang() === "en" && hasVal(saved[key + "En"])) return saved[key + "En"];
    return saved[key];
  }
  /* A product's display title with English fallback to Greek. Includes the
     colour suffix for variants (used in cart / related / meta). */
  function productTitle(product) {
    if (curLang() === "en" && hasVal(product.titleEn)) return product.titleEn;
    return product.title;
  }

  /* The base product name for the page heading — without the colour suffix,
     since the colour is shown by the swatch selector. */
  function pageHeading(product) {
    if (product.baseTitle) {
      if (curLang() === "en" && hasVal(product.baseTitleEn)) return product.baseTitleEn;
      return product.baseTitle;
    }
    return productTitle(product);
  }

  function getProductId() {
    var pathMatch = (window.location.pathname || "").match(/\/product\/([^/?#]+)/);
    if (pathMatch) {
      try {
        return decodeURIComponent(pathMatch[1]);
      } catch (e) {
        return pathMatch[1];
      }
    }
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || "";
  }

  function getLayoutType(product) {
    if (product.catId === "cat6") return "perfume";
    if (product.catId === "cat7") return "diffuser";
    if (product.catId === "cat8") return "gift";
    if (product.catId === "cat4") return "object";
    return "candle";
  }

  var CATEGORY_DEFAULTS = {
    cat2: {
      description:
        "Ένα μοναδικό διακοσμητικό έργο, όπου το φυσικό ξύλο συναντά τη ζεστή φλόγα του κεριού μέλισσας. Κάθε δημιουργία έχει διαφορετικό σχήμα και χαρακτήρα, γι' αυτό κανένα κομμάτι δεν είναι ακριβώς ίδιο με το άλλο.",
      badges: ["Χειροποίητο", "Μοναδικό κομμάτι"],
      features: ["Φυσικό driftwood", "Κερί μέλισσας", "Χειροποίητο στην Ελλάδα"],
      longDescription:
        "Το Driftwood Beeswax Flame είναι ένα χειροποίητο διακοσμητικό έργο εμπνευσμένο από τη φυσική ομορφιά του ξύλου και τη ζεστασιά της φλόγας.\n\nΤο φυσικό driftwood επιλέγεται και διαμορφώνεται ξεχωριστά, ώστε να διατηρεί τις ατέλειες, τις καμπύλες και τη μοναδική του υφή. Το κερί μέλισσας προσθέτει μία απαλή, ζεστή λάμψη, δημιουργώντας μια ιδιαίτερη ατμόσφαιρα στον χώρο.\n\nΛόγω της φυσικής προέλευσης των υλικών, ενδέχεται να υπάρχουν μικρές διαφορές στο χρώμα, στο σχήμα και στην υφή. Αυτές οι διαφορές αποτελούν μέρος της μοναδικότητας κάθε δημιουργίας.",
      specs: [
        { label: "Υλικό βάσης", value: "Φυσικό ξύλο driftwood" },
        { label: "Τύπος κεριού", value: "Κερί μέλισσας" },
        { label: "Κατασκευή", value: "Χειροποίητη" },
        { label: "Χρώμα", value: "Φυσικές αποχρώσεις ξύλου και μελιού" },
        { label: "Προέλευση", value: "Ελλάδα" },
        { label: "Συσκευασία", value: "Premium προστατευτική συσκευασία" },
      ],
      care: [
        "Τοποθετήστε το προϊόν σε σταθερή και ανθεκτική στη θερμότητα επιφάνεια. Μην αφήνετε αναμμένο κερί χωρίς επίβλεψη και κρατήστε το μακριά από παιδιά, κατοικίδια και εύφλεκτα αντικείμενα.",
        "Καθαρίστε το ξύλινο μέρος απαλά με στεγνό ή ελαφρώς νωπό πανί. Αποφύγετε τη χρήση ισχυρών καθαριστικών.",
      ],
    },
    cat9: {
      description:
        "Exclusive mirror-finish candle — όπου η αντανάκλαση του φωτός συναντά τη ζεστή ατμόσφαιρα του κεριού. Κάθε κομμάτι είναι χειροποίητο και μοναδικό.",
      longDescription:
        "Η συλλογή Nostalgia Exclusive Mirror Candles συνδυάζει καθρέπτινη λάμψη, φως και ατμόσφαιρα σε περιορισμένη έκδοση.\n\nΚάθε κερί φιλοξενείται σε επιφάνεια mirror finish που ανακλά τη φλόγα και μετατρέπει τον χώρο σε μια εμπειρία φωτός και νοσταλγίας. Το φυτικό κερί σόγιας προσφέρει καθαρή, αργή καύση.\n\nΛόγω της χειροποίητης κατασκευής, ενδέχεται να υπάρχουν μικρές διαφορές στο σχήμα και την αντανάκλαση — κάθε κομμάτι είναι μοναδικό.",
      specs: [
        { label: "Συλλογή", value: "Nostalgia Exclusive Mirror Candles" },
        { label: "Επιφάνεια", value: "Mirror finish" },
        { label: "Τύπος κεριού", value: "Φυτικό κερί σόγιας" },
        { label: "Κατασκευή", value: "Χειροποίητη" },
        { label: "Προέλευση", value: "Ελλάδα" },
        { label: "Συσκευασία", value: "Premium προστατευτική συσκευασία" },
      ],
      care: [
        "Τοποθετήστε το προϊόν σε σταθερή, ανθεκτική στη θερμότητα επιφάνεια.",
        "Μην αφήνετε αναμμένο κερί χωρίς επίβλεψη· κρατήστε το μακριά από παιδιά, κατοικίδια και εύφλεκτα αντικείμενα.",
        "Καθαρίστε την καθρέπτινη επιφάνεια απαλά με μαλακό, στεγνό πανί. Αποφύγετε λειαντικά ή ισχυρά καθαριστικά.",
      ],
    },
  };

  function revealProductContent(root) {
    if (!root) return;
    root.querySelectorAll(".site-reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
    var layout = root.querySelector(".product-page__layout");
    if (layout) layout.classList.add("is-visible");
  }

  function updateProductBreadcrumbs(trail) {
    var tries = 0;
    function apply() {
      if (window.NostalgiaBreadcrumbs && typeof window.NostalgiaBreadcrumbs.update === "function") {
        window.NostalgiaBreadcrumbs.update(trail);
        return;
      }
      if (++tries < 120) {
        window.setTimeout(apply, 50);
      }
    }
    apply();
  }

  function renderNotFound() {
    var root = document.getElementById("product-page-root");
    if (!root) return;
    root.innerHTML =
      '<div class="product-not-found">' +
      '  <h1 class="product-info__title" data-i18n="product_not_found">' +
      t("product_not_found") +
      "</h1>" +
      '  <a class="btn-shop btn-shop--ghost" href="/collection" style="max-width:16rem;margin:1rem auto 0" data-i18n="cart_continue">' +
      t("cart_continue") +
      "</a>" +
      "</div>";
    revealProductContent(root);
    updateProductBreadcrumbs([
      { labelKey: "nav_home", href: "/" },
      { labelKey: "nav_collection", href: "/collection" },
      { text: t("product_not_found") },
    ]);
  }

  function mergeDetails(product) {
    var layout = getLayoutType(product);
    var catDefaults = CATEGORY_DEFAULTS[product.catId] || {};
    var saved = product.details && typeof product.details === "object" ? product.details : {};
    var merged = {};

    var savedDescription = sv(saved, "description");
    merged.description =
      (curLang() === "en" && hasVal(product.descriptionEn) && product.descriptionEn.trim()) ||
      (product.description && product.description.trim()) ||
      (savedDescription && String(savedDescription).trim()) ||
      (catDefaults.description || "");

    var savedBadges = sv(saved, "badges");
    merged.badges =
      (Array.isArray(savedBadges) && savedBadges.length && savedBadges) ||
      (Array.isArray(catDefaults.badges) && catDefaults.badges.length && catDefaults.badges) ||
      defaultBadges(layout, product.catId);

    var savedFeatures = sv(saved, "features");
    merged.features =
      (Array.isArray(savedFeatures) && savedFeatures.length && savedFeatures) ||
      (Array.isArray(catDefaults.features) && catDefaults.features.length && catDefaults.features) ||
      defaultFeatures(layout, product);

    var savedLong = sv(saved, "longDescription");
    merged.longDescription =
      (savedLong && String(savedLong).trim()) ||
      (catDefaults.longDescription || "") ||
      merged.description;

    var savedSpecs = sv(saved, "specs");
    merged.specs =
      (Array.isArray(savedSpecs) && savedSpecs.length && savedSpecs) ||
      (Array.isArray(catDefaults.specs) && catDefaults.specs.length && catDefaults.specs) ||
      defaultSpecs(layout);

    merged.care = normalizeParagraphs(
      sv(saved, "care") || catDefaults.care || defaultCare(layout)
    );

    merged.shipping = normalizeParagraphs(
      sv(saved, "shipping") || defaultShipping()
    );

    var savedIncludes = sv(saved, "includes");
    merged.includes =
      (Array.isArray(savedIncludes) && savedIncludes.length && savedIncludes) ||
      (Array.isArray(catDefaults.includes) && catDefaults.includes) ||
      [];

    merged.scentNotes = sv(saved, "scentNotes") || catDefaults.scentNotes || null;
    merged.diffuser = sv(saved, "diffuser") || catDefaults.diffuser || null;
    merged.layout = layout;
    merged.catId = product.catId;

    merged.colorFamily = sv(saved, "colorFamily") || "";

    return merged;
  }

  function normalizeParagraphs(val) {
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    if (val && String(val).trim()) return [String(val).trim()];
    return [];
  }

  function defaultBadges(layout, catId) {
    if (layout === "perfume") return [t("product_badge_edp"), t("product_badge_unisex")];
    if (layout === "diffuser") return [t("product_badge_room"), t("product_badge_natural_oils")];
    if (layout === "gift") return [t("product_badge_gift")];
    if (catId === "cat1") {
      return [t("product_badge_handmade_gr"), t("product_tag_unique"), t("product_badge_murano")];
    }
    if (catId === "cat2") {
      return [t("product_badge_handmade_product"), t("product_tag_unique")];
    }
    if (catId === "cat3") {
      return [t("product_badge_handmade_gr"), t("product_tag_unique"), t("product_badge_liquid_gel")];
    }
    if (catId === "cat4") {
      return [t("product_badge_handmade_gr"), t("product_tag_unique"), t("product_feat_decor")];
    }
    if (catId === "cat5") {
      return [t("product_badge_handmade_gr"), t("product_tag_unique"), t("product_badge_natural_mat")];
    }
    if (catId === "cat9") {
      return [t("product_badge_handmade_gr"), t("product_tag_unique"), t("product_badge_mirror")];
    }
    return [t("product_badge_handmade_short"), t("product_tag_unique")];
  }

  function defaultFeatures(layout, product) {
    var catId = product.catId;
    if (layout === "perfume") {
      return [
        t("product_scent_top") + ": " + t("product_scent_top_default"),
        t("product_scent_heart") + ": " + t("product_scent_heart_default"),
        t("product_scent_base") + ": " + t("product_scent_base_default"),
      ];
    }
    if (layout === "diffuser") {
      return [
        t("product_diffuser_notes") + ": " + t("product_diffuser_notes_default"),
        t("product_diffuser_duration") + ": " + t("product_diffuser_duration_default"),
        t("product_diffuser_capacity") + ": " + t("product_diffuser_capacity_default"),
      ];
    }
    if (layout === "gift") return [];
    if (catId === "cat1") {
      return [t("product_feat_murano_glass"), t("product_feat_soy_wax"), t("product_feat_handmade")];
    }
    if (catId === "cat2") {
      return [t("product_feat_driftwood"), t("product_feat_beeswax"), t("product_feat_handmade")];
    }
    if (catId === "cat3") {
      return [t("product_feat_liquid_gel"), t("product_feat_veg_wax"), t("product_feat_handmade")];
    }
    if (catId === "cat4") {
      return [t("product_feat_unique_design"), t("product_feat_decor"), t("product_feat_handmade")];
    }
    if (catId === "cat5") {
      return [t("product_badge_natural_mat"), t("product_feat_plant_wax"), t("product_feat_handmade")];
    }
    if (catId === "cat9") {
      return [t("product_feat_mirror"), t("product_feat_soy_wax"), t("product_feat_handmade")];
    }
    if (layout === "object") {
      return [t("product_feat_unique"), t("product_feat_handmade"), t("product_feat_decor")];
    }
    return [t("product_feat_handmade"), t("product_feat_unique"), t("product_feat_natural")];
  }

  function defaultSpecs(layout) {
    if (layout === "perfume") {
      return [
        { label: t("product_spec_type_label"), value: t("product_badge_edp") },
        { label: t("product_spec_origin_label"), value: t("product_spec_origin_value") },
        { label: t("product_spec_packaging_label"), value: t("product_spec_packaging_value") },
      ];
    }
    if (layout === "diffuser") {
      return [
        { label: t("product_spec_capacity_label"), value: t("product_diffuser_capacity_default") },
        { label: t("product_spec_duration_label"), value: t("product_diffuser_duration_default") },
        { label: t("product_spec_origin_label"), value: t("product_spec_origin_value") },
      ];
    }
    return [
      { label: t("product_spec_construction_label"), value: t("product_spec_construction_value") },
      { label: t("product_spec_origin_label"), value: t("product_spec_origin_value") },
      { label: t("product_spec_packaging_label"), value: t("product_spec_packaging_value") },
    ];
  }

  function defaultCare(layout) {
    if (layout === "diffuser") {
      return [t("product_usage_diffuser_1"), t("product_usage_diffuser_2")];
    }
    if (layout === "perfume" || layout === "gift") return [];
    if (layout === "object") {
      return [t("product_care_object_1"), t("product_care_object_2")];
    }
    return [t("product_care_candle_1"), t("product_care_candle_2"), t("product_care_candle_3")];
  }

  function defaultShipping() {
    return [t("product_ship_1"), t("product_ship_2"), t("product_ship_3"), t("product_ship_4")];
  }

  function priceHtml(product) {
    if (window.NostalgiaProducts && window.NostalgiaProducts.isOnSale(product)) {
      return (
        '<p class="product-info__price product-info__price--sale">' +
        '<span class="product-info__price-was">€' +
        Number(product.price).toFixed(2) +
        "</span>" +
        '<span class="product-info__price-now">€' +
        Number(product.salePrice).toFixed(2) +
        "</span></p>"
      );
    }
    if (product.price != null) {
      return '<p class="product-info__price">€' + Number(product.price).toFixed(2) + "</p>";
    }
    return "";
  }

  function iconSvg(name) {
    if (window.NostalgiaProductIcons && typeof window.NostalgiaProductIcons.svg === "function") {
      return window.NostalgiaProductIcons.svg(name);
    }
    return "";
  }

  function paragraphsHtml(text) {
    return String(text || "")
      .split(/\n{2,}|\n/)
      .filter(function (s) {
        return s.trim();
      })
      .map(function (p) {
        return "<p>" + escapeHtml(p) + "</p>";
      })
      .join("");
  }

  function accordion(titleKey, innerHtml, open) {
    var accIcon =
      window.NostalgiaProductIcons && typeof window.NostalgiaProductIcons.accordionIcon === "function"
        ? window.NostalgiaProductIcons.accordionIcon(titleKey)
        : "doc";
    return (
      '<details class="product-acc"' +
      (open ? " open" : "") +
      ">" +
      '<summary class="product-acc__summary">' +
      iconSvg(accIcon) +
      '<span class="product-acc__label" data-i18n="' +
      titleKey +
      '">' +
      t(titleKey) +
      "</span>" +
      '<svg class="product-acc__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</summary>" +
      '<div class="product-acc__body">' +
      innerHtml +
      "</div>" +
      "</details>"
    );
  }

  function buildBadgesHtml(badges, details) {
    var icons =
      window.NostalgiaProductIcons && typeof window.NostalgiaProductIcons.badgeIcons === "function"
        ? window.NostalgiaProductIcons.badgeIcons(details.layout, details.catId)
        : [];
    return (
      '<ul class="product-info__badges">' +
      badges
        .map(function (b, i) {
          return (
            '<li class="product-info__badge">' +
            iconSvg(icons[i] || icons[0] || "hand") +
            "<span>" +
            escapeHtml(b) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function buildFeaturesHtml(details) {
    if (details.layout === "gift" && details.includes.length) {
      return (
        '<div class="product-info__includes">' +
        '<p class="product-info__includes-label" data-i18n="product_includes_label">' +
        t("product_includes_label") +
        "</p>" +
        '<ul class="product-info__features">' +
        details.includes
          .map(function (item, i) {
            return (
              "<li>" +
              iconSvg(
                (window.NostalgiaProductIcons &&
                  window.NostalgiaProductIcons.featureIcons("gift", details.catId, details.includes.length)[i]) ||
                  "gift"
              ) +
              "<span>" +
              escapeHtml(item) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul></div>"
      );
    }

    if (details.layout === "perfume" && details.scentNotes) {
      var notes = details.scentNotes;
      var items = [];
      if (notes.top) items.push(t("product_scent_top") + ": " + notes.top);
      if (notes.heart) items.push(t("product_scent_heart") + ": " + notes.heart);
      if (notes.base) items.push(t("product_scent_base") + ": " + notes.base);
      if (!items.length) items = details.features;
      return buildFeatureList(items, details);
    }

    if (details.layout === "diffuser" && details.diffuser) {
      var d = details.diffuser;
      var dItems = [];
      if (d.notes) dItems.push(t("product_diffuser_notes") + ": " + d.notes);
      if (d.duration) dItems.push(t("product_diffuser_duration") + ": " + d.duration);
      if (d.capacity) dItems.push(t("product_diffuser_capacity") + ": " + d.capacity);
      if (!dItems.length) dItems = details.features;
      return buildFeatureList(dItems, details);
    }

    return buildFeatureList(details.features, details);
  }

  function buildFeatureList(items, details) {
    if (!items || !items.length) return "";
    var icons =
      window.NostalgiaProductIcons && typeof window.NostalgiaProductIcons.featureIcons === "function"
        ? window.NostalgiaProductIcons.featureIcons(details.layout, details.catId, items.length)
        : [];
    var mode =
      window.NostalgiaProductIcons && typeof window.NostalgiaProductIcons.featureLayoutMode === "function"
        ? window.NostalgiaProductIcons.featureLayoutMode(details.layout)
        : "stack";
    return (
      '<ul class="product-info__features product-info__features--' +
      mode +
      '">' +
      items
        .map(function (f, i) {
          return (
            "<li>" +
            iconSvg(icons[i] || "check") +
            "<span>" +
            escapeHtml(f) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function buildAccordions(details) {
    var descBody = paragraphsHtml(details.longDescription);
    var specsBody =
      '<dl class="product-specs">' +
      details.specs
        .map(function (s) {
          return (
            '<div class="product-specs__row"><dt>' +
            escapeHtml(s.label) +
            "</dt><dd>" +
            escapeHtml(s.value) +
            "</dd></div>"
          );
        })
        .join("") +
      "</dl>";
    var careBody = details.care.map(function (c) {
      return "<p>" + escapeHtml(c) + "</p>";
    }).join("");
    var shipBody =
      '<ul class="product-info__ship-list">' +
      details.shipping
        .map(function (line) {
          return "<li>" + escapeHtml(line) + "</li>";
        })
        .join("") +
      "</ul>";

    var parts = [accordion("product_acc_description", descBody, true)];
    parts.push(accordion("product_acc_specs", specsBody, false));

    if (details.layout === "diffuser" && careBody) {
      parts.push(accordion("product_acc_usage", careBody, false));
    } else if (details.layout === "candle" || details.layout === "object") {
      parts.push(accordion("product_acc_care", careBody, false));
    }

    parts.push(accordion("product_acc_shipping", shipBody, false));
    return '<div class="product-accordions">' + parts.join("") + "</div>";
  }

  function buildProductInfo(product) {
    var details = mergeDetails(product);
    var available = product.stock == null || Number(product.stock) > 0;
    var limitedSignal = product.limited
      ? '<span class="product-info__limited-signal"><span class="product-info__limited-dot" aria-hidden="true"></span>' +
        (product.stock != null
          ? (curLang() === "en" ? "Limited batch · " : "Περιορισμένη σειρά · ") + String(product.stock) + (curLang() === "en" ? " left" : " διαθέσιμα")
          : (curLang() === "en" ? "Limited batch" : "Περιορισμένη σειρά")) +
        "</span>"
      : "";
    var meta =
      '<div class="product-info__meta">' +
      priceHtml(product) +
      (available
        ? '<span class="product-info__avail" data-i18n="product_availability">' + t("product_availability") + "</span>"
        : '<span class="product-info__avail product-info__avail--out" data-i18n="product_out_of_stock">' + t("product_out_of_stock") + "</span>") +
      (product.sku
        ? '<span class="product-info__sku">SKU: ' + escapeHtml(product.sku) + "</span>"
        : "") +
      limitedSignal +
      '<span class="product-info__proof" id="product-info-proof" hidden></span>' +
      "</div>";

    var shortDesc = details.description
      ? '<p class="product-info__desc">' + escapeHtml(details.description) + "</p>"
      : "";

    return {
      meta: meta,
      tags: buildBadgesHtml(details.badges, details),
      shortDesc: shortDesc,
      features: buildFeaturesHtml(details),
      scentJourney: buildScentJourneyHtml(details),
      variants: buildVariantsHtml(product) || buildColorLine(product, details),
      accordions: buildAccordions(details),
      layoutClass: "product-info--" + details.layout,
    };
  }

  function buildScentJourneyHtml(details) {
    if (!details || !details.scentNotes || typeof details.scentNotes !== "object") return "";
    var notes = details.scentNotes;
    var stages = [
      { key: "product_scent_top", icon: "✦", value: notes.top },
      { key: "product_scent_heart", icon: "◌", value: notes.heart },
      { key: "product_scent_base", icon: "⌁", value: notes.base },
    ].filter(function (stage) { return stage.value && String(stage.value).trim(); });
    if (!stages.length) return "";
    return (
      '<section class="product-scent-journey" aria-labelledby="product-scent-journey-title">' +
      '<p class="product-scent-journey__eyebrow">' + (curLang() === "en" ? "The fragrance journey" : "Η διαδρομή του αρώματος") + "</p>" +
      '<h2 class="product-scent-journey__title" id="product-scent-journey-title">' + (curLang() === "en" ? "Let the scent unfold" : "Άφησε το άρωμα να ξεδιπλωθεί") + "</h2>" +
      '<div class="product-scent-journey__track">' +
      stages.map(function (stage, i) {
        return (
          '<article class="product-scent-journey__stage product-scent-journey__stage--' + i + '">' +
          '<span class="product-scent-journey__mark" aria-hidden="true">' + stage.icon + "</span>" +
          '<p class="product-scent-journey__label">' + t(stage.key) + "</p>" +
          '<p class="product-scent-journey__value">' + escapeHtml(stage.value) + "</p>" +
          "</article>"
        );
      }).join("") +
      "</div></section>"
    );
  }

  /* Resolve a single colour for products that don't have colour variants:
     the admin-chosen colour family wins, else a single detected colour. */
  function resolveSingleColor(product, details) {
    var famId = (details && details.colorFamily) || "";
    var P = window.NostalgiaProducts;
    if (!famId && P && typeof P.getColorFamilies === "function") {
      var fams = P.getColorFamilies(product);
      if (fams.length === 1) famId = fams[0];
    }
    if (!famId) return null;
    var label = t("color_" + famId);
    if (label === "color_" + famId) return null;
    var meta = P && typeof P.getColorMeta === "function" ? P.getColorMeta(famId) : null;
    return { id: famId, label: label, hex: meta ? meta.hex : "" };
  }

  function colorSwatchStyle(c) {
    if (c.id === "multi") {
      return ' style="background:conic-gradient(#b0342c,#e3c65b,#4a7a4e,#a9cbe0,#6b4a7a,#b0342c)"';
    }
    if (c.id === "transparent" || !c.hex) {
      return ' style="background:#f2f2f2"';
    }
    return ' style="--sw:' + escapeHtml(c.hex) + '"';
  }

  /* A read-only "Χρώμα: <label>" line with a swatch, shown in the same visible
     spot as the variant selector for single-colour products. */
  function buildColorLine(product, details) {
    var c = resolveSingleColor(product, details);
    if (!c) return "";
    return (
      '<div class="product-info__variants product-info__variants--static">' +
      '<p class="product-info__variants-label"><span data-i18n="product_color">' + t("product_color") + "</span>: " +
      "<strong>" + escapeHtml(c.label) + "</strong></p>" +
      '<div class="product-info__swatches">' +
      '<span class="product-swatch product-swatch--static is-active"' + colorSwatchStyle(c) + ' title="' + escapeHtml(c.label) + '" aria-hidden="true"></span>' +
      "</div></div>"
    );
  }

  function buildVariantsHtml(product) {
    /* New colour-variant model (product_variants table). */
    var list = product.variants;
    if (Array.isArray(list) && list.length >= 2) {
      var activeId = product.activeVariantId || product.id;
      return (
        '<div class="product-info__variants">' +
        '<p class="product-info__variants-label"><span data-i18n="product_color">' + t("product_color") + "</span>: " +
        '<strong class="js-variant-label">' + escapeHtml(product.variantColorLabel || "") + "</strong></p>" +
        '<div class="product-info__swatches">' +
        list
          .map(function (v) {
            var label = (curLang() === "en" && v.colorEn && String(v.colorEn).trim()) ? v.colorEn : (v.color || "");
            var active = v.id === activeId;
            var soldOut = v.available === false || (v.stock != null && v.stock <= 0);
            return (
              '<a class="product-swatch' + (active ? " is-active" : "") + (soldOut ? " is-soldout" : "") +
              '" href="/product/' + encodeURIComponent(v.id) + '" style="--sw:' + escapeHtml(v.colorHex || "#ccc") +
              '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '"' +
              (active ? ' aria-current="true"' : "") + "></a>"
            );
          })
          .join("") +
        "</div></div>"
      );
    }
    /* Legacy sibling-colour model (products linked by details.variantGroup). */
    var group = product.variantGroup;
    if (!Array.isArray(group) || group.length < 2) return "";
    return (
      '<div class="product-info__variants">' +
      '<p class="product-info__variants-label"><span data-i18n="product_color">' + t("product_color") + "</span>: " +
      '<strong>' + escapeHtml(product.variantLabel || "") + "</strong></p>" +
      '<div class="product-info__swatches">' +
      group
        .map(function (v) {
          var active = v.id === product.id;
          return (
            '<a class="product-swatch' + (active ? " is-active" : "") +
            '" href="/product/' + encodeURIComponent(v.id) + '" style="--sw:' + escapeHtml(v.hex || "#ccc") +
            '" title="' + escapeHtml(v.label) + '" aria-label="' + escapeHtml(v.label) + '"' +
            (active ? ' aria-current="true"' : "") + "></a>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }

  function toggleRitualSection(product) {
    var ritual = document.getElementById("product-ritual-section");
    if (!ritual) return;
    var show = getLayoutType(product) === "candle" || getLayoutType(product) === "object";
    ritual.hidden = !show;
  }

  function galleryWebp(png, width) {
    if (
      window.NostalgiaImages &&
      typeof window.NostalgiaImages.webp === "function" &&
      /\.png$/i.test(png) &&
      (typeof window.NostalgiaImages.hasDerivatives !== "function" ||
        window.NostalgiaImages.hasDerivatives(png))
    ) {
      return window.NostalgiaImages.webp(png, width);
    }
    return png;
  }

  /* Skroutz-style hover magnifier: a circular lens that shows a zoomed-in
     region of the main image, following the cursor. Desktop (fine pointer)
     only — touch devices skip it. Called again on image change to refresh
     the lens source. */
  function setupZoom(figure, src) {
    var lens = figure.querySelector("#product-zoom-lens");
    var main = figure.querySelector("#product-gallery-main");
    var img = figure.querySelector("#product-gallery-img");
    if (!lens || !main || !img) return;
    lens.style.backgroundImage = "url('" + galleryWebp(src, 1440).replace(/'/g, "%27") + "')";
    if (figure._zoomBound) return;
    var fine = !window.matchMedia || window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    figure._zoomBound = true;
    var ZOOM = 2.3;
    main.addEventListener("mousemove", function (e) {
      /* Keep loupe off nav hit-targets so arrows stay clickable. */
      if (e.target && e.target.closest && e.target.closest(".product-gallery__nav")) {
        lens.classList.remove("is-active");
        return;
      }
      var rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        lens.classList.remove("is-active");
        return;
      }
      lens.classList.add("is-active");
      var lw = lens.offsetWidth;
      var lh = lens.offsetHeight;
      var mainRect = main.getBoundingClientRect();
      var offX = rect.left - mainRect.left;
      var offY = rect.top - mainRect.top;
      var lx = Math.max(0, Math.min(x - lw / 2, rect.width - lw));
      var ly = Math.max(0, Math.min(y - lh / 2, rect.height - lh));
      lens.style.left = offX + lx + "px";
      lens.style.top = offY + ly + "px";
      lens.style.backgroundSize = rect.width * ZOOM + "px " + rect.height * ZOOM + "px";
      var cx = lx + lw / 2;
      var cy = ly + lh / 2;
      lens.style.backgroundPosition =
        "-" + (cx * ZOOM - lw / 2) + "px -" + (cy * ZOOM - lh / 2) + "px";
    });
    main.addEventListener("mouseleave", function () {
      lens.classList.remove("is-active");
    });
  }

  function renderGallery(figure, product) {
    var imgs = (product.images && product.images.length ? product.images : [product.image]).filter(Boolean);
    if (!imgs.length) return;
    var alt = escapeHtml(pageHeading(product));
    var multi = imgs.length > 1;
    var arrows = multi
      ? '<button type="button" class="product-gallery__nav product-gallery__nav--prev" id="product-gallery-prev" aria-label="Previous image">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" class="product-gallery__nav product-gallery__nav--next" id="product-gallery-next" aria-label="Next image">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      : "";
    var saleTag =
      window.NostalgiaProducts && window.NostalgiaProducts.isOnSale(product)
        ? '<span class="product-sale-badge">-' + window.NostalgiaProducts.discountPercent(product) + "%</span>"
        : "";
    var html =
      '<div class="product-gallery__stage">' +
      '<div class="product-gallery__main" id="product-gallery-main">' +
      saleTag +
      '<img class="product-gallery__img" id="product-gallery-img" src="' +
      escapeHtml(galleryWebp(imgs[0], 960)) +
      '" alt="' + alt + '" fetchpriority="high" decoding="async" />' +
      '<div class="product-zoom-lens" id="product-zoom-lens" aria-hidden="true"></div>' +
      "</div>" +
      arrows +
      "</div>";
    if (multi) {
      html += '<ul class="product-gallery__thumbs">';
      imgs.forEach(function (src, i) {
        html +=
          '<li><button type="button" class="product-gallery__thumb' + (i === 0 ? " is-active" : "") +
          '" data-i="' + i + '" aria-label="' + (i + 1) + '">' +
          '<img src="' + escapeHtml(galleryWebp(src, 480)) + '" alt="" loading="lazy" decoding="async" /></button></li>';
      });
      html += "</ul>";
    }
    figure.innerHTML = html;
    figure._zoomBound = false;

    var mainImg = figure.querySelector("#product-gallery-img");
    var thumbs = figure.querySelectorAll(".product-gallery__thumb");
    var current = 0;

    setupZoom(figure, imgs[0]);

    function select(i) {
      current = (i + imgs.length) % imgs.length;
      if (mainImg) mainImg.src = galleryWebp(imgs[current], 960);
      setupZoom(figure, imgs[current]);
      thumbs.forEach(function (b, bi) {
        b.classList.toggle("is-active", bi === current);
      });
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        select(parseInt(btn.getAttribute("data-i"), 10) || 0);
      });
    });

    if (multi) {
      var prev = figure.querySelector("#product-gallery-prev");
      var next = figure.querySelector("#product-gallery-next");
      if (prev) prev.addEventListener("click", function () { select(current - 1); });
      if (next) next.addEventListener("click", function () { select(current + 1); });
    }
  }

  var currentProduct = null;

  function renderProduct(product) {
    var root = document.getElementById("product-page-root");
    if (!root) return;

    currentProduct = product;
    document.title = pageHeading(product) + " · Nostalgia Collection";

    var info = buildProductInfo(product);

    root.innerHTML =
      '<div class="product-page__layout">' +
      '  <figure class="product-gallery candle-hover" id="product-gallery-figure"></figure>' +
      '  <div class="product-info ' +
      info.layoutClass +
      '">' +
      '    <h1 class="product-info__title">' +
      escapeHtml(pageHeading(product)) +
      "</h1>" +
      info.meta +
      info.tags +
      info.shortDesc +
      info.features +
      info.scentJourney +
      info.variants +
      '    <label class="product-info__qty-label" for="product-qty" data-i18n="product_qty_label">' +
      t("product_qty_label") +
      "</label>" +
      '    <div class="product-info__qty-row">' +
      '      <div class="qty-stepper">' +
      '        <button type="button" class="qty-stepper__btn" id="product-qty-minus" aria-label="-">−</button>' +
      '        <input type="number" class="qty-stepper__input" id="product-qty" value="1" min="1" max="99" aria-label="' +
      t("product_qty_label") +
      '" />' +
      '        <button type="button" class="qty-stepper__btn" id="product-qty-plus" aria-label="+">+</button>' +
      "      </div>" +
      "    </div>" +
      '    <div class="product-info__buy-actions">' +
      '      <button type="button" class="btn-shop btn-shop--primary" id="product-add-cart" data-i18n="product_add_cart">' +
      t("product_add_cart") +
      "</button>" +
      '      <button type="button" class="btn-shop btn-shop--buy" id="product-buy-now" data-i18n="product_buy_now">' +
      t("product_buy_now") +
      "</button>" +
      '      <button type="button" class="btn-shop btn-shop--ghost" id="product-toggle-wishlist">' +
      getWishlistLabel(product.id) +
      "</button>" +
      "    </div>" +
      info.accordions +
      "  </div>" +
      "</div>" +
      renderReviewsHTML(product) +
      renderRelatedHTML(product);

    mountRelatedCarousel();
    mountRelatedMotion();

    var galleryFigure = document.getElementById("product-gallery-figure");
    if (galleryFigure) {
      renderGallery(galleryFigure, product);
    }

    /* Colour swatches: swap in place (no page reload) — the sibling colour is
       already loaded, so we just re-render and update the URL. */
    root.querySelectorAll(".product-swatch[href]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        var href = link.getAttribute("href") || "";
        var m = href.match(/\/product\/([^/?#]+)/);
        if (m) showVariant(decodeURIComponent(m[1]));
      });
    });

    var qtyInput = document.getElementById("product-qty");
    document.getElementById("product-qty-minus").addEventListener("click", function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
    });
    document.getElementById("product-qty-plus").addEventListener("click", function () {
      qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
    });

    document.getElementById("product-add-cart").addEventListener("click", function () {
      var qty = parseInt(qtyInput.value, 10) || 1;
      window.NostalgiaCart.addAndNotify(product.id, qty);
    });

    document.getElementById("product-buy-now").addEventListener("click", function () {
      var qty = parseInt(qtyInput.value, 10) || 1;
      window.NostalgiaCart.addItem(product.id, qty);
      window.location.href = "/checkout";
    });

    var wishlistBtn = document.getElementById("product-toggle-wishlist");
    if (wishlistBtn) {
      wishlistBtn.addEventListener("click", function () {
        if (window.NostalgiaWishlist) window.NostalgiaWishlist.toggle(product.id, wishlistBtn);
        wishlistBtn.textContent = getWishlistLabel(product.id);
      });
    }

    bindReviews(product);
    loadReviews(product);
    toggleRitualSection(product);

    var layout = root.querySelector(".product-page__layout");
    if (layout) layout.classList.add("is-visible");
    root.querySelectorAll(".product-reviews, .related-products, .product-not-found").forEach(function (el) {
      el.classList.add("is-visible");
    });

    revealProductContent(root);
    clearStuckUi();

    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.refreshReveal === "function") {
      window.NostalgiaPolish.refreshReveal();
    }

    updateProductBreadcrumbs([
      { labelKey: "nav_home", href: "/" },
      { labelKey: "nav_collection", href: "/collection" },
      { labelKey: "collection_" + product.catId, href: "/collection#" + product.catId },
      { text: pageHeading(product) },
    ]);
  }

  function getWishlistLabel(id) {
    var has = window.NostalgiaWishlist && window.NostalgiaWishlist.has(id);
    return has ? "♥ " + t("wishlist_remove") : "♡ " + t("wishlist_add");
  }

  function getReviews(productId) {
    try {
      var all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}");
      return Array.isArray(all[productId]) ? all[productId] : [];
    } catch (e) {
      return [];
    }
  }

  function saveReview(productId, review) {
    try {
      var all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}");
      if (!Array.isArray(all[productId])) all[productId] = [];
      all[productId].unshift(review);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Anonymous per-browser session used only to prevent trivial repeat votes
     on "was this helpful?" — no account needed. */
  function voterKey() {
    var KEY = "nostalgia-voter-key";
    try {
      var v = localStorage.getItem(KEY);
      if (v) return v;
      v = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, v);
      return v;
    } catch (e) {
      return "v-session";
    }
  }
  function votedReviewIds() {
    try {
      return JSON.parse(localStorage.getItem("nostalgia-helpful-voted") || "[]");
    } catch (e) {
      return [];
    }
  }
  function markVoted(id) {
    try {
      var ids = votedReviewIds();
      if (ids.indexOf(id) === -1) {
        ids.push(id);
        localStorage.setItem("nostalgia-helpful-voted", JSON.stringify(ids));
      }
    } catch (e) {}
  }

  /* The logged-in session api.js already syncs into localStorage — reused
     here only to auto-fill/lock the reviewer name, never to skip server-side
     verification (that always re-checks the account's own delivered orders). */
  function currentSession() {
    try {
      var raw = sessionStorage.getItem("nostalgia-session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* A "rate your order" link (e.g. from the order-tracking page) can carry
     ?reviewToken=... — the same guest order-access token already used for
     tracking, reused here to verify the purchase without a new email flow. */
  function reviewTokenFromUrl() {
    try {
      return new URLSearchParams(location.search).get("reviewToken") || "";
    } catch (e) {
      return "";
    }
  }

  function starsHTML(rating, cls) {
    var full = Math.max(0, Math.min(5, Math.round(rating)));
    return '<span class="' + (cls || "product-reviews__stars") + '" aria-hidden="true">' +
      "★".repeat(full) + "☆".repeat(5 - full) + "</span>";
  }

  function distributionHTML(distribution, total) {
    if (!total) return "";
    var rows = [5, 4, 3, 2, 1].map(function (n) {
      var count = (distribution && distribution[n]) || 0;
      var pct = total ? Math.round((count / total) * 100) : 0;
      return (
        '<div class="product-reviews__dist-row">' +
        '<span class="product-reviews__dist-label">' + n + " ★</span>" +
        '<span class="product-reviews__dist-bar"><span style="width:' + pct + '%"></span></span>' +
        '<span class="product-reviews__dist-count">' + count + "</span>" +
        "</div>"
      );
    }).join("");
    return '<div class="product-reviews__dist">' + rows + "</div>";
  }

  function reviewItemHTML(r) {
    var title = r.title ? '<h3 class="product-reviews__card-title">' + escapeHtml(r.title) + "</h3>" : "";
    var verified = r.isVerifiedPurchase
      ? '<span class="product-reviews__verified-pill">✓ ' + escapeHtml(t("reviews_verified_purchase_short")) + "</span>"
      : "";
    var date = r.createdAt
      ? '<span class="product-reviews__date">' + escapeHtml(new Date(r.createdAt).toLocaleDateString(document.documentElement.lang === "en" ? "en-GB" : "el-GR")) + "</span>"
      : "";
    var reply = r.reply
      ? '<div class="product-reviews__reply"><strong>' + escapeHtml(t("reviews_store_reply")) + "</strong><p>" + escapeHtml(r.reply.body) + "</p></div>"
      : "";
    var voted = votedReviewIds().indexOf(r.id) !== -1;
    var helpful =
      '<button type="button" class="product-reviews__helpful" data-helpful-id="' + escapeHtml(r.id) + '"' + (voted ? " disabled" : "") + ">" +
      escapeHtml(t("reviews_helpful_question")) + " " + escapeHtml(t("reviews_helpful_yes")) +
      ' <span class="product-reviews__helpful-count">' + (r.helpfulCount || 0) + "</span></button>";
    return (
      '<article class="product-reviews__card">' +
      starsHTML(r.rating, "product-reviews__card-stars") +
      title +
      "<p class=\"product-reviews__card-text\">" + escapeHtml(r.text) + "</p>" +
      '<div class="product-reviews__card-meta">' +
      '<span><strong class="product-reviews__name">' + escapeHtml(r.name) + "</strong> · " + date + "</span>" +
      verified +
      "</div>" +
      reply +
      helpful +
      "</article>"
    );
  }

  function reviewListHTML(reviews) {
    if (!reviews.length) {
      return '<p class="product-reviews__empty">' + t("reviews_empty") + "</p>";
    }
    return reviews.map(reviewItemHTML).join("");
  }

  function renderReviewsHTML(product) {
    return (
      '<section class="product-reviews">' +
      "  <h2>" + t("reviews_title") + "</h2>" +
      '  <div class="product-reviews__top">' +
      '    <div class="product-reviews__rating-block" id="product-reviews-summary">' +
      '      <div class="product-reviews__avg-row"><span class="product-reviews__avg">0.0</span><span class="product-reviews__avg-max">/5</span></div>' +
      starsHTML(0, "product-reviews__avg-stars") +
      '      <span class="product-reviews__total">0 ' + t("reviews_count") + "</span>" +
      '      <span class="product-reviews__trust-badge">' + t("reviews_trust_badge") + "</span>" +
      "    </div>" +
      '    <div class="product-reviews__dist" id="product-reviews-dist"></div>' +
      '    <div class="product-reviews__cta">' +
      '      <p class="product-reviews__cta-note">' + t("reviews_verified_purchase_note") +
      ' <a href="/review-policy">' + t("reviews_moderation_link") + "</a></p>" +
      '      <button type="button" class="btn-shop btn-shop--primary" id="review-toggle" aria-expanded="false">' + t("reviews_write_review_cta") + "</button>" +
      "    </div>" +
      "  </div>" +

      '  <form class="product-reviews__form" id="product-review-form" hidden>' +
      '    <div class="product-reviews__star-input" id="review-star-input" role="radiogroup" aria-label="' + t("reviews_select_rating") + '">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<button type="button" class="product-reviews__star-btn" data-star="' + n + '" aria-label="' + n + ' ★">☆</button>';
      }).join("") +
      '      <span class="product-reviews__star-hint" id="review-star-hint">' + t("reviews_select_rating") + "</span>" +
      "    </div>" +
      '    <input type="hidden" id="review-rating" value="0" />' +

      '    <label class="product-reviews__field"><span>' + t("reviews_name") + '</span><input id="review-name" type="text" maxlength="80" autocomplete="name" /></label>' +
      '    <label class="product-reviews__field"><span>' + t("reviews_title_field") + '</span>' +
      '      <input id="review-title" type="text" maxlength="80" autocomplete="off" />' +
      '      <span class="product-reviews__hint">' + t("reviews_title_hint") + "</span>" +
      "    </label>" +
      '    <label class="product-reviews__field"><span>' + t("reviews_placeholder") + '</span>' +
      '      <textarea id="review-text" maxlength="2000"></textarea>' +
      '      <span class="product-reviews__hint">' + t("reviews_text_hint") + "</span>" +
      "    </label>" +

      '    <button type="submit" class="btn-shop btn-shop--primary">' + t("reviews_submit") + "</button>" +
      '    <button type="button" class="product-reviews__cancel" id="review-cancel">' + t("reviews_close_form") + "</button>" +
      '    <p class="product-reviews__feedback" id="review-feedback" hidden></p>' +
      "  </form>" +

      '  <div class="product-reviews__controls" id="product-reviews-controls" hidden>' +
      '    <label>' + t("reviews_sort_label") + ':' +
      '      <select id="review-sort">' +
      '        <option value="rating_high" selected>' + t("reviews_sort_rating") + "</option>" +
      '        <option value="newest">' + t("reviews_sort_date") + "</option>" +
      '        <option value="rating_low">' + t("reviews_sort_rating_low") + "</option>" +
      '        <option value="helpful">' + t("reviews_sort_helpful") + "</option>" +
      "      </select>" +
      "    </label>" +
      '    <label class="product-reviews__verified-filter"><input type="checkbox" id="review-verified-only" /> ' + t("reviews_verified_only") +
      ' <span class="product-reviews__info-icon" title="' + t("reviews_verified_purchase_note") + '">ⓘ</span></label>' +
      "  </div>" +

      '  <div class="product-reviews__grid" id="product-reviews-list"></div>' +
      '  <button type="button" class="product-reviews__show-more" id="review-show-more" hidden>' + t("reviews_show_more") + "</button>" +
      '  <p class="product-reviews__footnote">' +
      '    <span class="product-reviews__footnote-icon" aria-hidden="true">' +
      '      <svg viewBox="0 0 24 24" focusable="false"><path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10"/><rect x="5" y="10" width="14" height="10" rx="1.5"/><path d="M12 14v2.5"/></svg>' +
      "    </span>" +
      '    <span>' + t("reviews_verified_purchase_note") + "</span>" +
      "  </p>" +
      "</section>"
    );
  }

  function paintReviews(product, data) {
    var summaryEl = document.getElementById("product-reviews-summary");
    var distEl = document.getElementById("product-reviews-dist");
    var list = document.getElementById("product-reviews-list");
    var controls = document.getElementById("product-reviews-controls");
    var showMore = document.getElementById("review-show-more");
    var summary = data.summary || { average: 0, total: 0, distribution: {} };
    var reviews = data.reviews || [];
    var proofEl = document.getElementById("product-info-proof");
    if (proofEl) {
      proofEl.hidden = !(summary.total > 0);
      proofEl.textContent = summary.total > 0
        ? (curLang() === "en"
          ? "Loved by " + summary.total + " customer" + (summary.total === 1 ? "" : "s")
          : "Αγαπήθηκε από " + summary.total + " " + (summary.total === 1 ? "πελάτη" : "πελάτες"))
        : "";
    }

    if (summaryEl) {
      summaryEl.innerHTML =
        '<div class="product-reviews__avg-row"><span class="product-reviews__avg">' + summary.average.toFixed(1) + '</span><span class="product-reviews__avg-max">/5</span></div>' +
        starsHTML(summary.average, "product-reviews__avg-stars") +
        '<span class="product-reviews__total">' + summary.total + " " + t("reviews_count") + "</span>" +
        '<span class="product-reviews__trust-badge">' + t("reviews_trust_badge") + "</span>";
    }
    if (distEl) distEl.innerHTML = distributionHTML(summary.distribution, summary.total);
    if (controls) controls.hidden = summary.total === 0;
    if (list) list.innerHTML = reviewListHTML(reviews);
    /* "Show more" reveals everything in one click (limit widened) — once
       every review is already showing, the button just disappears. */
    if (showMore) showMore.hidden = reviews.length >= summary.total;
    bindHelpfulButtons();
  }

  function bindHelpfulButtons() {
    document.querySelectorAll("[data-helpful-id]").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-helpful-id");
        if (!window.NostalgiaAPI || !window.NostalgiaAPI.isAvailable()) return;
        window.NostalgiaAPI.post("/api/reviews/" + encodeURIComponent(id) + "/helpful", { voterKey: voterKey() })
          .then(function (res) {
            if (!res.ok) return;
            markVoted(id);
            btn.disabled = true;
            var countEl = btn.querySelector(".product-reviews__helpful-count");
            if (countEl) countEl.textContent = res.helpfulCount;
          })
          .catch(function () {});
      });
    });
  }

  /* Shows the 3 best (highest-rated) reviews by default. "Show more" widens
     the limit in one step rather than paging 3-at-a-time, so one click
     reveals the rest instead of many small clicks. */
  var REVIEWS_DEFAULT_LIMIT = 3;
  var REVIEWS_EXPANDED_LIMIT = 200;
  var reviewQuery = { limit: REVIEWS_DEFAULT_LIMIT, sort: "rating_high", verifiedOnly: false };

  function loadReviews(product) {
    if (!(window.NostalgiaAPI && window.NostalgiaAPI.isAvailable())) {
      /* Offline fallback — best-effort local reviews, no pagination/summary. */
      var local = getReviews(product.id);
      var avg = local.length ? local.reduce(function (s, r) { return s + r.rating; }, 0) / local.length : 0;
      paintReviews(product, { summary: { average: avg, total: local.length, distribution: {} }, reviews: local });
      return;
    }
    var qs = "page=1&limit=" + reviewQuery.limit + "&sort=" + reviewQuery.sort + (reviewQuery.verifiedOnly ? "&verifiedOnly=true" : "");
    window.NostalgiaAPI.get("/api/products/" + encodeURIComponent(product.id) + "/reviews?" + qs)
      .then(function (res) {
        if (res.ok) paintReviews(product, res);
      })
      .catch(function () {});
  }

  function showReviewFeedback(message, isError) {
    var fb = document.getElementById("review-feedback");
    if (!fb) return;
    fb.textContent = message;
    fb.hidden = false;
    fb.classList.toggle("is-error", !!isError);
    fb.classList.toggle("is-success", !isError);
  }

  var REVIEW_ERROR_KEYS = {
    invalid_rating: "reviews_error_rating",
    title_too_short: "reviews_error_title_short",
    text_too_short: "reviews_error_text_short",
    already_reviewed: "reviews_error_duplicate",
    contains_link: "reviews_error_content",
    contains_personal_data: "reviews_error_content",
    too_many_attempts: "reviews_error_generic",
  };

  function bindReviews(product) {
    var form = document.getElementById("product-review-form");
    var toggle = document.getElementById("review-toggle");
    var cancel = document.getElementById("review-cancel");
    var starInput = document.getElementById("review-star-input");
    var starHint = document.getElementById("review-star-hint");
    var ratingEl = document.getElementById("review-rating");
    var nameEl = document.getElementById("review-name");
    var sortEl = document.getElementById("review-sort");
    var verifiedOnlyEl = document.getElementById("review-verified-only");
    var showMoreBtn = document.getElementById("review-show-more");
    if (!form || !toggle) return;

    /* Logged-in shoppers get a locked, auto-filled display name — their
       account is what gets checked server-side for a verified purchase, so
       the name shown must match it (no impersonating a different name). */
    var session = currentSession();
    if (session && nameEl) {
      var display = [session.firstname, (session.lastname || "").slice(0, 1)].filter(Boolean).join(" ");
      nameEl.value = display || session.email;
      nameEl.readOnly = true;
    }

    toggle.addEventListener("click", function () {
      var opening = form.hidden;
      form.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));
      toggle.hidden = opening;
      if (opening) {
        var textEl = document.getElementById("review-text");
        if (textEl) textEl.focus();
      }
    });
    if (cancel) {
      cancel.addEventListener("click", function () {
        form.hidden = true;
        toggle.hidden = false;
        toggle.setAttribute("aria-expanded", "false");
      });
    }

    if (starInput) {
      var stars = Array.prototype.slice.call(starInput.querySelectorAll("[data-star]"));
      function paintStars(n) {
        stars.forEach(function (s) {
          var v = parseInt(s.getAttribute("data-star"), 10);
          s.textContent = v <= n ? "★" : "☆";
          s.classList.toggle("is-filled", v <= n);
        });
      }
      stars.forEach(function (s) {
        s.addEventListener("click", function () {
          var v = parseInt(s.getAttribute("data-star"), 10);
          ratingEl.value = String(v);
          paintStars(v);
          if (starHint) starHint.textContent = v + " ★";
        });
      });
    }

    if (sortEl) {
      sortEl.addEventListener("change", function () {
        reviewQuery.sort = sortEl.value;
        loadReviews(product);
      });
    }
    if (verifiedOnlyEl) {
      verifiedOnlyEl.addEventListener("change", function () {
        reviewQuery.verifiedOnly = verifiedOnlyEl.checked;
        loadReviews(product);
      });
    }
    if (showMoreBtn) {
      showMoreBtn.addEventListener("click", function () {
        reviewQuery.limit = REVIEWS_EXPANDED_LIMIT;
        loadReviews(product);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var titleEl = document.getElementById("review-title");
      var textEl = document.getElementById("review-text");
      var rating = parseInt(ratingEl.value, 10) || 0;
      var title = (titleEl.value || "").trim();
      var text = (textEl.value || "").trim();
      var name = (nameEl.value || "").trim() || "Guest";

      if (!rating) return showReviewFeedback(t("reviews_error_rating"), true);
      if (title.length < 5) return showReviewFeedback(t("reviews_error_title_short"), true);
      if (text.length < 20) return showReviewFeedback(t("reviews_error_text_short"), true);

      if (!(window.NostalgiaAPI && window.NostalgiaAPI.isAvailable())) {
        saveReview(product.id, { name: name, title: title, rating: rating, text: text });
        form.reset();
        showReviewFeedback(t("reviews_thanks"), false);
        loadReviews(product);
        return;
      }

      window.NostalgiaAPI.post("/api/reviews", {
        productId: product.id,
        name: session ? undefined : name,
        title: title,
        rating: rating,
        text: text,
        orderToken: reviewTokenFromUrl(),
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            if (starInput) form.querySelectorAll("[data-star]").forEach(function (s) { s.textContent = "☆"; s.classList.remove("is-filled"); });
            if (starHint) starHint.textContent = t("reviews_select_rating");
            ratingEl.value = "0";
            if (session && nameEl) nameEl.value = [session.firstname, (session.lastname || "").slice(0, 1)].filter(Boolean).join(" ");
            showReviewFeedback(t("reviews_thanks"), false);
          } else {
            var key = REVIEW_ERROR_KEYS[res.error] || "reviews_error_generic";
            showReviewFeedback(t(key), true);
          }
        })
        .catch(function () {
          showReviewFeedback(t("reviews_error_generic"), true);
        });
    });
  }

  function renderRelatedHTML(product) {
    var all =
      window.NostalgiaProducts && typeof window.NostalgiaProducts.getAll === "function"
        ? window.NostalgiaProducts.getAll()
        : [];
    var related = all
      .filter(function (p) {
        return p.catId !== product.catId;
      })
      .sort(function () {
        return Math.random() - 0.5;
      })
      .slice(0, RELATED_PRODUCT_LIMIT);
    if (!related.length) return "";
    var cards = related
      .map(function (item, index) {
        return (
          '<article class="related-card home-collections__carousel-slide" style="--related-index:' + index + '">' +
          '  <a href="/product/' +
          encodeURIComponent(item.id) +
          '">' +
          '    <span class="related-card__media">' +
          '      <img src="' +
          item.image +
          '" alt="' +
          escapeHtml(productTitle(item)) +
          '" loading="lazy" decoding="async" />' +
          "    </span>" +
          "    <h3>" +
          escapeHtml(productTitle(item)) +
          "</h3>" +
          "  </a>" +
          "</article>"
        );
      })
      .join("");
    return (
      '<section class="related-products">' +
      "  <h2>" +
      t("related_title") +
      "</h2>" +
      '  <div class="home-collections__carousel home-collections__carousel--editorial related-products__carousel" id="product-related-carousel">' +
      '    <button type="button" class="home-collections__carousel-nav home-collections__carousel-nav--prev" data-carousel-prev aria-controls="product-related-track" aria-label="' +
      escapeHtml(t("home_carousel_prev") || "Previous") +
      '"><span aria-hidden="true">‹</span></button>' +
      '    <div class="home-collections__carousel-viewport">' +
      '      <div class="related-products__grid home-collections__carousel-track" id="product-related-track">' +
      cards +
      "      </div>" +
      "    </div>" +
      '    <button type="button" class="home-collections__carousel-nav home-collections__carousel-nav--next" data-carousel-next aria-controls="product-related-track" aria-label="' +
      escapeHtml(t("home_carousel_next") || "Next") +
      '"><span aria-hidden="true">›</span></button>' +
      '    <div class="home-collections__carousel-dots" role="tablist"></div>' +
      "  </div>" +
      "</section>"
    );
  }

  function mountRelatedCarousel() {
    if (!window.NostalgiaHomeCarousels || typeof window.NostalgiaHomeCarousels.mount !== "function") {
      return;
    }
    if (!document.getElementById("product-related-carousel")) return;
    window.NostalgiaHomeCarousels.mount("product-related-carousel", {
      perView: function (w) {
        if (w <= 640) return 1;
        if (w <= 900) return 2;
        return 4;
      },
      mediaSelector: ".related-card img",
      dotClass: "home-collections__carousel-dot",
    });
  }

  function mountRelatedMotion() {
    if (relatedMotionObserver) {
      relatedMotionObserver.disconnect();
      relatedMotionObserver = null;
    }

    var section = document.querySelector(".related-products");
    if (!section) return;

    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      section.classList.add("is-related-visible");
      return;
    }

    section.classList.add("related-products--motion-ready");
    relatedMotionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-related-visible");
        relatedMotionObserver.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -7% 0px" });
    relatedMotionObserver.observe(section);
  }

  function clearStuckUi() {
    document.documentElement.classList.remove("page-is-leaving", "page-is-entering");
    document.body.classList.remove("has-quick-view-open");
    document.body.style.overflow = "";
    var qv = document.querySelector(".quick-view.is-open");
    if (qv) {
      qv.classList.remove("is-open");
      qv.setAttribute("aria-hidden", "true");
    }
    if (window.NostalgiaPolish && typeof window.NostalgiaPolish.closeQuickView === "function") {
      window.NostalgiaPolish.closeQuickView();
    }
  }

  /* Switch to a sibling colour-variant product in place (client-side), keeping
     the scroll position and updating the address bar — no navigation/reload. */
  function showVariant(id) {
    if (!window.NostalgiaProducts) return;
    var p = window.NostalgiaProducts.getById(id);
    if (!p) return;
    renderProduct(p);
    try {
      history.pushState({ productId: id }, "", "/product/" + encodeURIComponent(id));
    } catch (e) {
      /* history unavailable — leave URL as-is, swap still happened */
    }
    clearStuckUi();
  }

  window.addEventListener("popstate", function () {
    if (!window.NostalgiaProducts) return;
    var p = window.NostalgiaProducts.getById(getProductId());
    if (p) {
      renderProduct(p);
      clearStuckUi();
    }
  });

  /* Re-render the current product when the visitor switches language, so the
     admin's Greek/English content swaps in place along with the static UI. */
  window.addEventListener("nostalgia-locale-updated", function () {
    if (currentProduct) renderProduct(currentProduct);
  });

  function init() {
    clearStuckUi();
    var id = getProductId();
    if (!window.NostalgiaProducts) {
      if (!init._retries) init._retries = 0;
      if (init._retries++ < 80) {
        window.setTimeout(init, 50);
      }
      return;
    }
    init._retries = 0;
    var product = window.NostalgiaProducts.getById(id);
    if (!product) {
      if (window.NostalgiaAPI && !init._waitedForServer) {
        init._waitedForServer = true;
        var retried = false;
        var retry = function () {
          if (retried) return;
          retried = true;
          init();
        };
        document.addEventListener("nostalgia-products-updated", retry, { once: true });
        window.NostalgiaAPI.ready().then(function (ok) {
          if (!ok) {
            retried = true;
            renderNotFound();
            return;
          }
          window.setTimeout(retry, 800);
        });
        return;
      }
      renderNotFound();
      return;
    }
    renderProduct(product);
    clearStuckUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("load", init);
  window.addEventListener("pageshow", clearStuckUi);
})();
