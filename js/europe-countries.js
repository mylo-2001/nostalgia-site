/** European countries for locale / shipping selector (ISO 3166-1 alpha-2) */
(function () {
  var LIST = [
    { code: "GR", el: "Ελλάδα", en: "Greece" },
    { code: "CY", el: "Κύπρος", en: "Cyprus" },
    { code: "AL", el: "Αλβανία", en: "Albania" },
    { code: "AD", el: "Ανδόρα", en: "Andorra" },
    { code: "AT", el: "Αυστρία", en: "Austria" },
    { code: "BY", el: "Λευκορωσία", en: "Belarus" },
    { code: "BE", el: "Βέλγιο", en: "Belgium" },
    { code: "BA", el: "Βοσνία και Ερζεγοβίνη", en: "Bosnia and Herzegovina" },
    { code: "BG", el: "Βουλγαρία", en: "Bulgaria" },
    { code: "HR", el: "Κροατία", en: "Croatia" },
    { code: "CZ", el: "Τσεχία", en: "Czechia" },
    { code: "DK", el: "Δανία", en: "Denmark" },
    { code: "EE", el: "Εσθονία", en: "Estonia" },
    { code: "FI", el: "Φινλανδία", en: "Finland" },
    { code: "FR", el: "Γαλλία", en: "France" },
    { code: "DE", el: "Γερμανία", en: "Germany" },
    { code: "HU", el: "Ουγγαρία", en: "Hungary" },
    { code: "IS", el: "Ισλανδία", en: "Iceland" },
    { code: "IE", el: "Ιρλανδία", en: "Ireland" },
    { code: "IT", el: "Ιταλία", en: "Italy" },
    { code: "XK", el: "Κόσοβο", en: "Kosovo" },
    { code: "LV", el: "Λεττονία", en: "Latvia" },
    { code: "LI", el: "Λιχτενστάιν", en: "Liechtenstein" },
    { code: "LT", el: "Λιθουανία", en: "Lithuania" },
    { code: "LU", el: "Λουξεμβούργο", en: "Luxembourg" },
    { code: "MT", el: "Μάλτα", en: "Malta" },
    { code: "MD", el: "Μολδαβία", en: "Moldova" },
    { code: "MC", el: "Μονακό", en: "Monaco" },
    { code: "ME", el: "Μαυροβούνιο", en: "Montenegro" },
    { code: "NL", el: "Κάτω Χώρες", en: "Netherlands" },
    { code: "MK", el: "Βόρεια Μακεδονία", en: "North Macedonia" },
    { code: "NO", el: "Νορβηγία", en: "Norway" },
    { code: "PL", el: "Πολωνία", en: "Poland" },
    { code: "PT", el: "Πορτογαλία", en: "Portugal" },
    { code: "RO", el: "Ρουμανία", en: "Romania" },
    { code: "RU", el: "Ρωσία", en: "Russia" },
    { code: "SM", el: "Άγιος Μαρίνος", en: "San Marino" },
    { code: "RS", el: "Σερβία", en: "Serbia" },
    { code: "SK", el: "Σλοβακία", en: "Slovakia" },
    { code: "SI", el: "Σλοβενία", en: "Slovenia" },
    { code: "ES", el: "Ισπανία", en: "Spain" },
    { code: "SE", el: "Σουηδία", en: "Sweden" },
    { code: "CH", el: "Ελβετία", en: "Switzerland" },
    { code: "TR", el: "Τουρκία", en: "Turkey" },
    { code: "UA", el: "Ουκρανία", en: "Ukraine" },
    { code: "GB", el: "Ηνωμένο Βασίλειο", en: "United Kingdom" },
    { code: "VA", el: "Βατικανό", en: "Vatican City" },
  ];

  var BY_CODE = {};
  var CODES = [];
  LIST.forEach(function (entry) {
    BY_CODE[entry.code] = entry;
    CODES.push(entry.code);
  });

  var PRIORITY = { GR: 0, CY: 1 };

  function getName(code, lang) {
    var entry = BY_CODE[code];
    if (!entry) entry = BY_CODE.GR;
    return entry[lang === "en" ? "en" : "el"] || entry.en;
  }

  function sorted(lang) {
    return LIST.slice().sort(function (a, b) {
      var pa = PRIORITY[a.code];
      var pb = PRIORITY[b.code];
      pa = pa != null ? pa : 99;
      pb = pb != null ? pb : 99;
      if (pa !== pb) return pa - pb;
      var la = a[lang === "en" ? "en" : "el"] || a.en;
      var lb = b[lang === "en" ? "en" : "el"] || b.en;
      return la.localeCompare(lb, lang === "en" ? "en" : "el");
    });
  }

  function isValid(code) {
    return !!BY_CODE[code];
  }

  window.NostalgiaEuropeCountries = {
    list: LIST,
    codes: CODES,
    getName: getName,
    sorted: sorted,
    isValid: isValid,
  };
})();
