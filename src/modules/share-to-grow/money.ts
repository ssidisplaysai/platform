export type CurrencyCode = string;

export interface Money {
  readonly minor: bigint;
  readonly currency: CurrencyCode;
}

export function money(minor: bigint | number, currency = "USD"): Money {
  const value = typeof minor === "number" ? BigInt(minor) : minor;
  return Object.freeze({ minor: value, currency });
}

export function assertSameCurrency(values: readonly Money[]): CurrencyCode {
  if (values.length === 0) throw new Error("MONEY_VALUES_REQUIRED");
  const currency = values[0].currency;
  if (values.some((value) => value.currency !== currency)) {
    throw new Error("CURRENCY_MISMATCH");
  }
  return currency;
}

export function addMoney(values: readonly Money[]): Money {
  const currency = assertSameCurrency(values);
  return money(values.reduce((sum, value) => sum + value.minor, 0n), currency);
}

export function negateMoney(value: Money): Money {
  return money(-value.minor, value.currency);
}
