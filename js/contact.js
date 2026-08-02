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
    var captcha = window.NostalgiaCaptcha
      ? window.NostalgiaCaptcha.mount(document.getElementById("contact-captcha"))
      : null;

    var subjectParam = new URLSearchParams(window.location.search).get("subject");
    if (subjectParam && form.subject) {
      var match = form.subject.querySelector('option[value="' + subjectParam + '"]');
      if (match) form.subject.value = subjectParam;
    }

    form.addEventListener("submit", async function (e) {
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
      var file = form.attachment && form.attachment.files ? form.attachment.files[0] : null;
      var attachment = null;
      if (file) {
        var allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
        if (allowed.indexOf(file.type) === -1 || file.size > 750 * 1024) {
          if (statusEl) statusEl.textContent = lang === "en"
            ? "Choose a PNG, JPEG, WEBP or PDF file up to 750 KB."
            : "Επιλέξτε αρχείο PNG, JPEG, WEBP ή PDF έως 750 KB.";
          return;
        }
        attachment = await new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { resolve({ name: file.name, mime: file.type, data: reader.result }); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(file);
        });
        if (!attachment) {
          if (statusEl) statusEl.textContent = lang === "en" ? "The file could not be read." : "Το αρχείο δεν μπόρεσε να διαβαστεί.";
          return;
        }
      }

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

      function sendViaMailto() {
        var mailto =
          "mailto:support@nostalgiacandle.gr" +
          "?subject=" + encodeURIComponent("[Nostalgia Contact] " + subject) +
          "&body=" + encodeURIComponent(body);

        window.location.href = mailto;
        if (statusEl) {
          statusEl.textContent = getLocalizedStatus();
        }
      }

      /* Backend running → store the message there; otherwise email fallback. */
      if (window.NostalgiaAPI && window.NostalgiaAPI.isAvailable()) {
        window.NostalgiaAPI.post("/api/contact", {
          name: name,
          firstName: firstName,
          email: email,
          phone: phone,
          country: country,
          subject: subject,
          message: message,
          lang: lang,
          attachment: attachment,
          captchaToken: window.NostalgiaCaptcha ? window.NostalgiaCaptcha.getToken(captcha) : "",
        }).then(function (res) {
          if (res.ok) {
            form.reset();
            if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(captcha);
            if (statusEl) {
              statusEl.textContent =
                lang === "en"
                  ? "Thank you! Your message has been sent."
                  : "Ευχαριστούμε! Το μήνυμά σας εστάλη.";
            }
          } else if (res.error === "captcha_failed") {
            if (window.NostalgiaCaptcha) window.NostalgiaCaptcha.reset(captcha);
            if (statusEl) {
              statusEl.textContent =
                lang === "en" ? "Please complete the verification." : "Ολοκληρώστε την επαλήθευση.";
            }
          } else {
            sendViaMailto();
          }
        }).catch(sendViaMailto);
        return;
      }

      sendViaMailto();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initContactEmailForm);
  } else {
    initContactEmailForm();
  }
})();
