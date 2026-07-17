(function () {
  // Parallax tilt on the collection cards: the card leans toward the cursor in
  // 3D while the photo inside drifts the opposite way, giving a sense of depth.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(hover: none)").matches) return; // skip touch devices

  var MAX_TILT = 7; // degrees
  var MAX_SHIFT = 10; // px of inner-image parallax

  var cards = document.querySelectorAll(".home-collections__cat--editorial");

  Array.prototype.forEach.call(cards, function (card) {
    var img = card.querySelector(".home-collections__cat-media img");
    var ticking = false;
    var lastX = 0;
    var lastY = 0;

    function apply() {
      ticking = false;
      var ry = lastX * MAX_TILT * 2; // horizontal → rotateY
      var rx = -lastY * MAX_TILT * 2; // vertical → rotateX
      card.style.transform =
        "perspective(1000px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" +
        ry.toFixed(2) + "deg) translateY(-6px)";
      if (img) {
        img.style.transform =
          "scale(1.08) translate3d(" + (lastX * -MAX_SHIFT * 2).toFixed(1) +
          "px," + (lastY * -MAX_SHIFT * 2).toFixed(1) + "px,0)";
      }
    }

    card.addEventListener("mouseenter", function () {
      card.classList.add("is-tilting");
    });

    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      lastX = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
      lastY = (e.clientY - r.top) / r.height - 0.5;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    });

    card.addEventListener("mouseleave", function () {
      card.classList.remove("is-tilting");
      card.style.transform = "";
      if (img) img.style.transform = "";
    });
  });
})();
