(function () {
  var REVIEWS_KEY = "nostalgia-reviews";

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
    var meta =
      '<div class="product-info__meta">' +
      priceHtml(product) +
      (available
        ? '<span class="product-info__avail" data-i18n="product_availability">' + t("product_availability") + "</span>"
        : '<span class="product-info__avail product-info__avail--out" data-i18n="product_out_of_stock">' + t("product_out_of_stock") + "</span>") +
      (product.sku
        ? '<span class="product-info__sku">SKU: ' + escapeHtml(product.sku) + "</span>"
        : "") +
      "</div>";

    var shortDesc = details.description
      ? '<p class="product-info__desc">' + escapeHtml(details.description) + "</p>"
      : "";

    return {
      meta: meta,
      tags: buildBadgesHtml(details.badges, details),
      shortDesc: shortDesc,
      features: buildFeaturesHtml(details),
      variants: buildVariantsHtml(product),
      accordions: buildAccordions(details),
      layoutClass: "product-info--" + details.layout,
    };
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
      '<div class="product-gallery__main" id="product-gallery-main">' +
      saleTag +
      '<img class="product-gallery__img" id="product-gallery-img" src="' +
      escapeHtml(galleryWebp(imgs[0], 960)) +
      '" alt="' + alt + '" fetchpriority="high" decoding="async" />' +
      '<div class="product-zoom-lens" id="product-zoom-lens" aria-hidden="true"></div>' +
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
        if (window.NostalgiaWishlist) window.NostalgiaWishlist.toggle(product.id);
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

  function reviewListHTML(reviews) {
    if (!reviews.length) {
      return '<li class="product-reviews__empty">' + t("reviews_empty") + "</li>";
    }
    return reviews
      .slice(0, 12)
      .map(function (r) {
        var title = r.title ? '<strong class="product-reviews__item-title">' + escapeHtml(r.title) + "</strong>" : "";
        var link = r.id
          ? ' <a class="product-reviews__read-more" href="/review/' + encodeURIComponent(r.id) + '">' + escapeHtml(t("reviews_read_more")) + "</a>"
          : "";
        return (
          "<li>" +
          '<span class="product-reviews__stars" aria-hidden="true">' +
          "★".repeat(r.rating) +
          "</span> " +
          "<strong>" +
          escapeHtml(r.name) +
          "</strong>" +
          title +
          "<p>" +
          escapeHtml(r.text) +
          link +
          "</p></li>"
        );
      })
      .join("");
  }

  function reviewSummaryText(reviews) {
    var avg = reviews.length
      ? (reviews.reduce(function (s, r) {
          return s + r.rating;
        }, 0) / reviews.length).toFixed(1)
      : "0.0";
    return t("reviews_avg") + ": " + avg + " · " + reviews.length + " " + t("reviews_count");
  }

  function renderReviewsHTML(product) {
    return (
      '<section class="product-reviews">' +
      "  <h2>" +
      t("reviews_title") +
      "</h2>" +
      '  <p class="product-reviews__summary" id="product-reviews-summary">' +
      reviewSummaryText([]) +
      "</p>" +
      '  <form class="product-reviews__form" id="product-review-form">' +
      '    <input id="review-name" type="text" placeholder="' +
      t("reviews_name") +
      '" required />' +
      '    <input id="review-title" type="text" placeholder="' +
      t("reviews_title_field") +
      '" maxlength="120" />' +
      '    <select id="review-rating"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>' +
      '    <textarea id="review-text" placeholder="' +
      t("reviews_placeholder") +
      '" required></textarea>' +
      '    <button type="submit" class="btn-shop btn-shop--primary">' +
      t("reviews_submit") +
      "</button>" +
      '    <p class="product-reviews__feedback" id="review-feedback" hidden></p>' +
      "  </form>" +
      '  <ul class="product-reviews__list" id="product-reviews-list"></ul>' +
      "</section>"
    );
  }

  function paintReviews(reviews) {
    var summary = document.getElementById("product-reviews-summary");
    var list = document.getElementById("product-reviews-list");
    if (summary) summary.textContent = reviewSummaryText(reviews);
    if (list) list.innerHTML = reviewListHTML(reviews);
  }

  function loadReviews(product) {
    if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
      window.NostalgiaAPI.get("/api/reviews?productId=" + encodeURIComponent(product.id))
        .then(function (res) {
          paintReviews(res.ok && res.reviews ? res.reviews : []);
        })
        .catch(function () {
          paintReviews(getReviews(product.id));
        });
    } else {
      paintReviews(getReviews(product.id));
    }
  }

  function showReviewFeedback(message, isError) {
    var fb = document.getElementById("review-feedback");
    if (!fb) return;
    fb.textContent = message;
    fb.hidden = false;
    fb.classList.toggle("is-error", !!isError);
    fb.classList.toggle("is-success", !isError);
  }

  function bindReviews(product) {
    var form = document.getElementById("product-review-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameEl = document.getElementById("review-name");
      var titleEl = document.getElementById("review-title");
      var ratingEl = document.getElementById("review-rating");
      var textEl = document.getElementById("review-text");
      var review = {
        name: (nameEl.value || "").trim() || "Guest",
        title: titleEl ? (titleEl.value || "").trim() : "",
        rating: Math.max(1, Math.min(5, parseInt(ratingEl.value, 10) || 5)),
        text: (textEl.value || "").trim(),
      };
      if (!review.text) return;

      if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
        window.NostalgiaAPI.post("/api/reviews", {
          productId: product.id,
          name: review.name,
          title: review.title,
          rating: review.rating,
          text: review.text,
        })
          .then(function (res) {
            if (res.ok) {
              form.reset();
              showReviewFeedback(t("reviews_thanks"), false);
            } else {
              showReviewFeedback(t("reviews_thanks"), false);
            }
          })
          .catch(function () {
            saveReview(product.id, review);
            form.reset();
            showReviewFeedback(t("reviews_thanks"), false);
            paintReviews(getReviews(product.id));
          });
        return;
      }

      saveReview(product.id, review);
      form.reset();
      showReviewFeedback(t("reviews_thanks"), false);
      paintReviews(getReviews(product.id));
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
      .slice(0, 4);
    if (!related.length) return "";
    var cards = related
      .map(function (item) {
        return (
          '<article class="related-card">' +
          '  <a href="/product/' +
          encodeURIComponent(item.id) +
          '">' +
          '    <img src="' +
          item.image +
          '" alt="' +
          escapeHtml(productTitle(item)) +
          '" loading="lazy" decoding="async" />' +
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
      '  <div class="related-products__grid">' +
      cards +
      "</div>" +
      "</section>"
    );
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
