(function () {
  var wraps = document.querySelectorAll(".site-nav__item--mega");
  if (!wraps.length) return;

  var canHover =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  wraps.forEach(function (wrap) {
    var trigger = wrap.querySelector(".site-nav__mega-trigger");
    var panel = wrap.querySelector(".nav-mega");
    if (!trigger || !panel) return;

    var closeTimer = null;

    function open() {
      window.clearTimeout(closeTimer);
      wrap.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      panel.removeAttribute("hidden");
    }

    function close() {
      wrap.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      if (!canHover) {
        panel.setAttribute("hidden", "");
      }
    }

    function scheduleClose() {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(close, 160);
    }

    if (canHover) {
      wrap.addEventListener("mouseenter", open);
      wrap.addEventListener("mouseleave", scheduleClose);
      panel.addEventListener("mouseenter", open);
      panel.addEventListener("mouseleave", scheduleClose);
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
      trigger.addEventListener("click", function (e) {
        if (!wrap.classList.contains("is-open")) {
          e.preventDefault();
          open();
        }
      });
      document.addEventListener("click", function (e) {
        if (!wrap.contains(e.target)) close();
      });
    }

    trigger.addEventListener("focus", open);
    wrap.addEventListener("focusout", function (e) {
      if (!wrap.contains(e.relatedTarget)) scheduleClose();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  });
})();
