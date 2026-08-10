(function () {
  var tocObserver = null;

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
      if (section.html) html += section.html;
      html += "</section>";
    });

    root.innerHTML = html;
    enhanceTables(root);
    renderToc(content.sections);
  }

  function enhanceTables(root) {
    root.querySelectorAll(".legal-table").forEach(function (table) {
      var headings = Array.from(table.querySelectorAll("thead th")).map(function (heading) {
        return heading.textContent.trim();
      });

      table.querySelectorAll("tbody tr").forEach(function (row) {
        Array.from(row.cells).forEach(function (cell) {
          if (cell.colSpan === 1 && headings[cell.cellIndex]) {
            cell.setAttribute("data-label", headings[cell.cellIndex]);
          }
        });
      });
    });
  }

  function renderToc(sections) {
    var toc = document.getElementById("privacy-toc");
    var label = document.getElementById("privacy-toc-label");
    if (!toc) return;

    var isEnglish = getLang() === "en";
    if (label) label.textContent = isEnglish ? "On this page" : "Περιεχόμενα";

    toc.innerHTML = sections
      .map(function (section) {
        return (
          '<li class="legal-toc__item"><a class="legal-toc__link" href="#' +
          section.id +
          '">' +
          section.title +
          "</a></li>"
        );
      })
      .join("");

    if (tocObserver) tocObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;

    var links = Array.from(toc.querySelectorAll(".legal-toc__link"));
    tocObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (link) {
            var active = link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: 0 }
    );

    sections.forEach(function (section) {
      var element = document.getElementById(section.id);
      if (element) tocObserver.observe(element);
    });
  }

  function init() {
    render();

    var cookieBtn = document.getElementById("privacy-cookie-settings");
    if (cookieBtn) {
      cookieBtn.addEventListener("click", function () {
        if (window.NostalgiaCookies) window.NostalgiaCookies.openSettings();
      });
    }

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
