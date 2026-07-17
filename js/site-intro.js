(function () {
  var body = document.body;
  if (!body || body.getAttribute("data-page") !== "home") return;

  var intro = document.getElementById("site-intro");
  var pageWrap = document.querySelector(".page-wrap");
  var hero = document.querySelector(".hero-home");
  var enterBtn = document.getElementById("site-intro-enter");
  var logos = intro && intro.querySelector(".site-intro__logos");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!intro || !pageWrap) return;

  /* Kick off the wordmark letter reveal once the first paint is ready */
  if (logos) {
    if (reduce) {
      logos.classList.add("is-ready");
    } else {
      window.requestAnimationFrame(function () {
        logos.classList.add("is-ready");
      });
    }
  }

  var spacer = document.createElement("div");
  spacer.className = "site-intro-spacer";
  spacer.setAttribute("aria-hidden", "true");
  pageWrap.parentNode.insertBefore(spacer, pageWrap);

  var pagePlaceholder = document.createElement("div");
  pagePlaceholder.className = "site-intro-page-placeholder";
  pagePlaceholder.setAttribute("aria-hidden", "true");
  pageWrap.parentNode.insertBefore(pagePlaceholder, pageWrap.nextSibling);

  var lead = 1;
  var pageHeight = 1;
  var pagePinned = false;
  var ticking = false;
  var syncFrame = 0;
  var lastSyncY = -1;
  var stableFrames = 0;

  function scrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setLenisSize() {
    if (window.__lenis && typeof window.__lenis.resize === "function") {
      try { window.__lenis.resize(); } catch (e) {}
    }
  }

  function measurePage() {
    pageHeight = Math.max(1, pageWrap.scrollHeight || pageWrap.offsetHeight || 1);
    if (pagePinned) {
      pagePlaceholder.style.height = pageHeight + "px";
    }
  }

  function setPagePinned(pinned) {
    if (pinned === pagePinned) return;
    pagePinned = pinned;

    if (pinned) {
      measurePage();
      pagePlaceholder.style.height = pageHeight + "px";
      pageWrap.style.position = "fixed";
      pageWrap.style.top = "0";
      pageWrap.style.left = "0";
      pageWrap.style.right = "0";
      pageWrap.style.width = "100%";
      pageWrap.style.zIndex = "1";
      pageWrap.style.transform = "";
      pageWrap.style.willChange = "";
    } else {
      pageWrap.style.position = "";
      pageWrap.style.top = "";
      pageWrap.style.left = "";
      pageWrap.style.right = "";
      pageWrap.style.width = "";
      pageWrap.style.zIndex = "";
      pageWrap.style.transform = "";
      pageWrap.style.willChange = "";
      pagePlaceholder.style.height = "0px";
    }

    setLenisSize();
  }

  function measure() {
    lead = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    spacer.style.height = lead + "px";
    measurePage();
    update();
    setLenisSize();
  }

  function update() {
    ticking = false;

    var rawY = scrollTop();
    var y = clamp(rawY, 0, lead);
    var lift = y;
    var pin = lead - y;
    var open = y >= lead - 0.5;
    var heroActive = rawY <= lead + ((hero && hero.offsetHeight) || window.innerHeight || 0) * 0.95;

    intro.style.transform = "translate3d(0, -" + lift.toFixed(3) + "px, 0)";
    intro.classList.toggle("is-lifted", open);
    intro.setAttribute("aria-hidden", open ? "true" : "false");

    if (pin > 0.5) {
      setPagePinned(true);
    } else if (heroActive) {
      setPagePinned(false);
    } else {
      setPagePinned(false);
    }

    body.classList.toggle("intro-past", open);
    body.classList.toggle("intro-hero-active", heroActive);
  }

  function syncIntro() {
    var currentY = scrollTop();

    syncFrame = 0;
    update();

    if (Math.abs(currentY - lastSyncY) < 0.01) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      lastSyncY = currentY;
    }

    if (currentY <= lead + 2 && stableFrames < 4) {
      startSync();
    }
  }

  function startSync() {
    if (syncFrame) return;
    stableFrames = 0;
    syncFrame = window.requestAnimationFrame(syncIntro);
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
    if (scrollTop() <= lead + 2) startSync();
  }

  if (reduce) {
    spacer.style.height = "0px";
    pagePlaceholder.style.height = "0px";
    intro.classList.add("is-lifted");
    intro.setAttribute("aria-hidden", "true");
    body.classList.add("intro-past");
    body.classList.add("intro-hero-active");
    return;
  }

  if (enterBtn) {
    enterBtn.addEventListener("click", function () {
      window.scrollTo({ top: lead, behavior: "smooth" });
    });
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { passive: true });

  measure();
  startSync();
})();
