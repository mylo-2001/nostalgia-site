(function () {
  function initToast() {
    var introToast = document.getElementById("eshop-toast");
    var contactToast = document.getElementById("contact-toast");
    var contactClose = document.getElementById("contact-toast-close");
    if (!introToast || !contactToast) return;

    var showDelayMs = 1400;
    var visibleMs = 4600;

    function showContactToast() {
      contactToast.classList.remove("is-hiding");
      contactToast.classList.add("is-visible");
    }

    function hideContactToast() {
      contactToast.classList.add("is-hiding");
      contactToast.classList.remove("is-visible");
    }

    if (contactClose) {
      contactClose.addEventListener("click", hideContactToast);
    }

    window.setTimeout(function () {
      introToast.classList.add("is-visible");

      window.setTimeout(function () {
        introToast.classList.add("is-hiding");
        introToast.classList.remove("is-visible");
      }, visibleMs);
    }, showDelayMs);

    introToast.addEventListener("animationend", function (event) {
      if (event.animationName !== "eshopToastOut") return;
      showContactToast();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToast);
  } else {
    initToast();
  }
})();
