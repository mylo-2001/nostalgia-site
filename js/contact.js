(function () {
  function getLocalizedStatus() {
    var lang = document.documentElement.lang === "en" ? "en" : "el";
    if (lang === "en") {
      return "Your email app opened. Please review and send your message.";
    }
    return "Άνοιξε η εφαρμογή email. Ελέγξτε το μήνυμα και πατήστε αποστολή.";
  }

  function initContactEmailForm() {
    var form = document.getElementById("contact-email-form");
    if (!form) return;
    var statusEl = document.getElementById("contact-form-status");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var name = (form.name.value || "").trim();
      var firstName = (form.firstName.value || "").trim();
      var email = (form.email.value || "").trim();
      var phone = (form.phone.value || "").trim();
      var country = form.country && form.country.selectedOptions[0]
        ? form.country.selectedOptions[0].text.trim()
        : "-";
      var subject = form.subject && form.subject.selectedOptions[0]
        ? form.subject.selectedOptions[0].text.trim()
        : "";
      var message = (form.message.value || "").trim();

      var lang = document.documentElement.lang === "en" ? "en" : "el";
      var labels = lang === "en"
        ? {
            lastName: "Last name",
            firstName: "First name",
            email: "Email",
            phone: "Phone",
            country: "Country",
            subject: "Subject",
            message: "Message"
          }
        : {
            lastName: "Επώνυμο",
            firstName: "Όνομα",
            email: "Email",
            phone: "Τηλέφωνο",
            country: "Χώρα",
            subject: "Θέμα",
            message: "Μήνυμα"
          };

      var body =
        labels.lastName + ": " + name + "\n" +
        labels.firstName + ": " + firstName + "\n" +
        labels.email + ": " + email + "\n" +
        labels.phone + ": " + (phone || "-") + "\n" +
        labels.country + ": " + country + "\n" +
        labels.subject + ": " + subject + "\n\n" +
        labels.message + ":\n" + message;

      var mailto =
        "mailto:mgerostathi@gmail.com" +
        "?subject=" + encodeURIComponent("[Nostalgia Contact] " + subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = mailto;
      if (statusEl) {
        statusEl.textContent = getLocalizedStatus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContactEmailForm);
  } else {
    initContactEmailForm();
  }
})();
