(function () {
  // Home gallery film: loop only the first N seconds (skip the black tail with
  // the visible cursor at the end), and play/pause as it enters/leaves view.
  var video = document.querySelector(".home-gallery__item--video video");
  if (!video) return;

  var loopEnd = parseFloat(video.getAttribute("data-loop-end")) || 7;

  // Seamless short loop: jump back to the start before the black ending.
  video.addEventListener("timeupdate", function () {
    if (video.currentTime >= loopEnd) {
      video.currentTime = 0;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
  });

  // Save resources: only play while visible.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(video);
  }
})();
