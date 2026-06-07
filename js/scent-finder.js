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
    return (
      '<button type="button" class="scent-finder__opt" data-answer="' +
      ANSWER_VALUES[aKey] +
      '" data-step="' +
      stepKey +
      '">' +
      '<span class="scent-finder__opt-label" data-i18n="' +
      aKey +
      '">' +
      t(aKey) +
      "</span>" +
      (hasDesc
        ? '<span class="scent-finder__opt-desc" data-i18n="' + descKey + '">' + desc + "</span>"
        : "") +
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

  function scoreProduct(product, answers) {
    if (!matchesProductKind(product.kind || "candle", answers)) return -1;
    return scoreScentProfile(product.scent, answers);
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
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    });
    return bestScore >= 0 ? best : null;
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
      '  <div class="scent-finder__progress" id="scent-finder-progress"></div>' +
      '  <div id="scent-finder-steps"></div>' +
      '  <div class="scent-finder__result" id="scent-finder-result" hidden></div>' +
      "</div>"
    );
  }

  function renderProgress(stepIndex) {
    var wrap = document.getElementById("scent-finder-progress");
    if (!wrap) return;
    wrap.innerHTML = STEPS.map(function (_, i) {
      var cls = "scent-finder__dot";
      if (i < stepIndex) cls += " is-done";
      if (i === stepIndex) cls += " is-active";
      return '<span class="' + cls + '"></span>';
    }).join("");
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
      " · " +
      (stepIndex + 1) +
      "/" +
      STEPS.length +
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
        answers[btn.getAttribute("data-step")] = btn.getAttribute("data-answer");
        renderStep(stepIndex + 1, answers);
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
          '</p><a class="scent-finder__result-link" href="gift-experience.html" data-i18n="scent_result_gift_link">' +
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
  }

  function bindRetry(root) {
    var retry = root.querySelector("#scent-finder-retry");
    if (retry) {
      retry.addEventListener("click", function () {
        renderStep(0, {});
      });
    }
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
