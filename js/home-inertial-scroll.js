(function () {
  var body = document.body;
  if (!body || body.getAttribute("data-page") !== "home") return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var intro = document.getElementById("site-intro");
  var pageWrap = document.querySelector(".page-wrap");
  var hero = document.querySelector(".hero-home");
  var header = document.querySelector(".site-header");
  var enterBtn = document.getElementById("site-intro-enter");

  if (!intro || !pageWrap || !hero) return;

  if (header && header.parentNode !== hero) {
    hero.insertBefore(header, hero.firstChild);
  }

  var state = {
    viewport: null,
    content: null,
    spacer: null,
    raf: 0,
    targetScroll: 0,
    currentScroll: 0,
    maxScroll: 0,
    contentHeight: 0,
    cookieHeight: 0,
    resizeObserver: null,
    mutationObserver: null,
    isRunning: false
  };

  function scrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function visibleHeight() {
    return Math.max(1, window.innerHeight - state.cookieHeight);
  }

  /* How far you scroll to fully raise the intro "shutter" = one screen. While
     within this lead the page content stays pinned and the intro lifts over it;
     past it, the page scrolls normally. */
  function introLead() {
    return visibleHeight();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function measureCookie() {
    var banner = document.getElementById("cookie-banner");
    var panel = banner && banner.querySelector(".cookie-banner__panel");
    var nextHeight = 0;

    if (banner && !banner.hidden && panel) {
      nextHeight = Math.ceil(panel.getBoundingClientRect().height + 24);
    }

    if (nextHeight !== state.cookieHeight) {
      state.cookieHeight = nextHeight;
      document.documentElement.style.setProperty("--cookie-banner-height", nextHeight + "px");
      measure();
    }
  }

  /* Position the pinned content + the lifting intro shutter for a given
     (smoothed) scroll offset. For the first `lead` px the content is held in
     place and only the intro rises; beyond that the content scrolls normally. */
  function applyTransforms(y) {
    var lead = introLead();
    var contentShift = Math.max(0, y - lead);
    var introShift = Math.min(Math.max(0, y), lead);
    if (state.content) {
      state.content.style.transform = "translate3d(0, -" + contentShift.toFixed(3) + "px, 0)";
    }
    if (intro) {
      intro.style.transform = "translate3d(0, -" + introShift.toFixed(3) + "px, 0)";
    }
  }

  function measure() {
    if (!state.content || !state.spacer) return;

    var lead = introLead();
    applyTransforms(state.currentScroll);
    state.contentHeight = Math.ceil(state.content.getBoundingClientRect().height);
    /* extra `lead` of scroll room up front for the shutter to raise */
    state.maxScroll = Math.max(0, state.contentHeight - visibleHeight() + lead);
    state.spacer.style.height = state.contentHeight + lead + state.cookieHeight + "px";
    state.targetScroll = clamp(scrollTop(), 0, state.maxScroll);
    state.currentScroll = clamp(state.currentScroll, 0, state.maxScroll);
    updateBodyState(state.targetScroll);
  }

  function updateBodyState(y) {
    body.classList.toggle("intro-past", y >= introLead() - 2);
  }

  function render() {
    state.targetScroll = clamp(scrollTop(), 0, state.maxScroll);
    state.currentScroll += (state.targetScroll - state.currentScroll) * 0.08;

    if (Math.abs(state.targetScroll - state.currentScroll) < 0.05) {
      state.currentScroll = state.targetScroll;
    }

    applyTransforms(state.currentScroll);
    updateBodyState(state.currentScroll);
    state.raf = window.requestAnimationFrame(render);
  }

  function onResize() {
    measureCookie();
    measure();
  }

  function onScroll() {
    state.targetScroll = clamp(scrollTop(), 0, state.maxScroll);
  }

  function scrollToSecondSection() {
    window.scrollTo({
      top: introLead(),
      behavior: reduceQuery.matches ? "auto" : "smooth"
    });
  }

  function build() {
    if (state.isRunning || reduceQuery.matches) return;

    state.viewport = document.createElement("div");
    state.viewport.className = "home-inertial-viewport";
    state.viewport.setAttribute("aria-hidden", "false");

    state.content = document.createElement("div");
    state.content.className = "home-inertial-content";

    state.spacer = document.createElement("div");
    state.spacer.className = "home-inertial-spacer";
    state.spacer.setAttribute("aria-hidden", "true");

    intro.parentNode.insertBefore(state.viewport, intro);
    state.viewport.appendChild(state.content);
    /* only the page (header + hero + rest) scrolls inside the content; the
       intro is an overlay ABOVE it that lifts like a shutter */
    state.content.appendChild(pageWrap);
    state.viewport.appendChild(intro);
    state.viewport.parentNode.insertBefore(state.spacer, state.viewport.nextSibling);

    body.classList.add("home-inertial-ready");
    state.isRunning = true;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("load", onResize, { passive: true });
    document.addEventListener("nostalgia-cookie-consent-set", measureCookie);

    if (window.ResizeObserver) {
      state.resizeObserver = new ResizeObserver(onResize);
      state.resizeObserver.observe(state.content);
    }

    var banner = document.getElementById("cookie-banner");
    if (window.MutationObserver && banner) {
      state.mutationObserver = new MutationObserver(measureCookie);
      state.mutationObserver.observe(banner, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
    }

    measureCookie();
    measure();
    state.raf = window.requestAnimationFrame(render);
  }

  function destroy() {
    if (!state.isRunning) return;

    window.cancelAnimationFrame(state.raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("load", onResize);
    document.removeEventListener("nostalgia-cookie-consent-set", measureCookie);

    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.mutationObserver) state.mutationObserver.disconnect();

    state.content.style.transform = "";
    if (intro) intro.style.transform = "";
    document.documentElement.style.removeProperty("--cookie-banner-height");

    document.body.insertBefore(intro, state.viewport);
    document.body.insertBefore(pageWrap, state.viewport);
    state.viewport.remove();
    state.spacer.remove();

    body.classList.remove("home-inertial-ready", "intro-past");
    state.isRunning = false;
  }

  function syncReducedMotion() {
    if (reduceQuery.matches) destroy();
    else build();
  }

  if (enterBtn) enterBtn.addEventListener("click", scrollToSecondSection);
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", syncReducedMotion);
  else if (reduceQuery.addListener) reduceQuery.addListener(syncReducedMotion);

  window.NostalgiaHomeInertial = {
    destroy: destroy,
    refresh: onResize
  };

  syncReducedMotion();
})();
