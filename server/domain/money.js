"use strict";

class MoneyError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = "MoneyError";
    this.code = code;
    this.field = field || null;
  }
}

function decimalToScaled(value, scale, field = "value") {
  if (value === null || value === undefined || value === "") {
    throw new MoneyError("MONEY_VALUE_REQUIRED", `${field} is required`, field);
  }

  const text = String(value).trim();
  const match = /^\+?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new MoneyError("INVALID_DECIMAL", `${field} must be a non-negative decimal`, field);
  }

  const fraction = match[2] || "";
  const retained = fraction.slice(0, scale).padEnd(scale, "0");
  const discarded = fraction.slice(scale);
  if (discarded && /[1-9]/.test(discarded)) {
    throw new MoneyError(
      "DECIMAL_PRECISION_EXCEEDED",
      `${field} supports at most ${scale} decimal places`,
      field
    );
  }

  const factor = 10n ** BigInt(scale);
  return (BigInt(match[1]) * factor) + BigInt(retained || "0");
}

function moneyToMinor(value, field) {
  return decimalToScaled(value, 2, field);
}

function vatRateToUnits(value, field = "vatRate") {
  const units = decimalToScaled(value, 4, field);
  if (units > 1000000n) {
    throw new MoneyError("INVALID_VAT_RATE", `${field} cannot exceed 100%`, field);
  }
  return units;
}

function percentageToUnits(value, field = "percentage") {
  const units = decimalToScaled(value, 4, field);
  if (units <= 0n || units > 1000000n) {
    throw new MoneyError(
      "INVALID_PERCENTAGE",
      `${field} must be greater than 0% and at most 100%`,
      field
    );
  }
  return units;
}

function assertMinor(value, field = "amount") {
  if (typeof value !== "bigint" || value < 0n) {
    throw new MoneyError("INVALID_MINOR_AMOUNT", `${field} must be non-negative bigint cents`, field);
  }
}

function roundDivideHalfUp(numerator, denominator) {
  if (typeof numerator !== "bigint" || numerator < 0n) {
    throw new MoneyError("INVALID_ROUNDING_INPUT", "numerator must be a non-negative bigint");
  }
  if (typeof denominator !== "bigint" || denominator <= 0n) {
    throw new MoneyError("INVALID_ROUNDING_INPUT", "denominator must be a positive bigint");
  }
  return (numerator + (denominator / 2n)) / denominator;
}

function applyPercentage(amountMinor, percentageUnits) {
  assertMinor(amountMinor);
  return roundDivideHalfUp(amountMinor * percentageUnits, 1000000n);
}

function calculateExclusiveTax(netMinor, vatRateUnits) {
  assertMinor(netMinor, "netAmount");
  return roundDivideHalfUp(netMinor * vatRateUnits, 1000000n);
}

function extractIncludedTax(grossMinor, vatRateUnits) {
  assertMinor(grossMinor, "grossAmount");
  if (vatRateUnits === 0n) return 0n;
  const netMinor = roundDivideHalfUp(grossMinor * 1000000n, 1000000n + vatRateUnits);
  return grossMinor - netMinor;
}

function grossFromCatalogAmount(amountMinor, vatRateUnits, pricesIncludeTax) {
  assertMinor(amountMinor);
  if (pricesIncludeTax) return amountMinor;
  return amountMinor + calculateExclusiveTax(amountMinor, vatRateUnits);
}

function allocateProportionally(totalMinor, weights) {
  assertMinor(totalMinor, "allocationTotal");
  if (!Array.isArray(weights) || !weights.length) {
    if (totalMinor === 0n) return [];
    throw new MoneyError("ALLOCATION_WEIGHTS_REQUIRED", "Allocation requires at least one weight");
  }
  weights.forEach((weight, index) => assertMinor(weight, `weights[${index}]`));

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightTotal === 0n) {
    if (totalMinor === 0n) return weights.map(() => 0n);
    throw new MoneyError("ZERO_ALLOCATION_WEIGHT", "Cannot allocate a positive amount over zero weights");
  }
  if (totalMinor > weightTotal) {
    throw new MoneyError("ALLOCATION_EXCEEDS_WEIGHTS", "Allocation cannot exceed its weighted amounts");
  }

  const rows = weights.map((weight, index) => {
    const numerator = totalMinor * weight;
    return {
      index,
      amount: numerator / weightTotal,
      remainder: numerator % weightTotal,
    };
  });
  let allocated = rows.reduce((sum, row) => sum + row.amount, 0n);
  rows.sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let index = 0; allocated < totalMinor; index += 1) {
    rows[index].amount += 1n;
    allocated += 1n;
  }
  rows.sort((left, right) => left.index - right.index);
  return rows.map((row) => row.amount);
}

function minorToMoney(value) {
  assertMinor(value);
  const whole = value / 100n;
  const cents = String(value % 100n).padStart(2, "0");
  return `${whole}.${cents}`;
}

module.exports = {
  MoneyError,
  allocateProportionally,
  applyPercentage,
  calculateExclusiveTax,
  decimalToScaled,
  extractIncludedTax,
  grossFromCatalogAmount,
  minorToMoney,
  moneyToMinor,
  percentageToUnits,
  roundDivideHalfUp,
  vatRateToUnits,
};

