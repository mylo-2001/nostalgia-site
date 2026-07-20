/* Backward-compatible entry point for pages cached before tracking.js replaced it. */
(function () {
  if (window.NostalgiaTracking) return;
  if (document.querySelector('script[src*="js/tracking.js"]')) return;

  var script = document.createElement("script");
  script.src = "/js/tracking.js?v=1";
  script.defer = true;
  document.head.appendChild(script);
})();
