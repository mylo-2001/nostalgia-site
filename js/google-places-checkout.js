/**
 * Google Places address autocomplete on checkout (street field).
 * Requires NostalgiaSiteConfig.googleMapsApiKey in js/site-config.js
 */
(function () {
  var autocomplete = null;
  var streetInput = null;
  var scriptLoading = false;
  var lastGeoCoords = null;
  var geoPrompted = false;

  function getKey() {
    var cfg = window.NostalgiaSiteConfig || {};
    return (cfg.googleMapsApiKey || "").trim();
  }

  function getLang() {
    return document.documentElement.lang === "en" ? "en" : "el";
  }

  function getCountryCode() {
    var select = document.getElementById("checkout-country");
    if (select && select.value) return select.value;
    if (window.NostalgiaLocale && typeof window.NostalgiaLocale.getCountry === "function") {
      return window.NostalgiaLocale.getCountry();
    }
    return "GR";
  }

  function mapsCountryCode(iso) {
    var code = String(iso || "GR").toUpperCase();
    if (code === "XK") return "xk";
    return code.toLowerCase();
  }

  function countryRestrictions(iso) {
    var code = String(iso || getCountryCode()).toUpperCase();
    if (code === "XK") return null;
    return { country: mapsCountryCode(code) };
  }

  function loadMaps(callback) {
    if (window.google && window.google.maps && window.google.maps.places) {
      callback();
      return;
    }
    var key = getKey();
    if (!key) return;

    window._nostalgiaMapsQueue = window._nostalgiaMapsQueue || [];
    window._nostalgiaMapsQueue.push(callback);

    if (scriptLoading) return;
    scriptLoading = true;

    window.nostalgiaMapsReady = function () {
      scriptLoading = false;
      var queue = window._nostalgiaMapsQueue || [];
      window._nostalgiaMapsQueue = [];
      queue.forEach(function (fn) {
        try {
          fn();
        } catch (e) {}
      });
    };

    var script = document.createElement("script");
    script.id = "google-maps-places-js";
    script.async = true;
    script.defer = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&libraries=places&language=" +
      encodeURIComponent(getLang()) +
      "&callback=nostalgiaMapsReady";
    document.head.appendChild(script);
  }

  function componentValue(components, type, useShort) {
    if (!components) return "";
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      if (c.types && c.types.indexOf(type) >= 0) {
        return useShort ? c.short_name || c.long_name : c.long_name || c.short_name;
      }
    }
    return "";
  }

  function matchPrefecture(name) {
    if (!name || !window.NostalgiaPrefectures) return "";
    var list = window.NostalgiaPrefectures.list;
    var raw = String(name).trim();
    if (!raw) return "";

    for (var i = 0; i < list.length; i++) {
      if (list[i] === raw) return list[i];
    }

    var norm = raw
      .replace(/^\s*(νομός|νομου|prefecture|regional unit of)\s*/i, "")
      .trim();
    var normLow = norm.toLowerCase();

    for (var j = 0; j < list.length; j++) {
      var p = list[j];
      var pLow = p.toLowerCase();
      if (pLow === normLow || pLow.indexOf(normLow) >= 0 || normLow.indexOf(pLow.replace(/ς$/, "σ")) >= 0) {
        return p;
      }
    }
    return "";
  }

  function applyPlace(place) {
    if (!place || !place.address_components) return;

    var comps = place.address_components;
    var route = componentValue(comps, "route");
    var streetNumber = componentValue(comps, "street_number");
    var city =
      componentValue(comps, "locality") ||
      componentValue(comps, "postal_town") ||
      componentValue(comps, "administrative_area_level_2");
    var postal = componentValue(comps, "postal_code");
    var countryCode = componentValue(comps, "country", true);

    var streetEl = document.getElementById("checkout-street");
    var numberEl = document.getElementById("checkout-street-number");
    var cityEl = document.getElementById("checkout-city");
    var postalEl = document.getElementById("checkout-postal");
    var countrySelect = document.getElementById("checkout-country");
    var prefectureEl = document.getElementById("checkout-prefecture");

    if (streetEl) streetEl.value = route || streetEl.value;
    if (numberEl) numberEl.value = streetNumber || numberEl.value;
    if (cityEl) cityEl.value = city || cityEl.value;
    if (postalEl) postalEl.value = postal || postalEl.value;

    if (countrySelect && countryCode && window.NostalgiaEuropeCountries) {
      if (window.NostalgiaEuropeCountries.isValid(countryCode)) {
        countrySelect.value = countryCode;
        try {
          localStorage.setItem("nostalgia-country", countryCode);
        } catch (e) {}
        window.dispatchEvent(new CustomEvent("nostalgia-locale-updated"));
        setCountry(countryCode);
      }
    }

    if (countryCode === "GR" && prefectureEl) {
      var pref =
        matchPrefecture(componentValue(comps, "administrative_area_level_2")) ||
        matchPrefecture(componentValue(comps, "administrative_area_level_1")) ||
        matchPrefecture(componentValue(comps, "administrative_area_level_3"));
      if (pref) prefectureEl.value = pref;
    }

    if (window.NostalgiaPlacesCheckout && window.NostalgiaPlacesCheckout._onFilled) {
      window.NostalgiaPlacesCheckout._onFilled();
    }
  }

  function biasAutocompleteToCoords(lat, lng) {
    if (!autocomplete || !window.google || !window.google.maps) return;
    var circle = new window.google.maps.Circle({
      center: { lat: lat, lng: lng },
      radius: 18000,
    });
    autocomplete.setBounds(circle.getBounds());
  }

  function reverseGeocodeAndFill(lat, lng) {
    if (!window.google || !window.google.maps) return;
    var geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat: lat, lng: lng } }, function (results, status) {
      if (status !== "OK" || !results || !results[0] || !results[0].address_components) return;
      applyPlace({ address_components: results[0].address_components });
    });
  }

  function markGeoDenied() {
    try {
      sessionStorage.setItem("nostalgia-geo-denied", "1");
    } catch (e) {}
  }

  function canPromptGeo() {
    try {
      return sessionStorage.getItem("nostalgia-geo-denied") !== "1";
    } catch (e) {
      return true;
    }
  }

  function requestUserLocation() {
    if (!navigator.geolocation || !canPromptGeo()) return;

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        lastGeoCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        if (!getKey()) return;
        loadMaps(function () {
          if (lastGeoCoords) {
            biasAutocompleteToCoords(lastGeoCoords.lat, lastGeoCoords.lng);
            if (streetInput && !streetInput.value.trim()) {
              reverseGeocodeAndFill(lastGeoCoords.lat, lastGeoCoords.lng);
            }
          }
        });
      },
      function (err) {
        if (err && err.code === 1) markGeoDenied();
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000,
      }
    );
  }

  function bindGeolocationOnStreetFocus() {
    if (!streetInput) return;
    streetInput.addEventListener("focus", function () {
      if (geoPrompted) return;
      geoPrompted = true;
      requestUserLocation();
    });
  }

  function bindAutocomplete() {
    if (!streetInput || !window.google || !window.google.maps || !window.google.maps.places) return;

    if (autocomplete) {
      window.google.maps.event.clearInstanceListeners(autocomplete);
      autocomplete = null;
    }

    var opts = {
      types: ["address"],
      fields: ["address_components", "formatted_address", "geometry"],
    };
    var restrict = countryRestrictions();
    if (restrict) opts.componentRestrictions = restrict;

    autocomplete = new window.google.maps.places.Autocomplete(streetInput, opts);

    if (lastGeoCoords) {
      biasAutocompleteToCoords(lastGeoCoords.lat, lastGeoCoords.lng);
    }

    autocomplete.addListener("place_changed", function () {
      var place = autocomplete.getPlace();
      if (!place || !place.address_components) return;
      applyPlace(place);
    });
  }

  function setCountry(code) {
    if (!autocomplete || !window.google) return;
    var restrict = countryRestrictions(code);
    if (restrict) autocomplete.setComponentRestrictions(restrict);
    else autocomplete.setComponentRestrictions({});
  }

  function showHint(show) {
    var el = document.getElementById("checkout-address-hint");
    if (el) el.hidden = !show;
  }

  function init() {
    streetInput = document.getElementById("checkout-street");
    if (!streetInput || !document.getElementById("checkout-shipping-form")) return;

    var key = getKey();
    if (!key) {
      showHint(false);
      return;
    }

    showHint(true);
    streetInput.setAttribute("autocomplete", "off");
    bindGeolocationOnStreetFocus();

    loadMaps(function () {
      bindAutocomplete();
    });
  }

  function initWithoutMaps() {
    streetInput = document.getElementById("checkout-street");
    if (!streetInput || !document.getElementById("checkout-shipping-form")) return;
    if (!navigator.geolocation) return;
    showHint(false);
    streetInput.setAttribute("autocomplete", "off");
    bindGeolocationOnStreetFocus();
  }

  window.NostalgiaPlacesCheckout = {
    init: init,
    setCountry: setCountry,
    _onFilled: null,
    registerOnFilled: function (fn) {
      this._onFilled = typeof fn === "function" ? fn : null;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      if (!getKey()) initWithoutMaps();
    });
  } else {
    init();
    if (!getKey()) initWithoutMaps();
  }
})();
