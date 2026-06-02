(function () {
  var STORAGE_KEY = "nostalgia-cart";

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
    updateBadge();
    window.dispatchEvent(new CustomEvent("nostalgia-cart-updated"));
  }

  function getCount() {
    return readCart().reduce(function (sum, item) {
      return sum + (item.qty || 0);
    }, 0);
  }

  function updateBadge() {
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    var count = getCount();
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }

  function addItem(productId, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var items = readCart();
    var found = items.find(function (item) {
      return item.id === productId;
    });
    if (found) {
      found.qty += qty;
    } else {
      items.push({ id: productId, qty: qty });
    }
    writeCart(items);
    return items;
  }

  function setQty(productId, qty) {
    qty = parseInt(qty, 10);
    var items = readCart();
    if (qty <= 0) {
      items = items.filter(function (item) {
        return item.id !== productId;
      });
    } else {
      items = items.map(function (item) {
        if (item.id === productId) {
          return { id: productId, qty: qty };
        }
        return item;
      });
    }
    writeCart(items);
    return items;
  }

  function removeItem(productId) {
    var items = readCart().filter(function (item) {
      return item.id !== productId;
    });
    writeCart(items);
    return items;
  }

  function clearCart() {
    writeCart([]);
  }

  function getLineItems() {
    if (!window.NostalgiaProducts) return [];
    return readCart()
      .map(function (item) {
        var product = window.NostalgiaProducts.getById(item.id);
        if (!product) return null;
        return {
          id: item.id,
          qty: item.qty,
          product: product,
        };
      })
      .filter(Boolean);
  }

  function getSubtotal() {
    return 0;
  }

  var modalEl;
  var modalBackdrop;

  function ensureModal() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "cart-modal";
    modalEl.id = "cart-modal";
    modalEl.hidden = true;
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.innerHTML =
      '<div class="cart-modal__backdrop" data-cart-modal-close></div>' +
      '<div class="cart-modal__panel">' +
      '  <button type="button" class="cart-modal__close" data-cart-modal-close aria-label="Close">' +
      '    <span aria-hidden="true">×</span>' +
      "  </button>" +
      '  <div class="cart-modal__icon" aria-hidden="true">' +
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
      "  </div>" +
      '  <p class="cart-modal__title" data-i18n="cart_added_title">Το προϊόν προστέθηκε στο καλάθι σου</p>' +
      '  <div class="cart-modal__preview" id="cart-modal-preview"></div>' +
      '  <div class="cart-modal__actions">' +
      '    <a class="btn-shop btn-shop--primary" href="cart.html" data-i18n="cart_view">Δες το καλάθι σου</a>' +
      '    <button type="button" class="btn-shop btn-shop--ghost" data-cart-modal-close data-i18n="cart_continue">Συνέχεια αγορών</button>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(modalEl);
    modalBackdrop = modalEl.querySelector(".cart-modal__backdrop");
    modalEl.querySelectorAll("[data-cart-modal-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl && !modalEl.hidden) closeModal();
    });
  }

  function openModal(productId) {
    ensureModal();
    var preview = document.getElementById("cart-modal-preview");
    if (preview && window.NostalgiaProducts) {
      var product = window.NostalgiaProducts.getById(productId);
      if (product) {
        preview.innerHTML =
          '<figure class="cart-modal__item">' +
          '  <img src="' +
          product.image +
          '" alt="" width="72" height="72" decoding="async" />' +
          '  <figcaption><span class="cart-modal__item-name">' +
          product.title +
          "</span></figcaption>" +
          "</figure>";
      } else {
        preview.innerHTML = "";
      }
    }
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang());
    }
    modalEl.hidden = false;
    document.body.classList.add("cart-modal-open");
    var closeBtn = modalEl.querySelector(".cart-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.classList.remove("cart-modal-open");
  }

  function getHeaderActionsMount() {
    var tools = document.querySelector(".site-header__tools");
    var bar = document.querySelector(".site-header__bar");
    var header = document.querySelector(".site-header");
    var isMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) return bar || header;
    return tools || bar || header;
  }

  function ensureHeaderCorner() {
    var mount = getHeaderActionsMount();
    if (!mount) return null;

    var corner = document.getElementById("site-header-corner");
    if (!corner) {
      corner = document.createElement("div");
      corner.className = "site-header__corner";
      corner.id = "site-header-corner";
      mount.appendChild(corner);
    } else if (corner.parentNode !== mount) {
      mount.appendChild(corner);
    }
    return corner;
  }

  function injectHeaderCart() {
    var header = document.querySelector(".site-header");
    var navRight = document.querySelector(".site-nav--right");
    if (!header) return;

    var link = document.getElementById("cart-link");
    if (!link) {
      link = document.createElement("a");
      link.href = "cart.html";
      link.className = "cart-link";
      link.id = "cart-link";
      link.setAttribute("data-i18n-aria", "cart_aria");
      link.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
        '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
        "</svg>" +
        '<span class="cart-link__badge" id="cart-badge" hidden>0</span>';
    }

    var toolsWrap = navRight && navRight.querySelector(".site-nav__tools");
    var themeBtn = document.getElementById("theme-toggle");
    if (toolsWrap && navRight && themeBtn && toolsWrap.contains(themeBtn)) {
      var langBtn = document.getElementById("lang-toggle");
      if (langBtn && langBtn.parentNode === navRight) {
        navRight.insertBefore(themeBtn, langBtn.nextSibling);
      } else {
        navRight.appendChild(themeBtn);
      }
      toolsWrap.remove();
    }

    link.classList.remove("cart-link--corner");
    var corner = ensureHeaderCorner();
    if (corner && link.parentNode !== corner) {
      corner.appendChild(link);
    }

    updateBadge();
  }

  function bindQtyControls(root) {
    if (!root) return;
    root.querySelectorAll("[data-qty-minus]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-product-id");
        var input = root.querySelector('[data-qty-input][data-product-id="' + id + '"]');
        var val = input ? parseInt(input.value, 10) || 1 : 1;
        setQty(id, val - 1);
        if (window.NostalgiaCartPage && window.NostalgiaCartPage.render) {
          window.NostalgiaCartPage.render();
        }
      });
    });
    root.querySelectorAll("[data-qty-plus]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-product-id");
        var input = root.querySelector('[data-qty-input][data-product-id="' + id + '"]');
        var val = input ? parseInt(input.value, 10) || 1 : 1;
        setQty(id, val + 1);
        if (window.NostalgiaCartPage && window.NostalgiaCartPage.render) {
          window.NostalgiaCartPage.render();
        }
      });
    });
    root.querySelectorAll("[data-qty-input]").forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-product-id");
        setQty(id, parseInt(input.value, 10) || 1);
        if (window.NostalgiaCartPage && window.NostalgiaCartPage.render) {
          window.NostalgiaCartPage.render();
        }
      });
    });
    root.querySelectorAll("[data-cart-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        removeItem(btn.getAttribute("data-product-id"));
        if (window.NostalgiaCartPage && window.NostalgiaCartPage.render) {
          window.NostalgiaCartPage.render();
        }
      });
    });
  }

  function init() {
    injectHeaderCart();
    updateBadge();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        injectHeaderCart();
      }, 120);
    });
  }

  window.NostalgiaCart = {
    addItem: addItem,
    setQty: setQty,
    removeItem: removeItem,
    clearCart: clearCart,
    getCount: getCount,
    getLineItems: getLineItems,
    getSubtotal: getSubtotal,
    showAddedModal: openModal,
    closeModal: closeModal,
    bindQtyControls: bindQtyControls,
    ensureHeaderCorner: ensureHeaderCorner,
    refreshHeaderCart: injectHeaderCart,
    addAndNotify: function (productId, qty) {
      addItem(productId, qty);
      openModal(productId);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
