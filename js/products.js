(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7", "cat8", "cat9"];

  function muranoImg(n) {
    return "images/product%20photo/art%20class%20murano%20candle/product%20" + n + ".png";
  }
  function driftwoodImg(name) {
    return "images/product%20photo/driftwood%20beeswax%20flame/" + name;
  }
  function liquidImg(n) {
    return "images/product%20photo/liquid%20eternal/product%20" + n + ".png";
  }
  function vesselImg(n) {
    return "images/product%20photo/unique%20art%20vessel/product%20" + n + ".png";
  }
  function terraImg(n) {
    return "images/product%20photo/Ni%20Terra/product%20" + n + ".png";
  }

  /* A product folder with photo1..photoN.png → gallery array (first = main). */
  function gallery(folder, n) {
    var imgs = [];
    for (var i = 1; i <= (n || 3); i++) imgs.push(folder + "/photo" + i + ".png");
    return imgs;
  }
  var MURANO_DIR = "images/product%20photo/art%20class%20murano%20candle/";
  var GIFT_DIR = "images/product%20photo/Gift%20Sets/";
  var MIRROR_DIR = "images/product%20photo/Nostalgia%20Exclusive%20Mirror%20Candles/";
  var LIQUID_DIR = "images/product%20photo/liquid%20eternal/";
  /* Each colour is its OWN product; they are linked as a variant group so the
     product page shows swatches that navigate between the colour-products. */
  var MIRROR_REGULAR = [
    { folder: "Mirror%20Candles-asimi", label: "Ασημί", hex: "#c3c6c9" },
    { folder: "Mirror%20Candles-aspro", label: "Λευκό", hex: "#f2efe9" },
    { folder: "Mirror%20Candles-galazio", label: "Γαλάζιο", hex: "#a9cbe0" },
    { folder: "Mirror%20Candles-kokkino", label: "Κόκκινο", hex: "#b0342c" },
    { folder: "Mirror%20Candles-mauro", label: "Μαύρο", hex: "#2b2b2b" },
    { folder: "Mirror%20Candles-prasino", label: "Πράσινο", hex: "#4a7a4e" },
  ];
  var MIRROR_LARGE = [
    { folder: "Mirror%20Candles-asimi-Large", label: "Large Ασημί", hex: "#c3c6c9" },
    { folder: "Mirror%20Candles-xriso-Large", label: "Large Χρυσό", hex: "#c9a24a" },
  ];
  var MIRROR_ALL = MIRROR_REGULAR.concat(MIRROR_LARGE);

  /* Built-in colour variants: id -> { key, label, hex }. Products that share a
     "key" are linked as colour siblings. The admin can also declare variants per
     product via details (variantGroup/variantColor/variantColorHex), which then
     take priority over these defaults — see variantInfoFor(). */
  var VARIANT_META = {};
  (function () {
    MIRROR_REGULAR.forEach(function (v, i) {
      VARIANT_META["cat9-" + (i + 1)] = { key: "mirror", label: v.label, hex: v.hex };
    });
    var off = MIRROR_REGULAR.length;
    MIRROR_LARGE.forEach(function (v, i) {
      VARIANT_META["cat9-" + (off + i + 1)] = { key: "mirror-large", label: v.label, hex: v.hex };
    });
  })();

  /* ---------------------------------------------------------------------
     Colour classification. Each product is tagged with one or more colour
     "families" so the collection page can offer a colour filter. Colours are
     derived, in order, from: a variant colour hex (built-in or admin/backend),
     a colour label (Greek or English), and finally the image folder name
     (e.g. "murano-mple", "Mirror Candles-galazio"). Products with no colour
     signal (liquid, driftwood, vessels…) simply carry no colour and only show
     under "All".
     --------------------------------------------------------------------- */
  var COLOR_FAMILIES = [
    { id: "white", hex: "#f4f1ea", key: "color_white" },
    { id: "cream", hex: "#efe6d3", key: "color_cream" },
    { id: "beige", hex: "#d9c7a8", key: "color_beige" },
    { id: "taupe", hex: "#b79b82", key: "color_taupe" },
    { id: "brown", hex: "#6b4a2f", key: "color_brown" },
    { id: "copper", hex: "#a55a33", key: "color_copper" },
    { id: "bronze", hex: "#7d6033", key: "color_bronze" },
    { id: "gold", hex: "#c9a24a", key: "color_gold" },
    { id: "rosegold", hex: "#d9a6a0", key: "color_rosegold" },
    { id: "silver", hex: "#c3c6c9", key: "color_silver" },
    { id: "yellow", hex: "#e3c65b", key: "color_yellow" },
    { id: "orange", hex: "#d98a4a", key: "color_orange" },
    { id: "coral", hex: "#e5735a", key: "color_coral" },
    { id: "red", hex: "#b0342c", key: "color_red" },
    { id: "bordeaux", hex: "#6e2233", key: "color_bordeaux" },
    { id: "pink", hex: "#e2a7bd", key: "color_pink" },
    { id: "fuchsia", hex: "#d43d7d", key: "color_fuchsia" },
    { id: "purple", hex: "#6b4a7a", key: "color_purple" },
    { id: "lilac", hex: "#b98fd0", key: "color_lilac" },
    { id: "navy", hex: "#1f3a5f", key: "color_navy" },
    { id: "blue", hex: "#3a5a8c", key: "color_blue" },
    { id: "lightblue", hex: "#a9cbe0", key: "color_lightblue" },
    { id: "turquoise", hex: "#3fc1c9", key: "color_turquoise" },
    { id: "petrol", hex: "#1a6b74", key: "color_petrol" },
    { id: "green", hex: "#4a7a4e", key: "color_green" },
    { id: "black", hex: "#2b2b2b", key: "color_black" },
    { id: "multi", hex: "", key: "color_multi" },
    { id: "transparent", hex: "", key: "color_transparent" },
  ];
  var FAMILY_BY_ID = {};
  COLOR_FAMILIES.forEach(function (f) { FAMILY_BY_ID[f.id] = f; });

  /* Substring tokens (lower-cased, accent-tolerant) mapped to a colour family.
     Matched against decoded image paths and colour labels. Only used when the
     admin has NOT set an explicit colour family for the product. */
  var COLOR_KEYWORDS = [
    { fam: "white", tokens: ["aspro", "ασπρ", "λευκ", "white", "ivory", "ιβουαρ"] },
    { fam: "cream", tokens: ["cream", "κρεμ", "εκρου", "ecru"] },
    { fam: "black", tokens: ["mauro", "μαυρ", "black"] },
    { fam: "bordeaux", tokens: ["bordeaux", "μπορντ", "κρασ", "burgundy"] },
    { fam: "red", tokens: ["kokkino", "κοκκιν", "red", "rouge"] },
    { fam: "coral", tokens: ["coral", "κοραλ"] },
    { fam: "turquoise", tokens: ["turquoise", "τιρκουαζ", "τυρκουαζ"] },
    { fam: "petrol", tokens: ["petrol", "πετρολ"] },
    { fam: "lightblue", tokens: ["galazio", "γαλαζ", "sky", "aqua"] },
    { fam: "navy", tokens: ["navy", "ραφ"] },
    { fam: "blue", tokens: ["mple", "μπλε", "blue"] },
    { fam: "green", tokens: ["prasino", "πρασιν", "green", "sage", "φασκομ", "olive", "ελια", "χακι", "khaki"] },
    { fam: "yellow", tokens: ["kitrino", "κιτριν", "yellow"] },
    { fam: "orange", tokens: ["portokali", "πορτοκαλ", "orange"] },
    { fam: "fuchsia", tokens: ["φουξ", "fuchsia"] },
    { fam: "pink", tokens: ["roz", "ροζ", "pink", "blush", "rose"] },
    { fam: "lilac", tokens: ["λιλα", "lilac"] },
    { fam: "purple", tokens: ["mov", "μωβ", "purple", "violet"] },
    { fam: "rosegold", tokens: ["rose gold", "ροζ χρυσ"] },
    { fam: "gold", tokens: ["xriso", "chriso", "χρυσ", "gold"] },
    { fam: "copper", tokens: ["copper", "χαλκιν"] },
    { fam: "bronze", tokens: ["bronze", "μπρουτζ", "μπρουντζ"] },
    { fam: "silver", tokens: ["asimi", "ασημ", "silver", "γκρι", "gray", "grey"] },
    { fam: "taupe", tokens: ["taupe", "ταμπα", "πουρο"] },
    { fam: "beige", tokens: ["bez", "μπεζ", "beige", "sand", "αμμ", "nude"] },
    { fam: "brown", tokens: ["kafe", "καφε", "brown", "terracotta", "τερακοτα", "amber", "κεχριμπαρ", "καστ"] },
    { fam: "transparent", tokens: ["διαφαν", "transparent", "clear"] },
    { fam: "multi", tokens: ["pardalo", "παρδαλ", "multi", "πολυχρ", "rainbow", "ουρανιο"] },
  ];

  function hexToRgb(hex) {
    if (!hex) return null;
    var s = String(hex).trim().replace(/^#/, "");
    if (s.length === 3) s = s.replace(/(.)/g, "$1$1");
    if (s.length !== 6 || /[^0-9a-fA-F]/.test(s)) return null;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  var HEX_ANCHORS = COLOR_FAMILIES
    .filter(function (f) { return f.hex; })
    .map(function (f) { return { id: f.id, rgb: hexToRgb(f.hex) }; });

  function classifyHex(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    var best = null, bd = Infinity;
    HEX_ANCHORS.forEach(function (a) {
      var dr = rgb[0] - a.rgb[0], dg = rgb[1] - a.rgb[1], db = rgb[2] - a.rgb[2];
      var d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = a.id; }
    });
    return best;
  }

  function getColorFamilies(p) {
    if (!p) return [];
    /* 0 — an explicit colour family chosen in the admin panel is authoritative. */
    if (p.details && p.details.colorFamily && FAMILY_BY_ID[p.details.colorFamily]) {
      return [p.details.colorFamily];
    }
    var found = {};
    function addFromText(text) {
      if (!text) return;
      var s;
      try { s = decodeURIComponent(String(text)); } catch (e) { s = String(text); }
      s = s.toLowerCase();
      COLOR_KEYWORDS.forEach(function (entry) {
        for (var i = 0; i < entry.tokens.length; i++) {
          if (s.indexOf(entry.tokens[i]) !== -1) { found[entry.fam] = true; return; }
        }
      });
    }
    /* 1 — colour hex from any variant source */
    var hexes = [];
    if (p._variant && p._variant.hex) hexes.push(p._variant.hex);
    if (p.variantColorHex) hexes.push(p.variantColorHex);
    if (p.details && p.details.variantColorHex) hexes.push(p.details.variantColorHex);
    if (p.variants && p.variants.length) {
      p.variants.forEach(function (v) { if (v && v.colorHex) hexes.push(v.colorHex); });
    }
    hexes.forEach(function (h) { var f = classifyHex(h); if (f) found[f] = true; });
    /* 2 — colour labels (Greek + English) */
    if (p._variant && p._variant.label) addFromText(p._variant.label);
    if (p.variantColorLabel) addFromText(p.variantColorLabel);
    if (p.details) {
      addFromText(p.details.variantColor);
      addFromText(p.details.variantColorEn);
      addFromText(p.details.color);
      addFromText(p.details.colorEn);
    }
    if (p.variants && p.variants.length) {
      p.variants.forEach(function (v) { if (v) { addFromText(v.color); addFromText(v.colorEn); } });
    }
    /* 3 — image folder name (covers murano / mirror colour folders) */
    addFromText(p.image);
    if (p.images && p.images.length) addFromText(p.images.join(" "));
    return Object.keys(found);
  }

  var CAT_IMAGES = {
    cat1: [
      gallery(MURANO_DIR + "murano-aspro"),
      gallery(MURANO_DIR + "murano-aspro-mob"),
      gallery(MURANO_DIR + "murano-mauro"),
      gallery(MURANO_DIR + "murano%20kokkino"),
      gallery(MURANO_DIR + "murano-kokkino-anoixto"),
      gallery(MURANO_DIR + "murano-mple"),
      gallery(MURANO_DIR + "murano-flut-mple"),
      gallery(MURANO_DIR + "murano-flut-kitrino"),
      gallery(MURANO_DIR + "murano-galazio"),
      gallery(MURANO_DIR + "murano-pardalo"),
      gallery(MURANO_DIR + "murano-pardalo-anoixto"),
      gallery(MURANO_DIR + "murano-pardalo-skouro"),
    ],
    cat2: [
      driftwoodImg("product%201.png"),
      driftwoodImg("product%202.png"),
      driftwoodImg("product%203.png"),
      driftwoodImg("product%204%20.png"),
      driftwoodImg("product%205.png"),
      driftwoodImg("product%206%20.png"),
      driftwoodImg("product%207.png"),
      driftwoodImg("product%208.png"),
      driftwoodImg("product%209.png"),
      driftwoodImg("product%2010.png"),
      driftwoodImg("product%2011.png"),
      driftwoodImg("product%2012.png"),
      driftwoodImg("product%2013.png"),
    ],
    cat3: [
      gallery(LIQUID_DIR + "liquid-1"),
      gallery(LIQUID_DIR + "liquid-2"),
      gallery(LIQUID_DIR + "liquid-3"),
      gallery(LIQUID_DIR + "liquid-4"),
      gallery(LIQUID_DIR + "liquid-5"),
      gallery(LIQUID_DIR + "liquid-6"),
      gallery(LIQUID_DIR + "liquid-7"),
    ],
    cat4: [
      vesselImg(1), vesselImg(2), vesselImg(3), vesselImg(4),
      vesselImg(5), vesselImg(6), vesselImg(7), vesselImg(8),
    ],
    cat5: [terraImg(1), terraImg(2), terraImg(3), terraImg(4)],
    cat6: [],
    cat7: [],
    cat8: [
      gallery(GIFT_DIR + "gift-set1"),
      gallery(GIFT_DIR + "gift-set2"),
      gallery(GIFT_DIR + "gift-set3"),
    ],
    cat9: MIRROR_ALL.map(function (v) { return gallery(MIRROR_DIR + v.folder); }),
  };

  function buildProductKey(catId, index, field) {
    return "collection_" + catId + "_prod" + index + "_" + field;
  }

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getTitle(catId, index, product) {
    var titleKey = buildProductKey(catId, index, "title");
    var raw = t(titleKey);
    if (raw && raw !== titleKey && raw.trim()) {
      return raw.trim();
    }
    var label = product && product.variantLabel;
    if (!label) {
      var meta = VARIANT_META[catId + "-" + index];
      if (meta) label = meta.label;
    }
    if (label) {
      return t("collection_" + catId) + " · " + label;
    }
    return t("collection_" + catId) + " · " + index;
  }

  /* Where a product's colour-variant info comes from: an admin declaration in
     details (variantGroup/variantColor/variantColorHex) wins; otherwise the
     built-in VARIANT_META defaults. Returns { key, label, hex } or null. */
  function variantInfoFor(p) {
    var d = p.details;
    if (d && d.variantGroup && String(d.variantGroup).trim()) {
      var enColor = document.documentElement.lang === "en" && d.variantColorEn && String(d.variantColorEn).trim();
      return {
        key: String(d.variantGroup).trim(),
        label: (enColor && String(d.variantColorEn).trim()) ||
          (d.variantColor && String(d.variantColor).trim()) || p.title || "",
        hex: (d.variantColorHex && String(d.variantColorHex).trim()) || "#cccccc",
      };
    }
    var m = VARIANT_META[p.id];
    if (m) return { key: m.key, label: m.label, hex: m.hex };
    return null;
  }

  /* Link every product that shares a variant key into a colour group, so the
     product page can show swatches that navigate between the sibling colours. */
  function rebuildVariantGroups() {
    var groups = {};
    catalog.forEach(function (p) {
      var info = variantInfoFor(p);
      p._variant = info;
      p.variantLabel = info ? info.label : null;
      if (info) {
        (groups[info.key] = groups[info.key] || []).push({
          id: p.id,
          label: info.label,
          hex: info.hex,
        });
      }
    });
    catalog.forEach(function (p) {
      if (p._variant) {
        var members = groups[p._variant.key];
        p.variantGroup = members && members.length >= 2 ? members : null;
      } else {
        p.variantGroup = null;
      }
    });
  }

  var CAT_KIND = {
    cat1: "candle",
    cat2: "candle",
    cat3: "candle",
    cat4: "candle",
    cat5: "candle",
    cat6: "aroma",
    cat7: "aroma",
    cat8: "gift",
    cat9: "candle",
  };

  var CAT_SCENT = {
    cat1: { temp: "warm", family: "floral", room: "living", mood: "romantic" },
    cat2: { temp: "warm", family: "woody", room: "bedroom", mood: "memory" },
    cat3: { temp: "fresh", family: "floral", room: "bathroom", mood: "calm" },
    cat4: { temp: "warm", family: "woody", room: "living", mood: "celebration" },
    cat5: { temp: "warm", family: "woody", room: "bedroom", mood: "calm" },
    cat6: { temp: "warm", family: "floral", room: "living", mood: "romantic" },
    cat7: { temp: "fresh", family: "floral", room: "bathroom", mood: "calm" },
    cat8: { temp: "warm", family: "woody", room: "living", mood: "celebration" },
    cat9: { temp: "warm", family: "floral", room: "living", mood: "romantic" },
  };

  var LIMITED_STOCK = {
    "cat1-1": 4,
    "cat1-3": 4,
    "cat4-2": 4,
    "cat5-1": 4,
  };

  function buildCatalog() {
    var list = [];
    CAT_IDS.forEach(function (catId) {
      var images = CAT_IMAGES[catId] || [];
      for (var i = 1; i <= images.length; i++) {
        var id = catId + "-" + i;
        var entry = images[i - 1];
        var imgs = Array.isArray(entry) ? entry.slice() : [entry];
        list.push({
          id: id,
          catId: catId,
          index: i,
          image: imgs[0],
          images: imgs,
          variantGroup: null,
          variantLabel: null,
          titleKey: buildProductKey(catId, i, "title"),
          scent: CAT_SCENT[catId] || null,
          limited: LIMITED_STOCK[id] != null,
          stock: LIMITED_STOCK[id] != null ? LIMITED_STOCK[id] : null,
        });
      }
    });
    return list;
  }

  function getCategoryKind(catId) {
    return CAT_KIND[catId] || "candle";
  }

  function getMeta(id) {
    var p = byId[id];
    if (!p) return null;
    return {
      scent: p.scent,
      kind: getCategoryKind(p.catId),
      limited: p.limited,
      stock: p.stock,
    };
  }

  var catalog = buildCatalog();
  var byId = {};
  catalog.forEach(function (p) {
    byId[p.id] = p;
  });

  /* Colour variants from the backend (product_variants table). Each base
     product id maps to a list of variant objects; each variant is an
     independently purchasable unit resolved through getById(variantId). */
  var variantsByBase = {};
  var variantById = {};

  function variantColorLabel(v) {
    if (document.documentElement.lang === "en" && v.colorEn && String(v.colorEn).trim()) {
      return v.colorEn;
    }
    return v.color || "";
  }

  /* Build a purchasable product object = base content + one variant's own
     image / price / stock / sku. The colour is appended to the title so it
     shows through cart, checkout and orders; product.js uses baseTitle for the
     page heading and renders a colour selector. */
  function composeVariantProduct(base, v) {
    if (!base || !v) return null;
    var imgs = v.images && v.images.length
      ? v.images.slice()
      : (base.images && base.images.length ? base.images.slice() : (base.image ? [base.image] : []));
    var price = v.price != null ? v.price : (base.price != null ? base.price : null);
    var salePrice = v.price != null
      ? (v.salePrice != null ? v.salePrice : null)
      : (base.salePrice != null ? base.salePrice : null);
    var label = variantColorLabel(v);
    return Object.assign({}, base, {
      id: v.id,
      variantOf: base.id,
      baseId: base.id,
      baseTitle: base.title,
      baseTitleEn: base.titleEn || "",
      title: base.title + (label ? " — " + label : ""),
      titleEn: base.titleEn ? base.titleEn + (label ? " — " + label : "") : "",
      image: imgs[0] || base.image || "",
      images: imgs,
      price: price,
      salePrice: salePrice,
      stock: v.stock != null ? v.stock : null,
      limited: v.stock != null,
      sku: v.sku || "",
      variantColorHex: v.colorHex || "",
      variantColorLabel: label,
      variants: base.variants || null,
      activeVariantId: v.id,
    });
  }

  /* Attach each base product's variant list + reflect the default (first
     available) variant's image/price on the base card. */
  function attachVariants() {
    catalog.forEach(function (p) {
      var list = variantsByBase[p.id];
      if (list && list.length) {
        p.variants = list;
        var def = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].available !== false) { def = list[i]; break; }
        }
        if (!def) def = list[0];
        p._defaultVariant = def;
        if (def) {
          if (def.images && def.images.length) {
            p.image = def.images[0];
            p.images = def.images.slice();
          }
          if (def.price != null) p.price = def.price;
          if (def.salePrice != null) p.salePrice = def.salePrice;
          if (def.stock != null) { p.stock = def.stock; p.limited = true; }
        }
      } else {
        p.variants = null;
        p._defaultVariant = null;
      }
    });
  }

  function applyServerVariants(map) {
    variantsByBase = {};
    variantById = {};
    if (map && typeof map === "object") {
      Object.keys(map).forEach(function (pid) {
        var arr = Array.isArray(map[pid]) ? map[pid] : [];
        variantsByBase[pid] = arr;
        arr.forEach(function (v) {
          variantById[v.id] = { baseId: pid, variant: v };
        });
      });
    }
    attachVariants();
    document.dispatchEvent(new CustomEvent("nostalgia-products-updated"));
  }

  function getDescription(catId, index) {
    var descKey = buildProductKey(catId, index, "desc");
    var raw = t(descKey);
    if (raw && raw !== descKey && raw.trim()) {
      return raw.trim();
    }
    return "";
  }

  function refreshTitles() {
    rebuildVariantGroups();
    catalog.forEach(function (p) {
      if (!p.custom) {
        p.title = getTitle(p.catId, p.index, p);
        p.description = getDescription(p.catId, p.index);
      }
      p.categoryName = t("collection_" + p.catId);
      p.colors = getColorFamilies(p);
    });
  }

  /* Single entry point for backend data: custom products, prices, stock. */
  function applyServerCatalog(data) {
    if (!data) return;
    if (Array.isArray(data.products)) {
      applyServerProducts(data.products);
    }
    if (data.details) {
      applyProductDetails(data.details);
    }
    if (data.prices) {
      catalog.forEach(function (p) {
        if (!p.custom && data.prices[p.id] != null) {
          p.price = data.prices[p.id];
        }
      });
    }
    if (data.salePrices) {
      catalog.forEach(function (p) {
        if (!p.custom) {
          p.salePrice =
            data.salePrices[p.id] != null ? data.salePrices[p.id] : null;
        }
      });
    }
    if (data.stock) {
      applyServerStock(data.stock);
    }
    /* variants last: they reflect their base's freshly-applied price/stock */
    applyServerVariants(data.variants || {});
    document.dispatchEvent(new CustomEvent("nostalgia-products-updated"));
  }

  function applyProductDetails(detailsMap) {
    if (!detailsMap || typeof detailsMap !== "object") return;
    catalog.forEach(function (p) {
      if (detailsMap[p.id]) {
        p.details = detailsMap[p.id];
      }
    });
    document.dispatchEvent(new CustomEvent("nostalgia-products-updated"));
  }

  /* Merge products created from the admin panel into the catalog. */
  function applyServerProducts(list) {
    if (!Array.isArray(list)) return;
    /* drop previously merged custom products, then re-add */
    catalog = catalog.filter(function (p) {
      return !p.custom;
    });
    list.forEach(function (sp) {
      if (!sp || !sp.id || byId[sp.id] && !byId[sp.id].custom) return;
      var item = {
        id: sp.id,
        catId: sp.catId,
        index: catalog.filter(function (p) {
          return p.catId === sp.catId;
        }).length + 1,
        image: sp.image || (Array.isArray(sp.images) && sp.images[0]) || "",
        images: Array.isArray(sp.images) && sp.images.length ? sp.images : (sp.image ? [sp.image] : []),
        title: sp.title || sp.id,
        titleEn: sp.titleEn || "",
        description: sp.description || "",
        descriptionEn: sp.descriptionEn || "",
        price: sp.price != null ? sp.price : null,
        salePrice: sp.salePrice != null ? sp.salePrice : null,
        createdAt: sp.createdAt || null,
        scent: CAT_SCENT[sp.catId] || null,
        custom: true,
        limited: false,
        stock: null,
        details: sp.details || null,
      };
      catalog.push(item);
    });
    byId = {};
    catalog.forEach(function (p) {
      byId[p.id] = p;
    });
    refreshTitles();
    /* re-link variants onto the rebuilt catalog objects */
    attachVariants();
    document.dispatchEvent(new CustomEvent("nostalgia-products-updated"));
  }

  refreshTitles();

  /* Live stock from the backend (api.js) overrides the static defaults. */
  function applyServerStock(stockMap) {
    if (!stockMap) return;
    catalog.forEach(function (p) {
      if (Object.prototype.hasOwnProperty.call(stockMap, p.id)) {
        var value = stockMap[p.id];
        p.limited = value != null;
        p.stock = value != null ? value : null;
      }
    });
    document.dispatchEvent(new CustomEvent("nostalgia-stock-updated"));
  }

  /* A product counts as "new" while it is within NEW_WINDOW_DAYS of its
     createdAt. Only admin-created products carry a createdAt, so the static
     catalog never shows up here — exactly what we want. */
  var NEW_WINDOW_DAYS = 30;
  var NEW_WINDOW_MS = NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  function isNew(p) {
    if (!p || !p.createdAt) return false;
    var created = new Date(p.createdAt).getTime();
    if (isNaN(created)) return false;
    return Date.now() - created <= NEW_WINDOW_MS;
  }

  /* On sale when a valid sale price is set below the regular price. */
  function isOnSale(p) {
    if (!p || p.salePrice == null || p.price == null) return false;
    return Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price);
  }

  function discountPercent(p) {
    if (!isOnSale(p)) return 0;
    return Math.round((1 - Number(p.salePrice) / Number(p.price)) * 100);
  }

  /* The price actually charged: sale price when on sale, else regular. */
  function getEffectivePrice(p) {
    if (!p) return null;
    if (isOnSale(p)) return Number(p.salePrice);
    return p.price != null ? Number(p.price) : null;
  }

  function getNewArrivals() {
    refreshTitles();
    return catalog
      .filter(isNew)
      .sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  function getOnSale() {
    refreshTitles();
    return catalog.filter(isOnSale).sort(function (a, b) {
      return discountPercent(b) - discountPercent(a);
    });
  }

  function getCountByCategory(catId) {
    return (CAT_IMAGES[catId] || []).length;
  }

  function getTotalCount() {
    return catalog.length;
  }

  window.NostalgiaProducts = {
    CAT_IDS: CAT_IDS,
    CAT_IMAGES: CAT_IMAGES,
    CAT_KIND: CAT_KIND,
    COLOR_FAMILIES: COLOR_FAMILIES,
    getColorFamilies: getColorFamilies,
    getColorMeta: function (id) { return FAMILY_BY_ID[id] || null; },
    CAT_SCENT: CAT_SCENT,
    getCategoryKind: getCategoryKind,
    getCategoryUrl: function (catId) {
      return "/collection#" + encodeURIComponent(catId);
    },
    getAll: function () {
      refreshTitles();
      return catalog.slice();
    },
    getById: function (id) {
      refreshTitles();
      /* a variant id → compose it against its base */
      if (variantById[id]) {
        var base = byId[variantById[id].baseId];
        return base ? composeVariantProduct(base, variantById[id].variant) : null;
      }
      var p = byId[id];
      /* a base product that has colours → return its default variant so the
         page always has an active colour and add-to-cart uses a variant id */
      if (p && p.variants && p.variants.length) {
        return composeVariantProduct(p, p._defaultVariant || p.variants[0]);
      }
      return p || null;
    },
    getCountByCategory: getCountByCategory,
    getTotalCount: getTotalCount,
    getTitle: getTitle,
    isNew: isNew,
    isOnSale: isOnSale,
    discountPercent: discountPercent,
    getEffectivePrice: getEffectivePrice,
    getNewArrivals: getNewArrivals,
    getOnSale: getOnSale,
    getProductUrl: function (id) {
      return "/product/" + encodeURIComponent(id);
    },
    getMeta: getMeta,
    refresh: refreshTitles,
    applyServerStock: applyServerStock,
    applyServerProducts: applyServerProducts,
    applyServerCatalog: applyServerCatalog,
    applyServerVariants: applyServerVariants,
    getVariants: function (baseId) { return variantsByBase[baseId] || []; },
  };

  window.NostalgiaOnLangApplied = (function (prev) {
    return function () {
      refreshTitles();
      if (typeof prev === "function") prev();
    };
  })(window.NostalgiaOnLangApplied);
})();
