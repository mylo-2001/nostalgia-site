(function () {
  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function getLang() {
    return window.NostalgiaI18n && window.NostalgiaI18n.getLang ? window.NostalgiaI18n.getLang() : "el";
  }

  function render() {
    var root = document.getElementById("privacy-content");
    if (!root || !window.NostalgiaPrivacyContent) return;

    var content = window.NostalgiaPrivacyContent.getContent(getLang());
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
