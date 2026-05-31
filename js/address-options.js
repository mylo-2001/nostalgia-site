(function () {
  var LOCATION_TYPES = [
    { value: "home", i18n: "checkout_location_home" },
    { value: "work", i18n: "checkout_location_work" },
    { value: "other", i18n: "checkout_location_other" },
  ];

  var FLOORS = [{ value: "basement", i18n: "checkout_floor_basement" }, { value: "ground", i18n: "checkout_floor_ground" }];

  for (var i = 1; i <= 15; i++) {
    FLOORS.push({ value: String(i), i18n: "checkout_floor_" + i });
  }
  FLOORS.push({ value: "15plus", i18n: "checkout_floor_15plus" });

  function populateSelect(selectEl, items, placeholder, t) {
    if (!selectEl) return;
    var current = selectEl.value;
    selectEl.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder || "—";
    selectEl.appendChild(empty);
    items.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = typeof t === "function" ? t(item.i18n) : item.i18n;
      selectEl.appendChild(opt);
    });
    if (current) selectEl.value = current;
  }

  function labelFor(items, value, t) {
    var match = items.filter(function (item) {
      return item.value === value;
    })[0];
    return match && typeof t === "function" ? t(match.i18n) : value;
  }

  window.NostalgiaAddressOptions = {
    locationTypes: LOCATION_TYPES,
    floors: FLOORS,
    populateSelect: populateSelect,
    locationLabel: function (value, t) {
      return labelFor(LOCATION_TYPES, value, t);
    },
    floorLabel: function (value, t) {
      return labelFor(FLOORS, value, t);
    },
  };
})();
