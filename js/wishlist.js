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

  function toggleWishlist(id) {
    var list = getWishlist();
    var idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    saveWishlist(list);
    return isWishlisted(id);
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
