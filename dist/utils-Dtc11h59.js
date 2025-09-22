import Dinero from "dinero.js";

//#region src/utils/i18n.ts
const locales = ["de", "fr"];
const fallbackLocale = "de";
let currentLocale = "de";
function setLocale(locale) {
	currentLocale = locale;
}
function getLocale() {
	return currentLocale;
}
function setMaybeLocale(maybeLocale) {
	currentLocale = isValidLocale(maybeLocale) ? maybeLocale : fallbackLocale;
}
function isValidLocale(maybeLocale) {
	return locales.includes(maybeLocale);
}

//#endregion
//#region src/utils/formatters.ts
const SUPERSCRIPTS = [
	"⁰",
	"¹",
	"²",
	"³",
	"⁴",
	"⁵",
	"⁶",
	"⁷",
	"⁸",
	"⁹"
];
function pad(value) {
	return (value < 10 ? "0" : "") + value;
}
function formatResultWithTwoOptionalDecimals(value, suffix = "€") {
	const amount = typeof value === "number" ? value : value.toUnit();
	const decimalsRequired = Math.abs(amount) - Number.parseInt(amount.toString()) > 0;
	const decimalCount = decimalsRequired ? 2 : 0;
	const formattedAmount = formatNumber(amount, decimalCount);
	return `${formattedAmount}${suffix}`;
}
function formatResult(value, suffix = "€") {
	const amount = typeof value === "number" ? value : value.toUnit();
	const decimalCount = Math.abs(amount) < 1e3 ? 2 : 0;
	const formattedAmount = formatNumber(amount, decimalCount);
	return `${formattedAmount}${suffix}`;
}
function formatInput(value) {
	return Number(value.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}
function formatNumber(value, decimalCount = 0) {
	if (!Number.isFinite(value)) throw new TypeError(`${value} is not a valid number`);
	if (value.toString().includes("e+")) return formatExponential(value);
	return new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: decimalCount,
		maximumFractionDigits: decimalCount
	}).format(Number(value.toFixed(decimalCount)));
}
function formatPercent(percentAsFloat, decimalCount = 3) {
	return `${formatNumber(percentAsFloat, decimalCount)}%`;
}
function formatExponential(amount) {
	const amountString = amount.toExponential();
	const parsedMantissa = amountString.slice(0, amountString.indexOf(".") + 2);
	const formattedMantissa = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(Number(parsedMantissa));
	const parsedExponent = amountString.slice(amountString.indexOf("+") + 1);
	const formattedExponent = parsedExponent.split("").map((i) => SUPERSCRIPTS[+i]).join("");
	return `${formattedMantissa}×10${formattedExponent}`;
}

//#endregion
//#region src/utils/validation.ts
function toMonthly(valuePerYear) {
	return valuePerYear / 12;
}
function toPercentRate(value) {
	return value / 100;
}
function toMonthlyConformalRate(valuePerYear) {
	return (1 + valuePerYear / 100) ** (1 / 12) - 1;
}
function toDinero(euros) {
	return Dinero({
		amount: Math.round(euros * 100),
		currency: "EUR"
	});
}

//#endregion
export { fallbackLocale, formatInput, formatNumber, formatPercent, formatResult, formatResultWithTwoOptionalDecimals, getLocale, isValidLocale, locales, pad, setLocale, setMaybeLocale, toDinero, toMonthly, toMonthlyConformalRate, toPercentRate };