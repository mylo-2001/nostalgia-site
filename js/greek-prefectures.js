(function () {
  var PREFECTURES = [
    "Αιτωλοακαρνανίας",
    "Αργολίδας",
    "Αρκαδίας",
    "Άρτας",
    "Αττικής",
    "Αχαΐας",
    "Βοιωτίας",
    "Γρεβενών",
    "Δράμας",
    "Δωδεκανήσου",
    "Έβρου",
    "Ευρυτανίας",
    "Εύβοιας",
    "Ζακύνθου",
    "Ηλείας",
    "Ημαθίας",
    "Ηρακλείου",
    "Θεσπρωτίας",
    "Θεσσαλονίκης",
    "Ιωαννίνων",
    "Καβάλας",
    "Καρδίτσας",
    "Καστοριάς",
    "Κέρκυρας",
    "Κεφαλληνίας",
    "Κιλκίς",
    "Κοζάνης",
    "Κορινθίας",
    "Κυκλάδων",
    "Λακωνίας",
    "Λάρισας",
    "Λασιθίου",
    "Λέσβου",
    "Λευκάδας",
    "Μαγνησίας",
    "Μεσσηνίας",
    "Ξάνθης",
    "Πέλλας",
    "Πιερίας",
    "Πρέβεζας",
    "Ρεθύμνης",
    "Ροδόπης",
    "Σάμου",
    "Σερρών",
    "Τρικάλων",
    "Φθιώτιδας",
    "Φλώρινας",
    "Φωκίδας",
    "Χίου",
    "Χαλκιδικής",
    "Χανίων",
    "Εύβοιας (Σκύρος)",
    "Έβρου (Σαμοθράκη)",
    "Μαγνησίας (Σκόπελος)",
    "Μαγνησίας (Σκιάθος)",
    "Μαγνησίας (Αλόννησος)",
    "Καβάλας (Θάσος)",
  ];

  function populateSelect(selectEl, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder || "—";
    selectEl.appendChild(empty);
    PREFECTURES.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  window.NostalgiaPrefectures = {
    list: PREFECTURES,
    populateSelect: populateSelect,
  };
})();
