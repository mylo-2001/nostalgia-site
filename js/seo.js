(function () {
  var SITE = {
    name: "Nostalgia Collection",
    taglineEl:
      "Χειροποίητα αρωματικά κεριά, reed diffusers και αρώματα σπιτιού από την Ελλάδα. Scent Finder για να βρείτε το ιδανικό άρωμα.",
    taglineEn:
      "Handmade scented candles, reed diffusers and home fragrances from Greece. Scent Finder to discover your perfect aroma.",
    keywords:
      "κεριά, αρωματικά κεριά, χειροποίητα κεριά, κεριά Ελλάδα, αρώματα σπιτιού, αρωματικός διαχύστης, reed diffuser, diffuser, " +
      "scented candles, handmade candles Greece, home fragrance, candle gift, αρωματικά δώρα, Nostalgia Collection, " +
      "soy candles, κερί σόγια, luxury candles, aromatherapy candles, scent finder",
    phone: "+306939411774",
    email: "info@nostalgiacandle.gr",
  };

  var PAGES = {
    home: {
      title: "Nostalgia Collection · Χειροποίητα αρωματικά κεριά & diffusers",
      desc: SITE.taglineEl,
    },
    collection: {
      title: "Συλλογή κεριών & αρωμάτων · Nostalgia Collection",
      desc: "Εξερευνήστε τη συλλογή χειροποίητων αρωματικών κεριών και diffusers. Φυσικά αρώματα για κάθε χώρο.",
    },
    "scent-finder": {
      title: "Scent Finder · Βρείτε το ιδανικό άρωμα · Nostalgia",
      desc: "Δωρεάν quiz για να βρείτε το κερί ή diffuser που ταιριάζει στον χώρο, τη διάθεση και τον τύπο σας.",
    },
    gift: {
      title: "Δώρο εμπειρία · Αρωματικά κεριά & diffusers · Nostalgia",
      desc: "Επιλογές δώρου με συσκευασία, κάρτα και αποστολή στον παραλήπτη. Ιδανικό για γενέθλια και εορτές.",
    },
    about: {
      title: "Σχετικά με εμάς · Nostalgia Collection",
      desc: "Χειροποίητα κεριά και αρώματα με προσοχή στη λεπτομέρεια. Μάθετε την ιστορία και τη φιλοσοφία μας.",
    },
    contact: {
      title: "Επικοινωνία · Nostalgia Collection",
      desc: "Επικοινωνήστε για παραγγελίες, αρωματικά κεριά, diffusers και ερωτήσεις αποστολής.",
    },
    "new-arrivals": {
      title: "Νέα Προϊόντα · Nostalgia Collection",
      desc: "Οι τελευταίες προσθήκες στη συλλογή χειροποίητων αρωματικών κεριών Nostalgia Collection.",
    },
    sale: {
      title: "Εκπτώσεις · Nostalgia Collection",
      desc: "Αρωματικά κεριά και diffusers σε έκπτωση — περιορισμένος αριθμός τεμαχίων.",
    },
    seasonal: {
      title: "Seasonal Editions · Nostalgia Collection",
      desc: "Εποχιακές, περιορισμένες συλλογές χειροποίητων αρωματικών κεριών Nostalgia Collection.",
    },
    faq: {
      title: "Συχνές Ερωτήσεις · Nostalgia Collection",
      desc: "Απαντήσεις σε συχνές ερωτήσεις για παραγγελίες, αποστολή, πληρωμές και τα χειροποίητα κεριά μας.",
    },
    journal: {
      title: "Journal · Ιστορίες & έμπνευση · Nostalgia Collection",
      desc: "Άρθρα και ιστορίες πίσω από τις συλλογές χειροποίητων κεριών της Nostalgia Collection.",
    },
    shipping: {
      title: "Αποστολή & Επιστροφές · Nostalgia Collection",
      desc: "Χρόνοι και κόστος αποστολής, καθώς και πολιτική επιστροφών/αλλαγών για παραγγελίες Nostalgia Collection.",
    },
    payments: {
      title: "Τρόποι Πληρωμής · Nostalgia Collection",
      desc: "Αποδεκτοί τρόποι πληρωμής, αντικαταβολή και πολιτική επιστροφής χρημάτων στη Nostalgia Collection.",
    },
    terms: {
      title: "Όροι Χρήσης · Nostalgia Collection",
      desc: "Οι όροι χρήσης του nostalgiacandle.gr και της αγοράς προϊόντων Nostalgia Collection.",
    },
    privacy: {
      title: "Πολιτική Απορρήτου · Nostalgia Collection",
      desc: "Πώς συλλέγουμε, χρησιμοποιούμε και προστατεύουμε τα προσωπικά σας δεδομένα στη Nostalgia Collection.",
    },
    reviews: {
      title: "Κριτικές Πελατών · Nostalgia Collection",
      desc: "Πραγματικές κριτικές πελατών για τα χειροποίητα αρωματικά κεριά Nostalgia Collection.",
    },
    "review-policy": {
      title: "Πολιτική Κριτικών · Nostalgia Collection",
      desc: "Πώς ελέγχονται και εγκρίνονται οι κριτικές πελατών στο nostalgiacandle.gr.",
    },

    /* Private/utility/thin-content pages — never index these.
       (track.html, review.html, diag.html, hero-test.html don't load this
       script at all — they get a hardcoded <meta robots> directly in their
       own HTML instead; see html/*.html.) */
    cart: { title: "Καλάθι · Nostalgia Collection", desc: SITE.taglineEl, noindex: true },
    checkout: { title: "Ολοκλήρωση παραγγελίας · Nostalgia Collection", desc: SITE.taglineEl, noindex: true },
    account: { title: "Ο λογαριασμός μου · Nostalgia Collection", desc: SITE.taglineEl, noindex: true },
    wishlist: { title: "Αγαπημένα · Nostalgia Collection", desc: SITE.taglineEl, noindex: true },
  };

  function upsertMeta(attr, key, content) {
    if (!content) return;
    var sel = "meta[" + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href) {
    if (!href) return;
    var sel = 'link[rel="' + rel + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function pageKey() {
    var body = document.body;
    if (body) {
      var page = body.getAttribute("data-page");
      /* sale and new-arrivals share data-page="showcase" (same template/CSS)
         — tell them apart by path, same disambiguation as js/breadcrumbs.js. */
      if (page === "showcase") {
        return (location.pathname || "").indexOf("sale") !== -1 ? "sale" : "new-arrivals";
      }
      if (page) return page;
    }
    var path = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (path === "/" || path === "/index.html") return "home";
    if (path === "/gift-experience") return "gift";
    if (path.indexOf("/product/") === 0) return "product";
    if (path === "/scent-finder") return "scent-finder";
    var slug = path.split("/").pop() || "";
    return slug.replace(/\.html$/, "") || "home";
  }

  function canonicalUrl() {
    var path = location.pathname || "/";
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
    return location.origin + path;
  }

  function injectJsonLd(baseUrl) {
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Store",
      name: SITE.name,
      description: SITE.taglineEl,
      url: baseUrl.replace(/\/[^/]*$/, "/"),
      image: baseUrl.replace(/\/[^/]*$/, "/") + "logo/logo.png",
      telephone: SITE.phone,
      email: SITE.email,
      areaServed: "GR",
      priceRange: "€€",
      knowsAbout: [
        "scented candles",
        "handmade candles",
        "reed diffusers",
        "home fragrance",
        "aromatic candles Greece",
        "αροματικά κεριά",
        "diffuser",
      ],
      sameAs: [],
    });
    document.head.appendChild(script);
  }

  function init() {
    /* On product pages the server already injects per-product title, meta and
       Schema.org Product (so AI crawlers, which skip JS, can read it). Don't
       overwrite it with the generic storefront SEO. */
    if (document.querySelector('meta[name="seo:product"]')) return;

    var key = pageKey();
    var info = PAGES[key] || {
      title: document.title || SITE.name,
      desc: SITE.taglineEl,
    };
    var url = canonicalUrl();

    document.title = info.title;
    upsertMeta("name", "description", info.desc);
    upsertMeta("name", "keywords", SITE.keywords);
    upsertMeta("name", "robots", info.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE.name);
    upsertMeta("property", "og:title", info.title);
    upsertMeta("property", "og:description", info.desc);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:locale", document.documentElement.lang === "en" ? "en_GR" : "el_GR");
    upsertMeta("property", "og:image", url.replace(/\/[^/]*$/, "/") + "logo/logo.png");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", info.title);
    upsertMeta("name", "twitter:description", info.desc);
    upsertLink("canonical", url);
    injectJsonLd(url);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
