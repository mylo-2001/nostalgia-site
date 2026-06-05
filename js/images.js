/**
 * WebP + responsive srcset helpers (pairs with tools/build-images.py output).
 */
(function () {
  var WIDTHS = [480, 960, 1440];

  function decodePath(path) {
    try {
      return decodeURIComponent(path);
    } catch (e) {
      return path;
    }
  }

  function encodePath(path) {
    return path
      .split("/")
      .map(function (seg) {
        return encodeURIComponent(seg);
      })
      .join("/");
  }

  function stripExt(url) {
    return decodePath(url).replace(/\.(png|jpe?g|webp)$/i, "");
  }

  function webpUrl(src, width) {
    var base = stripExt(src);
    if (width) return encodePath(base + "-" + width + "w.webp");
    return encodePath(base + ".webp");
  }

  function webpSrcSet(src) {
    return WIDTHS.map(function (w) {
      return webpUrl(src, w) + " " + w + "w";
    }).join(", ");
  }

  function isAlreadyOptimized(img) {
    return !img || img.dataset.webp === "1" || !!img.closest("picture");
  }

  function wrapPicture(img, pngSrc, options) {
    options = options || {};
    if (!img || !pngSrc || !/\.png$/i.test(decodePath(pngSrc))) return img;
    if (img.closest("picture")) return img;

    var sizes = options.sizes || img.getAttribute("sizes") || "100vw";
    var picture = document.createElement("picture");
    var source = document.createElement("source");
    source.type = "image/webp";
    source.srcset = webpSrcSet(pngSrc);
    source.sizes = sizes;

    img.src = pngSrc;
    img.setAttribute("sizes", sizes);
    if (options.priority) {
      img.setAttribute("fetchpriority", "high");
      img.setAttribute("decoding", "sync");
    } else if (!img.getAttribute("loading")) {
      img.setAttribute("loading", options.loading || "lazy");
    }
    if (!img.getAttribute("decoding")) {
      img.setAttribute("decoding", "async");
    }

    picture.appendChild(source);
    picture.appendChild(img);
    return picture;
  }

  function upgradeImg(img, options) {
    if (isAlreadyOptimized(img)) {
      if (img) img.dataset.webp = "1";
      return img;
    }
    var src = img.getAttribute("src");
    if (!src || !/\.png$/i.test(decodePath(src))) return img;
    var parent = img.parentNode;
    if (!parent) return img;
    var picture = wrapPicture(img, src, options || {});
    if (picture === img) return img;
    parent.replaceChild(picture, img);
    img.dataset.webp = "1";
    return img;
  }

  function createPicture(pngSrc, options) {
    options = options || {};
    var img = document.createElement("img");
    img.alt = options.alt || "";
    if (options.width) img.width = options.width;
    if (options.height) img.height = options.height;
    if (options.className) img.className = options.className;
    if (options.loading) img.loading = options.loading;
    return wrapPicture(img, pngSrc, options);
  }

  function upgradeAll(root, selector) {
    (root || document).querySelectorAll(selector || 'img[src*=".png"]').forEach(function (img) {
      upgradeImg(img);
    });
  }

  function initImageUpgrades() {
    document.querySelectorAll('img[src*=".png"]').forEach(function (img) {
      if (img.closest("picture")) {
        img.dataset.webp = "1";
        return;
      }
      if (img.classList.contains("home-collections__feature-img")) {
        img.setAttribute("sizes", "(max-width: 900px) 100vw, 50vw");
      } else if (img.closest(".home-collections__carousel-slide")) {
        img.setAttribute("sizes", "(max-width: 640px) 100vw, 50vw");
      } else if (img.closest(".home-collections__new-media")) {
        img.setAttribute("sizes", "(max-width: 900px) 100vw, 50vw");
      }
      upgradeImg(img);
    });
  }

  window.NostalgiaImages = {
    webp: webpUrl,
    srcSet: webpSrcSet,
    wrap: wrapPicture,
    upgrade: upgradeImg,
    create: createPicture,
    upgradeAll: upgradeAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageUpgrades);
  } else {
    initImageUpgrades();
  }
})();
