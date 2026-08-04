(function () {
  var STEPS = ["purpose", "product", "temp", "family", "room", "mood"];
  var SCENT_STEPS = ["temp", "family", "room", "mood"];

  var QUESTION_KEYS = {
    purpose: {
      step: "scent_step_purpose",
      q: "scent_q_purpose",
      hint: "scent_q_purpose_hint",
      a: ["scent_a_self", "scent_a_gift"],
    },
    product: {
      step: "scent_step_product",
      q: "scent_q_product",
      hint: "scent_q_product_hint",
      a: ["scent_a_candle", "scent_a_aroma", "scent_a_open"],
    },
    temp: { step: "scent_step_temp", q: "scent_q_temp", hint: "scent_q_temp_hint", a: ["scent_a_warm", "scent_a_fresh"] },
    family: { step: "scent_step_family", q: "scent_q_family", hint: "scent_q_family_hint", a: ["scent_a_woody", "scent_a_floral"] },
    room: { step: "scent_step_room", q: "scent_q_room", hint: "scent_q_room_hint", a: ["scent_a_living", "scent_a_bedroom", "scent_a_bathroom", "scent_a_office"] },
    mood: { step: "scent_step_mood", q: "scent_q_mood", hint: "scent_q_mood_hint", a: ["scent_a_calm", "scent_a_romantic", "scent_a_memory", "scent_a_celebration"] },
  };

  var ANSWER_VALUES = {
    scent_a_self: "self",
    scent_a_gift: "gift",
    scent_a_candle: "candle",
    scent_a_aroma: "aroma",
    scent_a_open: "open",
    scent_a_warm: "warm",
    scent_a_fresh: "fresh",
    scent_a_woody: "woody",
    scent_a_floral: "floral",
    scent_a_living: "living",
    scent_a_bedroom: "bedroom",
    scent_a_bathroom: "bathroom",
    scent_a_office: "office",
    scent_a_calm: "calm",
    scent_a_romantic: "romantic",
    scent_a_memory: "memory",
    scent_a_celebration: "celebration",
  };

  /* Λέξεις-κλειδιά (EL + EN) ανά απάντηση. Χρησιμοποιούνται για να
     αντιστοιχίσουμε τις επιλογές του πελάτη με την περιγραφή/τίτλο του κάθε
     προϊόντος, ώστε να βγάζουμε το συγκεκριμένο προϊόν που ταιριάζει. */
  var ANSWER_KEYWORDS = {
    warm: ["ζεστ", "ζεσταιν", "warm", "βανιλ", "vanilla", "amber", "κεχριμπ", "μπαχαρ", "spice", "spicy", "καραμελ", "caramel", "μελι", "honey", "καπνιστ", "smok"],
    fresh: ["δροσερ", "δροσι", "fresh", "cool", "εσπεριδ", "citrus", "λεμον", "lemon", "bergamot", "περγαμοντ", "θαλασσ", "marine", "ocean", "μεντα", "mint", "ευκαλυπτ", "eucalyptus", "πρασιν", "green"],
    woody: ["ξυλ", "wood", "κεδρ", "cedar", "σανδαλ", "sandal", "βετιβερ", "vetiver", "πατσουλ", "patchouli", "βαλσαμ", "balsam", "μοσχ", "musk", "δερμα", "leather", "καπν", "tobacco"],
    floral: ["ανθ", "λουλουδ", "floral", "flower", "τριανταφυλλ", "ροδ", "rose", "γιασεμ", "jasmine", "λεβαντ", "lavender", "peony", "παιωνι", "μαγνολι", "magnolia", "πετρ", "petal", "πεονι"],
    living: ["σαλον", "living", "lounge", "καθιστικ", "χωρ", "space", "room"],
    bedroom: ["υπνοδωματ", "κρεββατ", "bedroom", "bed", "νυχτ", "night", "ονειρ", "dream", "sleep", "υπν"],
    bathroom: ["μπανι", "bathroom", "spa", "καθαρ", "clean", "φρεσκ", "ντους", "shower"],
    office: ["γραφει", "office", "desk", "εργασι", "work", "συγκεντρωσ", "focus", "study"],
    calm: ["ηρεμ", "calm", "γαλην", "serene", "relax", "χαλαρ", "soothe", "ζεν", "zen", "peace", "γαλην"],
    romantic: ["ρομαντ", "romant", "romance", "αισθησιακ", "sensual", "παθ", "passion", "αγκαλ", "intimate", "θαλπ"],
    memory: ["νοσταλγ", "nostalg", "μνημ", "memory", "αναμνησ", "remember", "παλι", "vintage", "παιδικ", "childhood", "ταξιδ"],
    celebration: ["γιορτ", "celebrat", "festive", "εορτ", "χαρ", "joy", "λαμπ", "sparkle", "σαμπαν", "champagne", "festiv", "party"],
  };

  function normalizeText(s) {
    if (!s) return "";
    s = String(s).toLowerCase();
    /* αφαίρεση τόνων ώστε "ζεστή" να ταιριάζει με "ζεστ" */
    if (s.normalize) {
      s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
    return s;
  }

  var PROGRESS_LABELS = [
    "scent_progress_purpose",
    "scent_progress_person",
    "scent_progress_scent",
    "scent_progress_style",
    "scent_progress_proposal",
  ];

  function progressPhaseIndex(stepIndex) {
    if (stepIndex >= STEPS.length) return 4;
    if (stepIndex <= 0) return 0;
    if (stepIndex === 1) return 1;
    if (stepIndex <= 3) return 2;
    return 3;
  }

  var OPTION_ICONS = {
    scent_a_self:
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><path d="M16 4.5c0 2.8 1.8 4.2 1.8 6.6a1.8 1.8 0 0 1-3.6 0c0-2.4 1.8-3.8 1.8-6.6z"/><rect x="10.5" y="12.5" width="11" height="15" rx="1.2"/></svg>',
    scent_a_gift:
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><rect x="6" y="13.5" width="20" height="13.5" rx="1.2"/><path d="M16 13.5v13.5M6 17.5h20"/><path d="M11 13.5c-2.1 0-3.2-1.4-3.2-2.8s1.4-2 3-1c1.4 1.3 5.2 3.8 5.2 3.8s3.8-2.5 5.2-3.8c1.6-1 3 0 3 1s-1.1 2.8-3.2 2.8"/></svg>',
    scent_a_candle:
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><path d="M16 5c0 2.5 1.6 3.8 1.6 6a1.6 1.6 0 0 1-3.2 0c0-2.2 1.6-3.5 1.6-6z"/><rect x="11" y="12" width="10" height="15" rx="1"/></svg>',
    scent_a_aroma:
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><path d="M12 10h8l2 4v12H10V14l2-4z"/><path d="M13 10V8a3 3 0 0 1 6 0v2"/></svg>',
    scent_a_open:
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><path d="M16 6l2.2 4.5 5 .7-3.6 3.5.85 5L16 17.8l-4.45 2.4.85-5-3.6-3.5 5-.7L16 6z"/></svg>',
  };

  var CHECK_EMPTY =
    '<svg class="scent-finder__opt-check-icon scent-finder__opt-check-icon--empty" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" stroke="currentColor" stroke-width="1.35"/></svg>';
  var CHECK_DONE =
    '<svg class="scent-finder__opt-check-icon scent-finder__opt-check-icon--done" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="currentColor" stroke="currentColor" stroke-width="1.35"/><path d="M6.5 10.2l2.3 2.3 4.8-4.9" stroke="var(--surface-paper, #fff)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function t(key) {
    if (window.NostalgiaI18n && typeof window.NostalgiaI18n.t === "function") {
      return window.NostalgiaI18n.t(key);
    }
    return key;
  }

  function optionHtml(aKey, stepKey) {
    var descKey = aKey + "_desc";
    var desc = t(descKey);
    var hasDesc = desc !== descKey;
    var icon = OPTION_ICONS[aKey]
      ? '<span class="scent-finder__opt-icon">' + OPTION_ICONS[aKey] + "</span>"
      : '<span class="scent-finder__opt-icon scent-finder__opt-icon--plain" aria-hidden="true"></span>';
    return (
      '<button type="button" class="scent-finder__opt" data-answer="' +
      ANSWER_VALUES[aKey] +
      '" data-step="' +
      stepKey +
      '">' +
      icon +
      '<span class="scent-finder__opt-body">' +
      '<span class="scent-finder__opt-label" data-i18n="' +
      aKey +
      '">' +
      t(aKey) +
      "</span>" +
      (hasDesc
        ? '<span class="scent-finder__opt-desc" data-i18n="' + descKey + '">' + desc + "</span>"
        : "") +
      "</span>" +
      '<span class="scent-finder__opt-check">' +
      CHECK_EMPTY +
      CHECK_DONE +
      "</span>" +
      "</button>"
    );
  }

  function matchesProductKind(kind, answers) {
    var want = answers.product;
    if (!want || want === "open") return true;
    if (want === "candle") return kind === "candle";
    if (want === "aroma") return kind === "aroma";
    return true;
  }

  function scoreScentProfile(scent, answers) {
    if (!scent) return 0;
    var score = 0;
    SCENT_STEPS.forEach(function (key) {
      if (answers[key] && scent[key] === answers[key]) score += 2;
    });
    return score;
  }

  /* Πόσο ταιριάζει το κείμενο (τίτλος + περιγραφή) ενός προϊόντος με τις
     επιλογές του πελάτη. Κάθε επιλογή που εμφανίζεται ως λέξη-κλειδί στην
     περιγραφή μετράει — έτσι ξεχωρίζουμε ΣΥΓΚΕΚΡΙΜΕΝΟ προϊόν μέσα στην ίδια
     κατηγορία, όχι απλώς το πρώτο. */
  function scoreDescription(product, answers) {
    var text = normalizeText((product.title || "") + " " + (product.description || ""));
    if (!text) return 0;
    var score = 0;
    SCENT_STEPS.forEach(function (key) {
      var answer = answers[key];
      if (!answer) return;
      var words = ANSWER_KEYWORDS[answer];
      if (!words) return;
      for (var i = 0; i < words.length; i++) {
        if (text.indexOf(words[i]) !== -1) {
          score += 3; /* βαρύτερο από το προφίλ κατηγορίας: η περιγραφή είναι πιο συγκεκριμένη */
          break;
        }
      }
    });
    return score;
  }

  function scoreProduct(product, answers) {
    if (!matchesProductKind(product.kind || "candle", answers)) return -1;
    return scoreScentProfile(product.scent, answers) + scoreDescription(product, answers);
  }

  function findBestProduct(answers) {
    if (!window.NostalgiaProducts) return null;
    var products = window.NostalgiaProducts.getAll();
    var best = null;
    var bestScore = -1;
    products.forEach(function (p) {
      var meta = window.NostalgiaProducts.getMeta(p.id);
      p.kind = meta ? meta.kind : "candle";
      p.scent = meta ? meta.scent : p.scent;
      var s = scoreProduct(p, answers);
      /* Στρ. ισοπαλίας: σε ίδιο σκορ προτίμησε προϊόν με περιγραφή και
         διαθέσιμο στοκ, ώστε να μη βγαίνει πάντα το ίδιο πρώτο προϊόν. */
      if (s > bestScore || (s === bestScore && best && tieBreak(p, best))) {
        bestScore = s;
        best = p;
      }
    });
    return bestScore >= 0 ? best : null;
  }

  function tieBreak(candidate, current) {
    var cHas = candidate.description ? 1 : 0;
    var curHas = current.description ? 1 : 0;
    if (cHas !== curHas) return cHas > curHas;
    var cStock = candidate.stock == null || candidate.stock > 0 ? 1 : 0;
    var curStock = current.stock == null || current.stock > 0 ? 1 : 0;
    return cStock > curStock;
  }

  function findBestCategory(answers) {
    var NP = window.NostalgiaProducts;
    if (!NP || !NP.CAT_SCENT) return null;
    var bestId = null;
    var bestScore = -1;
    NP.CAT_IDS.forEach(function (catId) {
      var kind = NP.getCategoryKind(catId);
      if (!matchesProductKind(kind, answers)) return;
      var scent = NP.CAT_SCENT[catId];
      var s = scoreScentProfile(scent, answers);
      if (s > bestScore) {
        bestScore = s;
        bestId = catId;
      }
    });
    return bestId;
  }

  function resultTextKey(answers) {
    if (answers.purpose === "gift") return "scent_result_text_gift";
    if (answers.product === "aroma") return "scent_result_text_aroma";
    if (answers.product === "candle") return "scent_result_text_candle";
    return "scent_result_text";
  }

  function buildQuizHTML() {
    return (
      '<div class="scent-finder" id="scent-finder">' +
      '  <nav class="scent-finder__progress" id="scent-finder-progress" aria-label="Quiz progress"></nav>' +
      '  <div id="scent-finder-steps"></div>' +
      '  <div class="scent-finder__result" id="scent-finder-result" hidden></div>' +
      "</div>"
    );
  }

  function renderProgress(stepIndex) {
    var wrap = document.getElementById("scent-finder-progress");
    if (!wrap) return;
    var phase = progressPhaseIndex(stepIndex);
    wrap.innerHTML =
      '<ol class="scent-finder__progress-track">' +
      PROGRESS_LABELS.map(function (labelKey, i) {
        var cls = "scent-finder__progress-step";
        if (i < phase) cls += " is-done";
        if (i === phase) cls += " is-active";
        return (
          '<li class="' +
          cls +
          '">' +
          '<span class="scent-finder__progress-dot" aria-hidden="true"></span>' +
          '<span class="scent-finder__progress-label" data-i18n="' +
          labelKey +
          '">' +
          t(labelKey) +
          "</span>" +
          "</li>"
        );
      }).join("") +
      "</ol>";
  }

  function renderStep(stepIndex, answers) {
    var stepsRoot = document.getElementById("scent-finder-steps");
    var result = document.getElementById("scent-finder-result");
    if (!stepsRoot || !result) return;

    if (stepIndex >= STEPS.length) {
      stepsRoot.innerHTML = "";
      result.hidden = false;
      showResult(answers);
      renderProgress(STEPS.length);
      return;
    }

    result.hidden = true;
    var key = STEPS[stepIndex];
    var q = QUESTION_KEYS[key];
    var stepEl = document.createElement("div");
    stepEl.className = "scent-finder__step";
    stepEl.setAttribute("data-step", key);

    var opts = q.a
      .map(function (aKey) {
        return optionHtml(aKey, key);
      })
      .join("");

    stepEl.innerHTML =
      '<p class="scent-finder__step-label" data-i18n="' +
      q.step +
      '">' +
      t(q.step) +
      "</p>" +
      '<h2 class="scent-finder__q" data-i18n="' +
      q.q +
      '">' +
      t(q.q) +
      "</h2>" +
      '<p class="scent-finder__hint" data-i18n="' +
      q.hint +
      '">' +
      t(q.hint) +
      "</p>" +
      '<div class="scent-finder__options">' +
      opts +
      "</div>";

    stepsRoot.innerHTML = "";
    stepsRoot.appendChild(stepEl);
    renderProgress(stepIndex);

    stepEl.querySelectorAll(".scent-finder__opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        stepEl.querySelectorAll(".scent-finder__opt").forEach(function (other) {
          other.classList.remove("is-selected");
          other.disabled = true;
        });
        btn.classList.add("is-selected");
        btn.disabled = false;
        var step = btn.getAttribute("data-step");
        var answer = btn.getAttribute("data-answer");
        window.setTimeout(function () {
          answers[step] = answer;
          renderStep(stepIndex + 1, answers);
        }, 340);
      });
    });
  }

  function showResult(answers) {
    var result = document.getElementById("scent-finder-result");
    if (!result) return;

    var product = findBestProduct(answers);
    var textKey = resultTextKey(answers);
    var giftExtra =
      answers.purpose === "gift"
        ? '<p class="scent-finder__result-note" data-i18n="scent_result_gift_note">' +
          t("scent_result_gift_note") +
          '</p><a class="scent-finder__result-link" href="/gift-experience" data-i18n="scent_result_gift_link">' +
          t("scent_result_gift_link") +
          "</a>"
        : "";

    if (product) {
      var url = window.NostalgiaProducts.getProductUrl(product.id);
      result.innerHTML =
        '<p class="scent-finder__result-cat" data-i18n="scent_result_label">' +
        t("scent_result_label") +
        "</p>" +
        '<figure class="scent-finder__result-media"><img src="' +
        product.image +
        '" alt="" width="280" height="320" loading="lazy" decoding="async" /></figure>' +
        '<h3 class="scent-finder__result-title">' +
        product.title +
        "</h3>" +
        '<p class="scent-finder__result-text" data-i18n="' +
        textKey +
        '">' +
        t(textKey) +
        "</p>" +
        profileHtml(answers) +
        giftExtra +
        '<div class="scent-finder__actions">' +
        '  <a class="btn-shop btn-shop--primary" href="' +
        url +
        '" data-i18n="scent_result_cta">' +
        t("scent_result_cta") +
        "</a>" +
        '  <button type="button" class="btn-shop btn-shop--ghost" id="scent-finder-retry" data-i18n="scent_result_retry">' +
        t("scent_result_retry") +
        "</button>" +
        "</div>";
    } else {
      var catId = findBestCategory(answers);
      if (!catId) {
        result.innerHTML = "<p>" + t("scent_result_none") + "</p>";
        bindRetry(result);
        return;
      }
      var catUrl = window.NostalgiaProducts.getCategoryUrl(catId);
      var catName = t("collection_" + catId);
      result.innerHTML =
        '<p class="scent-finder__result-cat" data-i18n="scent_result_label">' +
        t("scent_result_label") +
        "</p>" +
        '<h3 class="scent-finder__result-title">' +
        catName +
        "</h3>" +
        '<p class="scent-finder__result-text" data-i18n="scent_result_text_category">' +
        t("scent_result_text_category") +
        "</p>" +
        profileHtml(answers) +
        giftExtra +
        '<div class="scent-finder__actions">' +
        '  <a class="btn-shop btn-shop--primary" href="' +
        catUrl +
        '" data-i18n="scent_result_collection_cta">' +
        t("scent_result_collection_cta") +
        "</a>" +
        '  <button type="button" class="btn-shop btn-shop--ghost" id="scent-finder-retry" data-i18n="scent_result_retry">' +
        t("scent_result_retry") +
        "</button>" +
        "</div>";
    }

    bindRetry(result);
    playResultReveal(result);
  }

  /* Trigger the "ritual" reveal. Re-adding the class after a reflow restarts
     the CSS animation when the visitor retakes the quiz. */
  function playResultReveal(result) {
    result.classList.remove("scent-finder__result--reveal");
    void result.offsetWidth;
    result.classList.add("scent-finder__result--reveal");
  }

  function bindRetry(root) {
    var retry = root.querySelector("#scent-finder-retry");
    if (retry) {
      retry.addEventListener("click", function () {
        renderStep(0, {});
      });
    }
  }

  function profileHtml(answers) {
    var labels = [];
    Object.keys(QUESTION_KEYS).forEach(function (step) {
      var value = answers[step];
      if (!value) return;
      var q = QUESTION_KEYS[step];
      var key = q.a.filter(function (candidate) {
        return ANSWER_VALUES[candidate] === value;
      })[0];
      if (key) labels.push('<span class="scent-finder__profile-chip">' + t(key) + "</span>");
    });
    if (!labels.length) return "";
    return (
      '<div class="scent-finder__profile">' +
      '<p class="scent-finder__profile-label">' +
      (document.documentElement.lang === "en" ? "Your scent profile" : "Το προφίλ σου") +
      "</p>" +
      '<div class="scent-finder__profile-chips">' + labels.join("") + "</div></div>"
    );
  }

  function init() {
    var root = document.getElementById("scent-finder-root");
    if (!root) return;
    root.innerHTML = buildQuizHTML();
    renderStep(0, {});
    if (window.NostalgiaI18n && window.NostalgiaI18n.applyLang) {
      window.NostalgiaI18n.applyLang(window.NostalgiaI18n.getLang(), { restartStory: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
