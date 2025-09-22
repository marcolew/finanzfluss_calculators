import Dinero from "dinero.js";

//#region src/utils/formatters.d.ts
declare function pad(value: number): string;
declare function formatResultWithTwoOptionalDecimals(value: number | {
  toUnit: () => number;
}, suffix?: string): string;
declare function formatResult(value: number | {
  toUnit: () => number;
}, suffix?: string): string;
declare function formatInput(value: string): number;
declare function formatNumber(value: number, decimalCount?: number): string;
declare function formatPercent(percentAsFloat: number, decimalCount?: number): string;
//#endregion
//#region src/utils/i18n.d.ts
declare const locales: readonly ["de", "fr"];
declare const fallbackLocale: Locale;
type Locale = (typeof locales)[number];
declare function setLocale(locale: Locale): void;
declare function getLocale(): Locale;
declare function setMaybeLocale(maybeLocale?: string): void;
declare function isValidLocale(maybeLocale?: string): maybeLocale is Locale;
//#endregion
//#region src/utils/validation.d.ts
declare function toMonthly(valuePerYear: number): number;
declare function toPercentRate(value: number): number;
declare function toMonthlyConformalRate(valuePerYear: number): number;
declare function toDinero(euros: number): Dinero.Dinero;
//#endregion
export { Locale, fallbackLocale, formatInput, formatNumber, formatPercent, formatResult, formatResultWithTwoOptionalDecimals, getLocale, isValidLocale, locales, pad, setLocale, setMaybeLocale, toDinero, toMonthly, toMonthlyConformalRate, toPercentRate };