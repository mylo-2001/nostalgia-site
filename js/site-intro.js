(function () {
  var body = document.body;
  if (!body || body.getAttribute("data-page") !== "home") return;

  var INTRO_SEEN_KEY = "nostalgia-intro-seen";
  var intro = document.getElementById("site-intro");
  var pageWrap = document.querySelector(".page-wrap");
  var hero = document.querySelector(".hero-home");
  var enterBtn = document.getElementById("site-intro-enter");
  var logos = intro && intro.querySelector(".site-intro__logos");
  // Respect reduced-motion by default. Developers can opt in temporarily
  // with localStorage.setItem("nostalgia-force-site-motion", "1").
  var forceSiteMotion = false;
  try {
    forceSiteMotion =
      window.localStorage.getItem("nostalgia-force-site-motion") === "1";
  } catch (error) {
    forceSiteMotion = false;
  }
  document.documentElement.classList.toggle("force-site-motion", forceSiteMotion);
  var reduce =
    !forceSiteMotion &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!intro || !pageWrap) return;

  function hasSeenIntro() {
    try {
      return sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch (e) {}
  }

  /* Returning to home: land past the curtain (don't replay entry).
     Intro stays available if the user scrolls back to the top. */
  var resumePastIntro = hasSeenIntro() && !reduce;

  if (resumePastIntro) {
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    } catch (e) {}
  }

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
  var seenMarked = false;

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

  function scrollToY(y, smooth) {
    y = Math.max(0, y);
    if (window.__lenis && typeof window.__lenis.scrollTo === "function") {
      try {
        window.__lenis.scrollTo(y, { immediate: !smooth });
        return;
      } catch (e) {}
    }
    window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" });
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
    } else {
      setPagePinned(false);
    }

    body.classList.toggle("intro-past", open);
    body.classList.toggle("intro-hero-active", heroActive);

    if (open && !seenMarked) {
      seenMarked = true;
      markIntroSeen();
    }
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
    markIntroSeen();
    return;
  }

  if (enterBtn) {
    enterBtn.addEventListener("click", function () {
      markIntroSeen();
      scrollToY(lead, true);
    });
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { passive: true });

  measure();

  if (resumePastIntro) {
    markIntroSeen();
    scrollToY(lead, false);
    update();
    try {
      document.documentElement.classList.remove("intro-resume");
    } catch (e) {}
  }

  startSync();
})();
