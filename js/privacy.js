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
    var isEnglish = getLang() === "en";
    var sourceSection = {
      id: "official-sources",
      title: isEnglish ? "Official legal sources" : "Επίσημες νομικές πηγές",
      paragraphs: [isEnglish
        ? "This policy applies the GDPR and the applicable data-protection framework. The following official sources are provided for direct reference."
        : "Η παρούσα πολιτική εφαρμόζει τον GDPR και το ισχύον πλαίσιο προστασίας δεδομένων. Οι παρακάτω επίσημες πηγές παρέχονται για άμεση αναφορά."],
      html: '<ul class="legal-source-list">' +
        '<li><a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "Regulation (EU) 2016/679 (GDPR) on EUR-Lex" : "Κανονισμός (ΕΕ) 2016/679 (GDPR) στο EUR-Lex") + '</a></li>' +
        '<li><a href="https://www.dpa.gr/el/enimerwtiko/nomothesia/proswpika/nomothesia_prwsopikwn" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "Hellenic DPA: GDPR and Greek Law 4624/2019" : "ΑΠΔΠΧ: GDPR και Ν. 4624/2019") + '</a></li>' +
        '<li><a href="https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "European Commission: information for individuals" : "Ευρωπαϊκή Επιτροπή: ενημέρωση για τα δικαιώματα των πολιτών") + '</a></li>' +
        '<li><a href="https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "EDPB Guidelines 05/2020 on consent" : "EDPB Κατευθυντήριες γραμμές 05/2020 για τη συγκατάθεση") + '</a></li>' +
        '<li><a href="https://www.dpa.gr/el/enimerwtiko/thematikes_enotites/proothisiproiontwn/hlektronika_mesa_proothisi" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "Hellenic DPA: direct marketing by electronic means" : "ΑΠΔΠΧ: προώθηση με ηλεκτρονικά μέσα") + '</a></li>' +
        '<li><a href="https://www.dpa.gr/el/foreis/asfaleia_dedomenwn/gnwstopoiisi_paraviasis/upovoli_gnwstopoihshs_paraviashs" target="_blank" rel="noopener noreferrer">' +
        (isEnglish ? "Hellenic DPA: personal-data breach notification" : "ΑΠΔΠΧ: γνωστοποίηση παραβίασης δεδομένων") + '</a></li></ul>'
    };
    var sections = content.sections.concat([sourceSection]);
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
    enhanceTables(root);
    renderToc(sections);
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
