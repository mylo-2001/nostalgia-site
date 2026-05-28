(function () {
  var root = document.querySelector("[data-about-tabs]");
  if (!root) return;

  var tabs = root.querySelectorAll(".about-tab");
  var panels = root.querySelectorAll(".about-panel");
  var panelsWrap = root.querySelector(".about-panels");
  if (!tabs.length || !panels.length || !panelsWrap) return;

  var SWITCH_MS = 560;
  var REVEAL_SEL =
    ".about-story__p, .about-soul__title, .about-story__quote, .about-vision__signature";
  var switching = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resetPanelReveal(panel) {
    if (!panel) return;
    panel.querySelectorAll(REVEAL_SEL).forEach(function (el) {
      el.classList.remove("is-visible");
    });
    var split = panel.querySelector(".about-split");
    if (split) split.classList.remove("is-visible");
  }

  function revealPanelParagraphs(panel, delay) {
    delay = delay || 0;
    var split = panel.querySelector(".about-split");
    if (split) {
      window.setTimeout(function () {
        split.classList.add("is-visible");
      }, delay + 80);
    }

    panel.querySelectorAll(REVEAL_SEL).forEach(function (el, i) {
      el.classList.remove("is-visible");
      window.setTimeout(function () {
        el.classList.add("is-visible");
      }, delay + 160 + i * 120);
    });
  }

  function hashTab() {
    var h = (location.hash || "").replace(/^#/, "");
    return h === "soul" || h === "story" || h === "vision" ? h : null;
  }

  function updateTabs(id) {
    tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-about-tab") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function afterPanelShown(panel, delay) {
    revealPanelParagraphs(panel, delay || 120);
  }

  function showPanelInstant(next, id, opts) {
    panels.forEach(function (panel) {
      var active = panel === next;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
      panel.classList.remove("is-leaving", "is-entering");
    });
    updateTabs(id);
    if (!opts || !opts.skipHash) {
      try {
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search + "#" + id);
        } else {
          location.hash = id;
        }
      } catch (e) {}
    }
    if (id !== "story") revealPanelParagraphs(next, 0);
    else afterPanelShown(next, 0);
  }

  function activate(id, opts) {
    opts = opts || {};
    if (id !== "story" && id !== "soul" && id !== "vision") return;

    var next = root.querySelector('[data-about-panel="' + id + '"]');
    if (!next) return;

    var current = root.querySelector(".about-panel.is-active");
    if (current === next && !opts.force) return;

    updateTabs(id);

    if (!opts.skipHash) {
      try {
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search + "#" + id);
        } else {
          location.hash = id;
        }
      } catch (e) {}
    }

    if (!current || reduceMotion || opts.instant) {
      showPanelInstant(next, id, { skipHash: true });
      return;
    }

    if (switching) return;
    switching = true;

    panelsWrap.style.minHeight = current.offsetHeight + "px";
    current.classList.add("is-leaving");
    current.classList.remove("is-active");

    window.setTimeout(function () {
      current.classList.remove("is-leaving");
      current.hidden = true;
      resetPanelReveal(current);

      next.hidden = false;
      next.classList.add("is-active", "is-entering");

      window.requestAnimationFrame(function () {
        next.classList.remove("is-entering");
        panelsWrap.style.minHeight = next.offsetHeight + "px";

        if (id === "story") {
          afterPanelShown(next, 80);
        } else {
          revealPanelParagraphs(next, 120);
        }
      });

      window.setTimeout(function () {
        panelsWrap.style.minHeight = "";
        switching = false;
      }, SWITCH_MS + 100);
    }, SWITCH_MS);
  }

  window.NostalgiaActivateAboutTab = activate;

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-about-tab");
      if (!id || tab.classList.contains("is-active")) return;
      activate(id);
    });
  });

  var fromHash = hashTab();
  if (fromHash) {
    activate(fromHash, { skipHash: true, instant: true });
  }

  window.addEventListener("hashchange", function () {
    var h = hashTab();
    if (h) activate(h, { skipHash: true });
  });

  if (reduceMotion) {
    panels.forEach(function (panel) {
      panel.querySelectorAll(REVEAL_SEL).forEach(function (p) {
        p.classList.add("is-visible");
      });
      var split = panel.querySelector(".about-split");
      if (split) split.classList.add("is-visible");
    });
  }
})();
