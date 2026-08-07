(function () {
  var WISHLIST_KEY = "nostalgia-wishlist";

  function getWishlist() {
    try {
      var raw = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(function (id) { return typeof id === "string" && id; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(list) {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("nostalgia-wishlist-updated"));
    } catch (e) {}
  }

  function isWishlisted(id) {
    return getWishlist().indexOf(id) !== -1;
  }

  /* Confirmation fires on add only. Removing something is already self-evident
     — the heart empties and, on the wishlist page, the card leaves — whereas
     adding from a product card gave no sign at all that anything happened. */
  function toggleWishlist(id, trigger) {
    var list = getWishlist();
    var idx = list.indexOf(id);
    var added = idx === -1;
    if (added) list.push(id);
    else list.splice(idx, 1);
    saveWishlist(list);

    if (added) {
      pulseHeart(trigger);
      if (window.NostalgiaCart && window.NostalgiaCart.notify) {
        window.NostalgiaCart.notify(id, {
          titleKey: "wishlist_toast_added",
          linkHref: "/wishlist",
          linkKey: "wishlist_view",
        });
      }
    }

    return isWishlisted(id);
  }

  /* Reuses the site's existing `is-heart-pulse` beat (css/polish.css) rather
     than inventing a second one — site-polish.js already drives it for the
     product page button, and this extends the same class to the heart on every
     product card.

     Removed and re-added with a reflow between, so a second tap replays the
     beat instead of doing nothing because the class is still on. */
  function pulseHeart(el) {
    if (!el || !el.classList) return;
    var reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    el.classList.remove("is-heart-pulse");
    void el.offsetWidth;
    el.classList.add("is-heart-pulse");
    window.setTimeout(function () {
      el.classList.remove("is-heart-pulse");
    }, 600);
  }

  function removeFromWishlist(id) {
    var list = getWishlist().filter(function (item) { return item !== id; });
    saveWishlist(list);
  }

  function getCount() {
    return getWishlist().length;
  }

  window.NostalgiaWishlist = {
    getAll: getWishlist,
    save: saveWishlist,
    has: isWishlisted,
    toggle: toggleWishlist,
    remove: removeFromWishlist,
    getCount: getCount,
  };
})();
