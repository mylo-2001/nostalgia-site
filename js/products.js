(function () {
  var CAT_IDS = ["cat1", "cat2", "cat3", "cat4"];

  function muranoImg(n) {
    return "product%20photo/art%20class%20murano%20candle/product%20" + n + ".png";
  }
  function driftwoodImg(name) {
    return "product%20photo/driftwood%20beeswax%20flame/" + name;
  }
  function liquidImg(n) {
    return "product%20photo/liquid%20eternal/product%20" + n + ".png";
  }
  function vesselImg(n) {
    return "product%20photo/unique%20art%20vessel/product%20" + n + ".png";
  }

  var CAT_IMAGES = {
    cat1: [
      muranoImg(1), muranoImg(2), muranoImg(3),
      muranoImg(4), muranoImg(5), muranoImg(6),
      muranoImg(7), muranoImg(8), muranoImg(9),
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
      liquidImg(1), liquidImg(2), liquidImg(3), liquidImg(4),
      liquidImg(5), liquidImg(6), liquidImg(7), liquidImg(8),
      liquidImg(9), liquidImg(10), liquidImg(11), liquidImg(12),
      liquidImg(13), liquidImg(14), liquidImg(15), liquidImg(16),
      liquidImg(17),
    ],
    cat4: [
      vesselImg(1), vesselImg(2), vesselImg(3), vesselImg(4),
      vesselImg(5), vesselImg(6), vesselImg(7), vesselImg(8),
    ],
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

  function getTitle(catId, index) {
    var titleKey = buildProductKey(catId, index, "title");
    var raw = t(titleKey);
    if (raw && raw !== titleKey && raw.trim()) {
      return raw.trim();
    }
    return t("collection_" + catId) + " · " + index;
  }

  function buildCatalog() {
    var list = [];
    CAT_IDS.forEach(function (catId) {
      var images = CAT_IMAGES[catId] || [];
      for (var i = 1; i <= images.length; i++) {
        list.push({
          id: catId + "-" + i,
          catId: catId,
          index: i,
          image: images[i - 1],
          titleKey: buildProductKey(catId, i, "title"),
        });
      }
    });
    return list;
  }

  var catalog = buildCatalog();
  var byId = {};
  catalog.forEach(function (p) {
    byId[p.id] = p;
  });

  function refreshTitles() {
    catalog.forEach(function (p) {
      p.title = getTitle(p.catId, p.index);
      p.categoryName = t("collection_" + p.catId);
    });
  }

  refreshTitles();

  function getCountByCategory(catId) {
    return (CAT_IMAGES[catId] || []).length;
  }

  function getTotalCount() {
    return catalog.length;
  }

  window.NostalgiaProducts = {
    CAT_IDS: CAT_IDS,
    CAT_IMAGES: CAT_IMAGES,
    getAll: function () {
      refreshTitles();
      return catalog.slice();
    },
    getById: function (id) {
      refreshTitles();
      return byId[id] || null;
    },
    getCountByCategory: getCountByCategory,
    getTotalCount: getTotalCount,
    getTitle: getTitle,
    getProductUrl: function (id) {
      return "product.html?id=" + encodeURIComponent(id);
    },
    refresh: refreshTitles,
  };

  window.NostalgiaOnLangApplied = (function (prev) {
    return function () {
      refreshTitles();
      if (typeof prev === "function") prev();
    };
  })(window.NostalgiaOnLangApplied);
})();
