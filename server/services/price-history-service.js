"use strict";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeObservation(raw) {
  const itemId = String(raw && raw.itemId || "").trim();
  const price = Number(raw && raw.price);
  const regularPrice = Number(raw && raw.regularPrice);
  if (!itemId || !(price > 0) || !(regularPrice > 0)) return null;
  const sourceType = raw.sourceType === "promotion" || raw.sourceType === "manual"
    ? raw.sourceType
    : null;
  return {
    itemId,
    price: Math.round(price * 100) / 100,
    regularPrice: Math.round(regularPrice * 100) / 100,
    sourceType,
    sourceId: sourceType && raw.sourceId != null ? String(raw.sourceId) : null,
    sourceStartedAt: sourceType ? validDate(raw.sourceStartedAt) : null,
    sourceEndsAt: sourceType ? validDate(raw.sourceEndsAt) : null,
  };
}

function transitionTime(latest, observation, now) {
  const current = validDate(now) || new Date();
  const lowerBound = latest && validDate(latest.valid_from);
  const candidates = [];
  if (observation.sourceStartedAt) candidates.push(observation.sourceStartedAt);
  if (!observation.sourceType && latest && latest.source_ends_at) {
    const ended = validDate(latest.source_ends_at);
    if (ended) candidates.push(ended);
  }
  const eligible = candidates.filter((date) => date <= current && (!lowerBound || date >= lowerBound));
  if (!eligible.length) return current;
  return new Date(Math.max.apply(null, eligible.map((date) => date.getTime())));
}

function referenceWindowStart(reductionStartedAt) {
  return new Date(new Date(reductionStartedAt).getTime() - WINDOW_MS);
}

function isPriceReduction(observation) {
  return observation.price < observation.regularPrice;
}

module.exports = {
  WINDOW_MS,
  normalizeObservation,
  transitionTime,
  referenceWindowStart,
  isPriceReduction,
};
