(function () {
  function initToast() {
    var contactToast = document.getElementById("contact-toast");
    var contactClose = document.getElementById("contact-toast-close");
    if (!contactToast) return;

    var showDelayMs = 1400;

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

    window.setTimeout(showContactToast, showDelayMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToast);
  } else {
    initToast();
  }
})();
