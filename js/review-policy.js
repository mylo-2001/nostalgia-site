(function () {
  function getLang() {
    return window.NostalgiaI18n && window.NostalgiaI18n.getLang ? window.NostalgiaI18n.getLang() : "el";
  }

  function render() {
    var root = document.getElementById("review-policy-content");
    if (!root || !window.NostalgiaReviewPolicyContent) return;

    var content = window.NostalgiaReviewPolicyContent.getContent(getLang());
    var isEnglish = getLang() === "en";
    var sections = content.sections.concat([{
      id: "official-sources",
      title: isEnglish ? "Official legal sources" : "Επίσημες νομικές πηγές",
      paragraphs: [isEnglish
        ? "These official EU sources cover transparency about review-verification methods and misleading commercial practices."
        : "Οι επίσημες πηγές της ΕΕ καλύπτουν τη διαφάνεια για τον τρόπο επαλήθευσης αξιολογήσεων και τις παραπλανητικές εμπορικές πρακτικές."],
      html: '<ul class="legal-source-list">' +
        '<li><a href="https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32019L2161" target="_blank" rel="noopener noreferrer">Directive (EU) 2019/2161 (Omnibus)</a></li>' +
        '<li><a href="https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng" target="_blank" rel="noopener noreferrer">Directive 2005/29/EC</a></li></ul>'
    }]);
    var html = "";

    content.intro.forEach(function (p) {
      html += "<p>" + p + "</p>";
    });

    sections.forEach(function (section) {
      html += '<section class="legal-section" id="' + section.id + '">';
      html += "<h2>" + section.title + "</h2>";
      section.paragraphs.forEach(function (p) {
        html += "<p>" + p + "</p>";
      });
      if (section.html) html += section.html;
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
