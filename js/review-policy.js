(function () {
  function getLang() {
    return window.NostalgiaI18n && window.NostalgiaI18n.getLang ? window.NostalgiaI18n.getLang() : "el";
  }

  function render() {
    var root = document.getElementById("review-policy-content");
    if (!root || !window.NostalgiaReviewPolicyContent) return;

    var content = window.NostalgiaReviewPolicyContent.getContent(getLang());
    var html = "";

    content.intro.forEach(function (p) {
      html += "<p>" + p + "</p>";
    });

    content.sections.forEach(function (section) {
      html += '<section class="legal-section" id="' + section.id + '">';
      html += "<h2>" + section.title + "</h2>";
      section.paragraphs.forEach(function (p) {
        html += "<p>" + p + "</p>";
      });
      html += "</section>";
    });

    root.innerHTML = html;
  }

  function init() {
    render();
    window.NostalgiaOnLangApplied = (function (prev) {
      return function () {
        render();
        if (typeof prev === "function") prev();
      };
    })(window.NostalgiaOnLangApplied);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
