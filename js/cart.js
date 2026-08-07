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

  var CART_BAG_ICON =
    '<span class="cart-link__icon" aria-hidden="true">' +
    '<svg class="cart-bag-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
    '<g class="cart-bag-svg__swing">' +
    '<path class="cart-bag-svg__handle" d="M8.35 9.85c0-2.05 1.62-3.7 3.65-3.7s3.65 1.65 3.65 3.7" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>' +
    '<path class="cart-bag-svg__body" d="M7.35 10.35h9.3v11.3H7.35z" fill="none" stroke="currentColor" stroke-width="1.65"/>' +
    '<rect class="cart-bag-svg__fill" x="8.2" y="14.15" width="7.6" height="7.1" rx="0.35" fill="currentColor"/>' +
    "</g></svg></span>";

  function ensureCartIconMarkup(link) {
    if (!link || link.querySelector(".cart-bag-svg")) return;
    var badge = link.querySelector("#cart-badge") || link.querySelector(".cart-link__badge");
    var badgeHtml =
      badge && badge.outerHTML
        ? badge.outerHTML
        : '<span class="cart-link__badge" id="cart-badge" hidden>0</span>';
    link.innerHTML = CART_BAG_ICON + badgeHtml;
  }

  function pulseCartLink(link) {
    if (!link) return;
    link.classList.remove("cart-link--added");
    void link.offsetWidth;
    link.classList.add("cart-link--added");
    window.setTimeout(function () {
      link.classList.remove("cart-link--added");
    }, 820);
  }

  function updateBadge() {
    var badge = document.getElementById("cart-badge");
    var link = document.getElementById("cart-link");
    if (!badge) return;
    var count = getCount();
    var prev = parseInt(link && link.getAttribute("data-cart-count"), 10) || 0;
    badge.textContent = String(count);
    badge.hidden = count <= 0;
    if (link) {
      link.classList.toggle("cart-link--has-items", count > 0);
      link.setAttribute("data-cart-count", String(count));
      if (count > prev) pulseCartLink(link);
    }
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

  function lineUnitPrice(product) {
    if (window.NostalgiaProducts && typeof window.NostalgiaProducts.getEffectivePrice === "function") {
      return window.NostalgiaProducts.getEffectivePrice(product);
    }
    return product ? product.price : null;
  }

  function getSubtotal() {
    return getLineItems().reduce(function (sum, line) {
      var price = lineUnitPrice(line.product);
      return sum + (price != null ? Number(price) * line.qty : 0);
    }, 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var drawerEl;
  var drawerBodyEl;
  var drawerFootEl;

  function closeOtherOverlays() {
    if (window.NostalgiaSideNav && typeof window.NostalgiaSideNav.close === "function") {
      window.NostalgiaSideNav.close({ restoreFocus: false });
    }
    if (window.NostalgiaSearchDrawer && typeof window.NostalgiaSearchDrawer.close === "function") {
      window.NostalgiaSearchDrawer.close();
    }
    if (window.NostalgiaLocale && typeof window.NostalgiaLocale.close === "function") {
      window.NostalgiaLocale.close();
    }
  }

  function setCartDrawerOpen(open) {
    if (!drawerEl) return;
    drawerEl.hidden = !open;
    drawerEl.setAttribute("aria-hidden", open ? "false" : "true");
    drawerEl.classList.toggle("is-open", open);
    document.body.classList.toggle("cart-drawer-open", open);
    var trigger = document.getElementById("cart-link");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderCartDrawer() {
    if (!drawerBodyEl || !drawerFootEl) return;
    var lines = getLineItems();

    if (!lines.length) {
      drawerBodyEl.innerHTML =
        '<p class="cart-drawer__empty" data-i18n="cart_drawer_empty">' + escapeHtml(t("cart_drawer_empty")) + "</p>";
      drawerFootEl.hidden = true;
      drawerFootEl.innerHTML = "";
      return;
    }

    drawerFootEl.hidden = false;
    drawerBodyEl.innerHTML =
      '<ul class="cart-drawer__list">' +
      lines
        .map(function (line) {
          var p = line.product;
          var url = window.NostalgiaProducts.getProductUrl(p.id);
          return (
            '<li class="cart-drawer__item">' +
            '<a class="cart-drawer__item-media" href="' +
            url +
            '"><img src="' +
            escapeHtml(p.image) +
            '" alt="" width="68" height="68" loading="lazy" decoding="async" /></a>' +
            '<div class="cart-drawer__item-body">' +
            '<span class="cart-drawer__item-cat">' +
            escapeHtml(p.categoryName) +
            "</span>" +
            '<a class="cart-drawer__item-name" href="' +
            url +
            '">' +
            escapeHtml(p.title) +
            "</a>" +
            '<div class="qty-stepper qty-stepper--compact">' +
            '<button type="button" class="qty-stepper__btn" data-qty-minus data-product-id="' +
            escapeHtml(p.id) +
            '" aria-label="-">−</button>' +
            '<input type="number" class="qty-stepper__input" data-qty-input data-product-id="' +
            escapeHtml(p.id) +
            '" value="' +
            line.qty +
            '" min="1" max="99" aria-label="' +
            escapeHtml(t("cart_qty_label")) +
            '" />' +
            '<button type="button" class="qty-stepper__btn" data-qty-plus data-product-id="' +
            escapeHtml(p.id) +
            '" aria-label="+">+</button>' +
            "</div>" +
            '<button type="button" class="cart-drawer__item-remove" data-cart-remove data-product-id="' +
            escapeHtml(p.id) +
            '">' +
            escapeHtml(t("cart_remove")) +
            "</button>" +
            "</div></li>"
          );
        })
        .join("") +
      "</ul>";

    drawerFootEl.innerHTML =
      '<a class="btn-shop btn-shop--primary" href="/checkout" data-i18n="cart_checkout">' +
      escapeHtml(t("cart_checkout")) +
      "</a>" +
      '<a class="btn-shop btn-shop--ghost" href="/cart" data-i18n="cart_view">' +
      escapeHtml(t("cart_view")) +
      "</a>";

    bindQtyControls(drawerBodyEl);
  }

  function ensureCartDrawer() {
    if (drawerEl) return;

    drawerEl = document.createElement("aside");
    drawerEl.id = "cart-drawer";
    drawerEl.className = "cart-drawer";
    drawerEl.hidden = true;
    drawerEl.setAttribute("aria-hidden", "true");
    drawerEl.innerHTML =
      '<div class="cart-drawer__backdrop" data-cart-drawer-close tabindex="-1"></div>' +
      '<div class="cart-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">' +
      '  <button type="button" class="cart-drawer__close" data-cart-drawer-close aria-label="' +
      escapeHtml(t("toast_close_aria")) +
      '">×</button>' +
      '  <header class="cart-drawer__head">' +
      '    <h2 class="cart-drawer__title" id="cart-drawer-title" data-i18n="cart_heading">' +
      escapeHtml(t("cart_heading")) +
      "</h2>" +
      "  </header>" +
      '  <div class="cart-drawer__body" data-cart-drawer-body></div>' +
      '  <footer class="cart-drawer__foot" data-cart-drawer-foot hidden></footer>' +
      "</div>";
    document.body.appendChild(drawerEl);

    drawerBodyEl = drawerEl.querySelector("[data-cart-drawer-body]");
    drawerFootEl = drawerEl.querySelector("[data-cart-drawer-foot]");

    drawerEl.querySelectorAll("[data-cart-drawer-close]").forEach(function (el) {
      el.addEventListener("click", closeCartDrawer);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawerEl && drawerEl.classList.contains("is-open")) closeCartDrawer();
    });

    window.addEventListener("nostalgia-cart-updated", function () {
      if (drawerEl && drawerEl.classList.contains("is-open")) renderCartDrawer();
    });

    window.addEventListener("nostalgia-i18n-updated", function () {
      if (!drawerEl) return;
      var title = drawerEl.querySelector("#cart-drawer-title");
      if (title) title.textContent = t("cart_heading");
      var closeBtn = drawerEl.querySelector(".cart-drawer__close");
      if (closeBtn) closeBtn.setAttribute("aria-label", t("toast_close_aria"));
      if (drawerEl.classList.contains("is-open")) renderCartDrawer();
      if (modalEl && !modalEl.hidden) {
        var modalTitle = modalEl.querySelector("[data-i18n='cart_added_title']");
        if (modalTitle) modalTitle.textContent = t("cart_added_title");
        modalEl.querySelectorAll("[data-i18n]").forEach(function (el) {
          var key = el.getAttribute("data-i18n");
          if (key) el.textContent = t(key);
        });
        var modalClose = modalEl.querySelector(".cart-modal__close");
        if (modalClose) modalClose.setAttribute("aria-label", t("toast_close_aria"));
      }
    });
  }

  function openCartDrawer() {
    ensureCartDrawer();
    closeOtherOverlays();
    renderCartDrawer();
    setCartDrawerOpen(true);
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
    window.setTimeout(function () {
      var closeBtn = drawerEl.querySelector(".cart-drawer__close");
      if (closeBtn) closeBtn.focus();
    }, 420);
  }

  function closeCartDrawer() {
    setCartDrawerOpen(false);
    var trigger = document.getElementById("cart-link");
    if (trigger) trigger.focus();
  }

  function bindCartLinkClick(link) {
    if (!link || link.getAttribute("data-cart-click-bound") === "1") return;
    link.setAttribute("data-cart-click-bound", "1");
    link.setAttribute("aria-controls", "cart-drawer");
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (drawerEl && drawerEl.classList.contains("is-open")) closeCartDrawer();
      else openCartDrawer();
    });
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
      '  <button type="button" class="cart-modal__close" data-cart-modal-close aria-label="' +
      escapeHtml(t("toast_close_aria")) +
      '">' +
      '    <span aria-hidden="true">×</span>' +
      "  </button>" +
      '  <div class="cart-modal__icon" aria-hidden="true">' +
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
      "  </div>" +
      '  <p class="cart-modal__title" data-i18n="cart_added_title">Το προϊόν προστέθηκε στο καλάθι σου</p>' +
      '  <div class="cart-modal__preview" id="cart-modal-preview"></div>' +
      '  <div class="cart-modal__actions">' +
      '    <a class="btn-shop btn-shop--primary" href="/cart" data-i18n="cart_view">Δες το καλάθι σου</a>' +
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
      link = document.createElement("button");
      link.type = "button";
      link.className = "cart-link";
      link.id = "cart-link";
      link.setAttribute("data-i18n-aria", "cart_aria");
      link.innerHTML =
        CART_BAG_ICON + '<span class="cart-link__badge" id="cart-badge" hidden>0</span>';
    } else {
      ensureCartIconMarkup(link);
      if (link.tagName === "A") {
        var next = document.createElement("button");
        next.type = "button";
        next.className = link.className;
        next.id = link.id;
        Array.prototype.slice.call(link.attributes).forEach(function (attr) {
          if (attr.name === "href" || attr.name === "id" || attr.name === "class") return;
          next.setAttribute(attr.name, attr.value);
        });
        next.innerHTML = link.innerHTML;
        link.parentNode.replaceChild(next, link);
        link = next;
      }
    }

    bindCartLinkClick(link);

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
        var id = btn.getAttribute("data-product-id");
        var row = btn.closest(".cart-line, .cart-drawer__item");
        collapseRow(row, function () {
          removeItem(id);
          if (window.NostalgiaCartPage && window.NostalgiaCartPage.render) {
            window.NostalgiaCartPage.render();
          }
        });
      });
    });
  }

  /* Removing a line rebuilds the whole list with innerHTML, so the row cannot
     animate itself out afterwards — by then it no longer exists. It has to
     finish leaving first, and only then trigger the rebuild.

     The transition is set inline rather than in the stylesheet on purpose: the
     row only ever animates while being removed, and a permanent transition on
     .cart-line would also fire on quantity edits and re-renders.

     Height/margin/padding are frozen to their measured values before being
     driven to zero, because `height: auto` is not interpolable. */
  function collapseRow(row, done) {
    var reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!row || reduced) {
      done();
      return;
    }

    var cs = window.getComputedStyle(row);
    row.style.overflow = "hidden";
    row.style.height = row.getBoundingClientRect().height + "px";
    row.style.marginTop = cs.marginTop;
    row.style.marginBottom = cs.marginBottom;
    row.style.paddingTop = cs.paddingTop;
    row.style.paddingBottom = cs.paddingBottom;
    row.style.transition =
      "opacity 200ms var(--polish-ease, cubic-bezier(0.22, 1, 0.36, 1)), transform 200ms var(--polish-ease, cubic-bezier(0.22, 1, 0.36, 1))," +
      "height 180ms var(--polish-ease, cubic-bezier(0.22, 1, 0.36, 1)) 60ms, margin 180ms var(--polish-ease, cubic-bezier(0.22, 1, 0.36, 1)) 60ms," +
      "padding 180ms var(--polish-ease, cubic-bezier(0.22, 1, 0.36, 1)) 60ms";
    void row.offsetHeight;

    row.style.opacity = "0";
    row.style.transform = "translateX(-0.5rem)";
    row.style.height = "0px";
    row.style.marginTop = "0px";
    row.style.marginBottom = "0px";
    row.style.paddingTop = "0px";
    row.style.paddingBottom = "0px";

    /* transitionend can be missed — an interrupted transition or a row already
       at zero height never fires it — and a cart line that refuses to
       disappear is worse than one that skips its animation. */
    var settled = false;
    var settle = function () {
      if (settled) return;
      settled = true;
      done();
    };
    row.addEventListener("transitionend", function (e) {
      if (e.propertyName === "height") settle();
    });
    window.setTimeout(settle, 420);
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
    openDrawer: openCartDrawer,
    closeDrawer: closeCartDrawer,
    closeModal: closeModal,
    bindQtyControls: bindQtyControls,
    ensureHeaderCorner: ensureHeaderCorner,
    refreshHeaderCart: injectHeaderCart,
    addAndNotify: function (productId, qty) {
      addItem(productId, qty);
      showCartToast(productId);
    },
    /* Exposed so the wishlist can reuse the same toast rather than grow a
       second, slightly-different one. */
    notify: function (productId, opts) {
      showCartToast(productId, opts);
    },
  };

  var toastEl;
  var toastTimer;

  /* Shared by the cart and the wishlist. The element, the timing and the CSS
     stay in one place so "added" always looks the same wherever it happens —
     the wishlist previously confirmed nothing at all, which left the heart
     looking broken on the first tap. */
  function showCartToast(productId, opts) {
    opts = opts || {};
    var titleKey = opts.titleKey || "cart_toast_added";
    var linkHref = opts.linkHref || "/cart";
    var linkKey = opts.linkKey || "cart_view";

    if (!window.NostalgiaProducts) return;
    var product = window.NostalgiaProducts.getById(productId);
    if (!product) return;
    if (!toastEl) {
      toastEl = document.createElement("aside");
      toastEl.className = "cart-toast";
      toastEl.id = "cart-toast";
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML =
      '<img class="cart-toast__thumb" src="' +
      product.image +
      '" alt="" width="44" height="44" decoding="async" />' +
      '<div class="cart-toast__body">' +
      '  <p class="cart-toast__title" data-i18n="' + titleKey + '">' +
      t(titleKey) +
      "</p>" +
      '  <p class="cart-toast__name">' +
      product.title +
      "</p>" +
      "</div>" +
      '<a class="cart-toast__link" href="' + linkHref + '" data-i18n="' + linkKey + '">' +
      t(linkKey) +
      "</a>";
    toastEl.classList.remove("is-visible");
    void toastEl.offsetWidth;
    toastEl.classList.add("is-visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 3200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
