(function () {
  /* ─────────────────────────────────────────────────────────────────────────
     Differentiated section entrances.

     The whole page used to enter with one gesture: .home-reveal fade-up, on
     all sixteen sections. This gives the page three distinct voices instead,
     chosen per section via data-motion:

       ignite   — declarative statements. Words surface one after another,
                  warm and slow, like a phrase catching light.
       surface  — editorial image + text blocks. The image is un-masked from
                  the bottom edge; the copy follows a beat later.
       cascade  — grids and carousels. Children stagger up, quick and even.

     Opt-in only: a section without data-motion keeps the existing CSS reveal
     (home-reveal.js skips anything inside [data-motion], so the two never
     run on the same element).
     ───────────────────────────────────────────────────────────────────────── */

  var html = document.documentElement;

  function disarm() {
    /* Release the pre-paint hidden state armed in theme-boot.js. Without this
       the content would stay invisible whenever GSAP is unavailable. */
    html.classList.remove("has-motion");
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !window.gsap || !window.ScrollTrigger) {
    disarm();
    return;
  }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  var EASE = "power3.out";

  /* ── ignite ──────────────────────────────────────────────────────────────
     Word-level entrance. The source text is cached per element so a language
     switch can re-split cleanly (i18n-core overwrites textContent wholesale).
  */
  function splitWords(el) {
    var text = el.textContent;
    if (!text || !text.trim()) return null;

    el.textContent = "";
    var parts = text.split(/(\s+)/);
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (/^\s+$/.test(parts[i])) {
        /* keep real whitespace text nodes so words never run together and
           screen readers still read a normal sentence */
        el.appendChild(document.createTextNode(parts[i]));
        continue;
      }
      var mask = document.createElement("span");
      mask.className = "m-word";
      var inner = document.createElement("span");
      inner.className = "m-word__i";
      inner.textContent = parts[i];
      mask.appendChild(inner);
      el.appendChild(mask);
    }
    return el.querySelectorAll(".m-word__i");
  }

  /* Split at trigger time, not at build time.

     i18n-core writes translated copy twice — silently from its own init, then
     again when the async shop bundle lands — and each write replaces
     textContent wholesale, destroying any spans already there. Splitting
     during build() therefore raced the second write and intermittently left a
     statement unsplit (visible, but with no word animation). Splitting inside
     onEnter moves the work to scroll time, long after both writes have
     landed, so there is nothing left to race. The line is held at opacity 0 by
     CSS until then. */
  function ignite(section) {
    var targets = section.querySelectorAll("[data-motion-line]");
    var made = [];

    for (var i = 0; i < targets.length; i++) {
      made.push(igniteOne(targets[i]));
    }
    return made;
  }

  function igniteOne(el) {
    var st = window.ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: function () {
        var words = splitWords(el);
        el.style.opacity = "1"; // release the CSS hold, whether or not we split
        if (!words || !words.length) return;
        gsap.fromTo(
          words,
          { yPercent: 108, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1.05, ease: EASE, stagger: 0.035 }
        );
      }
    });
    /* shaped like a tween so teardown() can treat it uniformly */
    return { scrollTrigger: st, kill: function () { st.kill(); } };
  }

  /* Group elements by their parent so each cluster gets its own trigger.
     A single section-level trigger would fire the whole section at once —
     wrong for tall sections like home-ethos, where the craft grid sits a full
     viewport below the statement and must animate when *it* is reached. */
  function byParent(nodes) {
    var groups = [];
    for (var i = 0; i < nodes.length; i++) {
      var parent = nodes[i].parentElement;
      var group = null;
      for (var j = 0; j < groups.length; j++) {
        if (groups[j].parent === parent) {
          group = groups[j];
          break;
        }
      }
      if (!group) {
        group = { parent: parent, items: [] };
        groups.push(group);
      }
      group.items.push(nodes[i]);
    }
    return groups;
  }

  /* Shared by every pattern: the supporting copy in a section. */
  function fadeCopy(section, delay) {
    var groups = byParent(section.querySelectorAll("[data-motion-copy]"));
    var tweens = [];
    for (var i = 0; i < groups.length; i++) {
      tweens.push(
        gsap.fromTo(
          groups[i].items,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            ease: EASE,
            stagger: 0.08,
            delay: delay || 0,
            scrollTrigger: {
              trigger: groups[i].parent,
              start: "top 84%",
              once: true
            }
          }
        )
      );
    }
    return tweens;
  }

  /* ── surface ─────────────────────────────────────────────────────────────
     The photo is revealed by animating its clip-path up from the bottom edge,
     while the image itself un-scales — the darkroom-print feel. Copy follows.
  */
  function surface(section) {
    var media = section.querySelectorAll("[data-motion-media]");
    if (!media.length) return [];

    var tweens = [];
    for (var i = 0; i < media.length; i++) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: media[i],
          start: "top 82%",
          once: true
        }
      });
      tl.fromTo(
        media[i],
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "power4.out" },
        0
      );
      var img = media[i].querySelector("img, video");
      if (img) {
        tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.6, ease: "power3.out" }, 0);
      }
      tweens.push(tl);
    }
    return tweens;
  }

  /* ── cascade ─────────────────────────────────────────────────────────────
     Grid children, quick and even. Deliberately the plainest of the three —
     grids read as a set, so per-item character would fight the alignment.
  */
  function cascade(section) {
    var groups = byParent(section.querySelectorAll("[data-motion-item]"));
    var tweens = [];
    for (var i = 0; i < groups.length; i++) {
      tweens.push(
        gsap.fromTo(
          groups[i].items,
          { y: 34, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: EASE,
            stagger: { each: 0.07, from: "start" },
            scrollTrigger: {
              trigger: groups[i].parent,
              start: "top 85%",
              once: true
            }
          }
        )
      );
    }
    return tweens;
  }

  var built = [];

  /* data-motion names the section's *headline* treatment. The supporting
     behaviours (copy, grid items, masked media) run wherever their attributes
     appear, so a section like home-ethos can carry a word-rise statement and a
     staggered craft grid at once without needing a fourth pattern name. */
  function apply(section) {
    var name = section.getAttribute("data-motion");
    var made = [];

    if (name === "ignite") made = made.concat(ignite(section));
    if (name === "surface" || section.querySelector("[data-motion-media]")) {
      made = made.concat(surface(section));
    }
    made = made.concat(fadeCopy(section, name === "ignite" ? 0.12 : 0));
    made = made.concat(cascade(section));

    return made;
  }

  function build() {
    var sections = document.querySelectorAll("[data-motion]");
    for (var i = 0; i < sections.length; i++) {
      var made = apply(sections[i]) || [];
      for (var j = 0; j < made.length; j++) built.push(made[j]);
    }
    /* Everything is measured — safe to reveal. */
    disarm();
    window.ScrollTrigger.refresh();
  }

  function teardown() {
    for (var i = 0; i < built.length; i++) {
      if (built[i] && built[i].scrollTrigger) built[i].scrollTrigger.kill();
      if (built[i] && built[i].kill) built[i].kill();
    }
    built = [];
    /* igniteOne clears this inline when it fires; drop it so the CSS hold
       applies again to the rebuilt lines. */
    var lines = document.querySelectorAll("[data-motion-line]");
    for (var j = 0; j < lines.length; j++) lines[j].style.opacity = "";
  }

  var started = false;

  function rebuild() {
    teardown();
    html.classList.add("has-motion");
    /* let the new strings paint before re-measuring trigger positions */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(build);
    });
  }

  /* i18n-core writes translated copy TWICE: once from its DOMContentLoaded
     init (silently) and again when the async shop bundle lands (announcing
     "nostalgia-i18n-updated"). Either write replaces textContent wholesale and
     destroys the word spans. This listener is registered at script-eval time —
     not inside start() — because the bundle can land before fonts.ready, and a
     listener attached later would miss the event and leave ignite unsplit. */
  window.addEventListener("nostalgia-i18n-updated", function () {
    if (!started) return; // build() hasn't run yet; it will read the final copy
    rebuild();
  });

  function start() {
    started = true;
    build();

    /* Late content (product grids) changes page height. */
    document.addEventListener("nostalgia-products-updated", function () {
      window.ScrollTrigger.refresh();
    });
  }

  /* Build only once BOTH are true: the DOM is parsed (so i18n's own
     DOMContentLoaded pass has written its copy) and fonts are ready (they
     change line boxes, and therefore every trigger position). */
  function whenReady(fn) {
    var pending = 2;
    function done() {
      pending -= 1;
      if (pending === 0) fn();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", done);
    } else {
      done();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(done).catch(done);
    } else {
      done();
    }
  }

  whenReady(start);
})();
