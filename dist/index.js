import { formatInput, formatPercent, formatResult, formatResultWithTwoOptionalDecimals, toDinero, toMonthly, toMonthlyConformalRate, toPercentRate } from "./utils-Dtc11h59.js";
import { z } from "zod";
import Dinero from "dinero.js";
import BigNumber from "bignumber.js";

//#region src/utils/calculator.ts
function defineCalculator(config) {
	return {
		...config,
		validateAndCalculate: (rawInput) => {
			const parsed = config.schema.parse(rawInput);
			return config.calculate(parsed);
		}
	};
}

//#endregion
//#region src/calculators/compound-interest.ts
const schema$2 = z.object({
	startCapital: z.coerce.number().transform(toDinero),
	monthlyPayment: z.coerce.number().transform(toDinero),
	durationYears: z.coerce.number().nonnegative().max(1e3),
	yearlyInterest: z.coerce.number().min(-1e4).max(1e4).transform(toPercentRate),
	type: z.enum([
		"monthly",
		"quarterly",
		"yearly"
	])
});
const IntervalFactors = {
	monthly: {
		periodsPerYear: 12,
		paymentsPerPeriod: 1
	},
	quarterly: {
		periodsPerYear: 4,
		paymentsPerPeriod: 3
	},
	yearly: {
		periodsPerYear: 1,
		paymentsPerPeriod: 12
	}
};
const compoundInterest = defineCalculator({
	schema: schema$2,
	calculate: calculate$2
});
function getBaseInvestmentData(parsedInput) {
	const { monthlyPayment, type, durationYears, yearlyInterest } = parsedInput;
	const intervalFactors = IntervalFactors[type];
	return {
		totalPeriods: durationYears * intervalFactors.periodsPerYear,
		periodicPayment: monthlyPayment.multiply(intervalFactors.paymentsPerPeriod),
		periodicInterestRate: yearlyInterest / intervalFactors.periodsPerYear
	};
}
function calculate$2(parsedInput) {
	const { startCapital, monthlyPayment, durationYears } = parsedInput;
	const totalPayments = startCapital.add(monthlyPayment.multiply(durationYears * 12));
	const { totalPeriods, periodicPayment, periodicInterestRate } = getBaseInvestmentData(parsedInput);
	const capitalList = [];
	const interestList = [];
	let currentCapital = startCapital;
	let accumulatedInterest = toDinero(0);
	let totalBalance = currentCapital;
	for (let period = 0; period < totalPeriods; period++) {
		currentCapital = currentCapital.add(periodicPayment);
		capitalList.push(currentCapital);
		const periodicInterest = totalBalance.multiply(periodicInterestRate);
		accumulatedInterest = accumulatedInterest.add(periodicInterest);
		interestList.push(accumulatedInterest);
		totalBalance = currentCapital.add(accumulatedInterest);
	}
	const diagramData = {
		CAPITAL_LIST: capitalList.map((dinero) => dinero.toUnit()),
		INTEREST_LIST: interestList.map((dinero) => dinero.toUnit()),
		LAST_CAPITAL: formatResult(currentCapital),
		LAST_INTEREST: formatResult(accumulatedInterest),
		TOTAL_CAPITAL: formatResult(totalBalance)
	};
	return {
		finalCapital: formatResult(totalBalance),
		totalPayments: formatResult(totalPayments),
		totalInterest: formatResult(totalBalance.subtract(totalPayments)),
		diagramData
	};
}

//#endregion
//#region src/constants/gross-to-net.ts
/**
* Index is based on the amount of children
* @example
* CARE_INSURANCE_CONTRIBUTION_RATES[0] // Rates for zero children
*/
const CARE_INSURANCE_CONTRIBUTION_RATES = [
	{
		AN: 1.8,
		AG: 1.8
	},
	{
		AN: 1.8,
		AG: 1.8
	},
	{
		AN: 1.55,
		AG: 1.8
	},
	{
		AN: 1.3,
		AG: 1.8
	},
	{
		AN: 1.05,
		AG: 1.8
	},
	{
		AN: .8,
		AG: 1.8
	}
];
/**
* Index is based on the amount of children
* @example
* CARE_INSURANCE_CONTRIBUTION_RATES_SAXONY[0] // Rates for zero children
*/
const CARE_INSURANCE_CONTRIBUTION_RATES_SAXONY = [
	{
		AN: 2.3,
		AG: 1.3
	},
	{
		AN: 2.3,
		AG: 1.3
	},
	{
		AN: 2.05,
		AG: 1.3
	},
	{
		AN: 1.8,
		AG: 1.3
	},
	{
		AN: 1.55,
		AG: 1.3
	},
	{
		AN: 1.3,
		AG: 1.3
	}
];

//#endregion
//#region src/constants/pension.ts
const PENSION_VALUES = {
	PENSION_VALUE_EAST: 39.82,
	PENSION_VALUE_WEST: 39.82,
	PENSION_LIMIT_EAST: 96600,
	PENSION_LIMIT_WEST: 96600,
	PENSION_AVERAGE_SALARY: 50493,
	PENSION_REFERENCE_SALARY_MONTH_WEST: 4207.75,
	PENSION_REFERENCE_SALARY_MONTH_EAST: 4207.75
};

//#endregion
//#region src/utils/Lohnsteuer/shims/BigDecimal.ts
var BigDecimal = class BigDecimal extends BigNumber {
	constructor(value) {
		super(value);
	}
	add(value) {
		return new BigDecimal(this.plus(value));
	}
	subtract(value) {
		return new BigDecimal(this.minus(value));
	}
	multiply(value) {
		return new BigDecimal(this.multipliedBy(value));
	}
	divide(value, scale, roundingMode) {
		let bigNumber = this.dividedBy(value);
		if (scale !== void 0) bigNumber = bigNumber.decimalPlaces(scale, roundingMode);
		return new BigDecimal(bigNumber);
	}
	compareTo(value) {
		return new BigDecimal(this.comparedTo(value));
	}
	setScale(scale, roundingMode) {
		return new BigDecimal(this.decimalPlaces(scale, roundingMode));
	}
	static ONE() {
		return new BigDecimal(1);
	}
	static ZERO() {
		return new BigDecimal(0);
	}
	static valueOf(value) {
		return new BigDecimal(value);
	}
};

//#endregion
//#region src/utils/Lohnsteuer/2019.ts
function Lohnsteuer2019(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag nach Maßgabe der Eintragungen auf der
	* Lohnsteuerkarte in Cents (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag in Cents (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge und ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingabe „sonsti-ger Bezüge“ (Feld SONSTB)
	* oder bei Eingabe der „Vergütung für mehrjährige Tätigkeit“ (Feld VMT).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden, so sind sie dem
	* voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Vergütungen für mehrere Jahres aus einem vorangegangenen
	* Abrechnungszeitraum sind in voller Höhe hinzuzurechnen.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Einkommensbezogener Zusatzbeitragssatz eines gesetzlich krankenversicherten Arbeitnehmers,
	* auf dessen Basis der an die Krankenkasse zu zahlende Zusatzbeitrag berechnet wird,
	* in Prozent (bspw. 0,90 für 0,90 %) mit 2 Dezimalstellen.
	* Der von der Kranken-kasse festgesetzte Zusatzbeitragssatz ist bei Abweichungen unmaßgeblich.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Freibetrag für
	* den Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Hinzurechnungsbetrag
	* für den Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. Lohnsteuerkarte (bei
	* keiner Religionszugehoerigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn vor Beruecksichtigung der Freibetraege
	* fuer Versorgungsbezuege, des Altersentlastungsbetrags und des auf
	* der Lohnsteuerkarte fuer den Lohnzahlungszeitraum eingetragenen
	* Freibetrags in Cents.
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezuege (ohne Verguetung aus mehrjaehriger Taetigkeit) einschliesslich
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt in Cents (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Vergütung für mehrjährige Tätigkeit ohne Kapitalauszahlungen und ohne Abfindungen
	* bei Versorgungsbezügen in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Einkuenfte (ohne Verguetung
	* fuer mehrjaehrige Taetigkeit) fuer die Kirchenlohnsteuer in Cents
	*/
	this.BKS = new BigDecimal(0);
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer sonstige Bezuege (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer die Verguetung fuer mehrjaehrige Taetigkeit in
	* Cents
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer fuer sonstige Einkuenfte (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer fuer Verguetung fuer mehrjaehrige Taetigkeit in Cents
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* Nach Programmablaufplan 2019
	*/
	this.bd = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag fuer Alleinerziehende in EURO
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2019, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2019, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2019, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2019, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2019, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2019, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2019, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2019, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2019, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2019, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2019, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2019, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2019, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2019, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2019, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2019, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2019.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2019.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2019.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2019.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2019.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2019.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2019.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2019.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2019.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2019.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2019.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2019.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2019.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2019.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2019.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2019.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2019.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2019.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2019.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2019.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2019.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2019.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2019.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2019.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2019.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2019.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2019.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2019.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2019.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2019.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2019.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2019.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2019.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2019.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2019.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2019.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2019.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2019.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2019.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2019.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2019.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2019.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2019.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2019.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2019.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2019.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2019.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2019.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2019.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2019.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2019.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 13
*/
Lohnsteuer2019.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 14
*/
Lohnsteuer2019.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(80400);
		else this.BBGRV = new BigDecimal(73800);
		this.RVSATZAN = BigDecimal.valueOf(.093);
		this.TBSVORV = BigDecimal.valueOf(.76);
	}
	this.BBGKVPV = new BigDecimal(54450);
	this.bd = new BigDecimal(2);
	this.KVSATZAN = this.KVZ.divide(this.bd).divide(Lohnsteuer2019.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.07450000000000001);
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.02025);
		this.PVSATZAG = BigDecimal.valueOf(.01025);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.01525);
		this.PVSATZAG = BigDecimal.valueOf(.01525);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.0025));
	this.W1STKL5 = new BigDecimal(10635);
	this.W2STKL5 = new BigDecimal(27980);
	this.W3STKL5 = new BigDecimal(212261);
	this.GFB = new BigDecimal(9168);
	this.SOLZFREI = new BigDecimal(972);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 15
*/
Lohnsteuer2019.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2019.ZAHL12).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2019.ZAHL12).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2019.ZAHL12).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2019.ZAHL12).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2019.ZAHL360).divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 16
*/
Lohnsteuer2019.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2019.TAB2[this.J].divide(Lohnsteuer2019.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2019.TAB3[this.J].divide(Lohnsteuer2019.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2019.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2019.TAB2[this.J];
			this.FVBZ = Lohnsteuer2019.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2019.TAB1[this.J]).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2019.TAB1[this.J]).divide(Lohnsteuer2019.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2019.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2019.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2019.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2019.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2019.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2019.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2019.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2019.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2019.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2019.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 19
*/
Lohnsteuer2019.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2019.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 20
*/
Lohnsteuer2019.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2019.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2019.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 21
*/
Lohnsteuer2019.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(Lohnsteuer2019.ZAHL1000) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(Lohnsteuer2019.ZAHL1000);
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7620)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(1908);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7620)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7620)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(3810)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 22
*/
Lohnsteuer2019.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2019.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2019.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2019.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2019.ZAHL100)).divide(Lohnsteuer2019.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2019.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2019.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2019.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 23
*/
Lohnsteuer2019.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 23
*/
Lohnsteuer2019.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2019.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2019.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 24
*/
Lohnsteuer2019.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2019.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 25
*/
Lohnsteuer2019.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2019.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB19();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG)
* Achtung: Es wird davon ausgegangen, dass
* a) Es wird davon ausge-gangen, dassa) für die BBG (Ost) 60.000 Euro und für die BBG (West) 71.400 Euro festgelegt wird sowie
* b) der Beitragssatz zur Rentenversicherung auf 18,9 % gesenkt wird.
*
* PAP Seite 26
*/
Lohnsteuer2019.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.TBSVORV.multiply(this.ZRE4VP).setScale(2, BigDecimal.ROUND_DOWN);
		this.VSP1 = this.VSP1.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 27
*/
Lohnsteuer2019.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2019.ZAHL12).divide(Lohnsteuer2019.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 28
*/
Lohnsteuer2019.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2019.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB19();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB19();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2019.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 30
*/
Lohnsteuer2019.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(20)).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2019.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2019.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 31
*/
Lohnsteuer2019.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2019.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2019.ZAHL7).divide(Lohnsteuer2019.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2019.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 32
*/
Lohnsteuer2019.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2019.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2019.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2019.ZAHL100);
		if (this.STS.compareTo(BigDecimal.ZERO()) == -1) this.STS = BigDecimal.ZERO();
		this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2019.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		if (this.R > 0) this.BKS = this.STS;
		else this.BKS = BigDecimal.ZERO();
	}
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 33
*/
Lohnsteuer2019.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2019.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2019.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2019.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2019.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2019.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2019.ZAHL100);
		this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2019.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 34
*/
Lohnsteuer2019.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2019.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2019.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2019.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2019.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 35
*/
Lohnsteuer2019.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2019.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2019.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2019.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 36
*/
Lohnsteuer2019.prototype.UPTAB19 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2019.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(14255)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2019.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(980.14));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(55961)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(14254)).divide(Lohnsteuer2019.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(216.16));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(965.58)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(265327)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(8780.9)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(16740.68)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2020.ts
function Lohnsteuer2020(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag nach Maßgabe der Eintragungen auf der
	* Lohnsteuerkarte in Cents (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag in Cents (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge und ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingabe „sonsti-ger Bezüge“ (Feld SONSTB)
	* oder bei Eingabe der „Vergütung für mehrjährige Tätigkeit“ (Feld VMT).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden, so sind sie dem
	* voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Vergütungen für mehrere Jahres aus einem vorangegangenen
	* Abrechnungszeitraum sind in voller Höhe hinzuzurechnen.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Einkommensbezogener Zusatzbeitragssatz eines gesetzlich krankenversicherten Arbeitnehmers,
	* auf dessen Basis der an die Krankenkasse zu zahlende Zusatzbeitrag berechnet wird,
	* in Prozent (bspw. 0,90 für 0,90 %) mit 2 Dezimalstellen.
	* Der von der Kranken-kasse festgesetzte Zusatzbeitragssatz ist bei Abweichungen unmaßgeblich.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Freibetrag für
	* den Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Hinzurechnungsbetrag
	* für den Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. Lohnsteuerkarte (bei
	* keiner Religionszugehoerigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn vor Beruecksichtigung der Freibetraege
	* fuer Versorgungsbezuege, des Altersentlastungsbetrags und des auf
	* der Lohnsteuerkarte fuer den Lohnzahlungszeitraum eingetragenen
	* Freibetrags in Cents.
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezuege (ohne Verguetung aus mehrjaehriger Taetigkeit) einschliesslich
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt in Cents (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Vergütung für mehrjährige Tätigkeit ohne Kapitalauszahlungen und ohne Abfindungen
	* bei Versorgungsbezügen in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Einkuenfte (ohne Verguetung
	* fuer mehrjaehrige Taetigkeit) fuer die Kirchenlohnsteuer in Cents
	*/
	this.BKS = new BigDecimal(0);
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer sonstige Bezuege (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer die Verguetung fuer mehrjaehrige Taetigkeit in
	* Cents
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer fuer sonstige Einkuenfte (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer fuer Verguetung fuer mehrjaehrige Taetigkeit in Cents
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* Nach Programmablaufplan 2019
	*/
	this.bd = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag fuer Alleinerziehende in EURO
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2020, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2020, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2020, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2020, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2020, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2020, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2020, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2020, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2020, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2020, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2020, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2020, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2020, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2020, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2020, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2020, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2020.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2020.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2020.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2020.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2020.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2020.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2020.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2020.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2020.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2020.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2020.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2020.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2020.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2020.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2020.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2020.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2020.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2020.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2020.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2020.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2020.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2020.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2020.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2020.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2020.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2020.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2020.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2020.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2020.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2020.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2020.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2020.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2020.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2020.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2020.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2020.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2020.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2020.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2020.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2020.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2020.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2020.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2020.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2020.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2020.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2020.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2020.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2020.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2020.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2020.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2020.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 13
*/
Lohnsteuer2020.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 14
*/
Lohnsteuer2020.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(82800);
		else this.BBGRV = new BigDecimal(77400);
		this.RVSATZAN = BigDecimal.valueOf(.093);
		this.TBSVORV = BigDecimal.valueOf(.8);
	}
	this.BBGKVPV = new BigDecimal(56250);
	this.bd = new BigDecimal(2);
	this.KVSATZAN = this.KVZ.divide(this.bd).divide(Lohnsteuer2020.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.07550000000000001);
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.02025);
		this.PVSATZAG = BigDecimal.valueOf(.01025);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.01525);
		this.PVSATZAG = BigDecimal.valueOf(.01525);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.0025));
	this.W1STKL5 = new BigDecimal(10898);
	this.W2STKL5 = new BigDecimal(28526);
	this.W3STKL5 = new BigDecimal(216400);
	this.GFB = new BigDecimal(9408);
	this.SOLZFREI = new BigDecimal(972);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 15
*/
Lohnsteuer2020.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2020.ZAHL12).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2020.ZAHL12).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2020.ZAHL12).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2020.ZAHL12).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2020.ZAHL360).divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 16
*/
Lohnsteuer2020.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2020.TAB2[this.J].divide(Lohnsteuer2020.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2020.TAB3[this.J].divide(Lohnsteuer2020.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2020.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2020.TAB2[this.J];
			this.FVBZ = Lohnsteuer2020.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2020.TAB1[this.J]).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2020.TAB1[this.J]).divide(Lohnsteuer2020.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2020.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2020.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2020.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2020.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2020.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2020.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2020.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2020.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2020.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2020.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 19
*/
Lohnsteuer2020.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2020.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 20
*/
Lohnsteuer2020.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2020.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2020.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 21
*/
Lohnsteuer2020.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(Lohnsteuer2020.ZAHL1000) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(Lohnsteuer2020.ZAHL1000);
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7812)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(1908);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7812)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(7812)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(3906)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 22
*/
Lohnsteuer2020.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2020.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2020.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2020.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2020.ZAHL100)).divide(Lohnsteuer2020.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2020.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2020.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2020.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 23
*/
Lohnsteuer2020.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 23
*/
Lohnsteuer2020.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2020.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2020.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 24
*/
Lohnsteuer2020.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2020.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 25
*/
Lohnsteuer2020.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2020.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB20();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG)
* Achtung: Es wird davon ausgegangen, dass
* a) Es wird davon ausge-gangen, dassa) für die BBG (Ost) 60.000 Euro und für die BBG (West) 71.400 Euro festgelegt wird sowie
* b) der Beitragssatz zur Rentenversicherung auf 18,9 % gesenkt wird.
*
* PAP Seite 26
*/
Lohnsteuer2020.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.TBSVORV.multiply(this.ZRE4VP).setScale(2, BigDecimal.ROUND_DOWN);
		this.VSP1 = this.VSP1.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 27
*/
Lohnsteuer2020.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2020.ZAHL12).divide(Lohnsteuer2020.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 28
*/
Lohnsteuer2020.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2020.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB20();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB20();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2020.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 30
*/
Lohnsteuer2020.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(20)).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2020.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2020.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 31
*/
Lohnsteuer2020.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2020.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2020.ZAHL7).divide(Lohnsteuer2020.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2020.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 32
*/
Lohnsteuer2020.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2020.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2020.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2020.ZAHL100);
		if (this.STS.compareTo(BigDecimal.ZERO()) == -1) this.STS = BigDecimal.ZERO();
		this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2020.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		if (this.R > 0) this.BKS = this.STS;
		else this.BKS = BigDecimal.ZERO();
	}
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 33
*/
Lohnsteuer2020.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2020.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2020.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2020.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2020.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2020.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2020.ZAHL100);
		this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2020.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 34
*/
Lohnsteuer2020.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2020.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2020.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2020.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2020.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 35
*/
Lohnsteuer2020.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2020.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2020.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2020.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 36
*/
Lohnsteuer2020.prototype.UPTAB20 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2020.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(14533)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2020.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(972.87));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(57052)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(14532)).divide(Lohnsteuer2020.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(212.02));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(972.79)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(270501)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(8963.74)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(17078.74)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2021.ts
function Lohnsteuer2021(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag nach Maßgabe der Eintragungen auf der
	* Lohnsteuerkarte in Cents (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag in Cents (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge und ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingabe „sonsti-ger Bezüge“ (Feld SONSTB)
	* oder bei Eingabe der „Vergütung für mehrjährige Tätigkeit“ (Feld VMT).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden, so sind sie dem
	* voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Vergütungen für mehrere Jahres aus einem vorangegangenen
	* Abrechnungszeitraum sind in voller Höhe hinzuzurechnen.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Einkommensbezogener Zusatzbeitragssatz eines gesetzlich krankenversicherten Arbeitnehmers,
	* auf dessen Basis der an die Krankenkasse zu zahlende Zusatzbeitrag berechnet wird,
	* in Prozent (bspw. 0,90 für 0,90 %) mit 2 Dezimalstellen.
	* Der von der Kranken-kasse festgesetzte Zusatzbeitragssatz ist bei Abweichungen unmaßgeblich.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Freibetrag für
	* den Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* In der Lohnsteuerkarte des Arbeitnehmers eingetragener Hinzurechnungsbetrag
	* für den Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. Lohnsteuerkarte (bei
	* keiner Religionszugehoerigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn vor Beruecksichtigung der Freibetraege
	* fuer Versorgungsbezuege, des Altersentlastungsbetrags und des auf
	* der Lohnsteuerkarte fuer den Lohnzahlungszeitraum eingetragenen
	* Freibetrags in Cents.
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezuege (ohne Verguetung aus mehrjaehriger Taetigkeit) einschliesslich
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt in Cents (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Vergütung für mehrjährige Tätigkeit ohne Kapitalauszahlungen und ohne Abfindungen
	* bei Versorgungsbezügen in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Einkuenfte (ohne Verguetung
	* fuer mehrjaehrige Taetigkeit) fuer die Kirchenlohnsteuer in Cents
	*/
	this.BKS = new BigDecimal(0);
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer sonstige Bezuege (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag fuer die Verguetung fuer mehrjaehrige Taetigkeit in
	* Cents
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer fuer sonstige Einkuenfte (ohne Verguetung fuer mehrjaehrige
	* Taetigkeit) in Cents
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer fuer Verguetung fuer mehrjaehrige Taetigkeit in Cents
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* Nach Programmablaufplan 2019
	*/
	this.bd = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag fuer Alleinerziehende in EURO
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro
	*/
	this.SOLZSBMG = new BigDecimal(0);
	/**
	* Neu ab 2021: Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro, Cent (2 Dezimalstellen)
	*/
	this.SOLZSZVE = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
	*/
	this.SOLZVBMG = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2021, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2021, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2021, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2021, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2021, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2021, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2021, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2021, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2021, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2021, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2021, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2021, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2021, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2021, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2021, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2021, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2021.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2021.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2021.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2021.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2021.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2021.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2021.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2021.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2021.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2021.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2021.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2021.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2021.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2021.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2021.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2021.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2021.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2021.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2021.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2021.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2021.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2021.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2021.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2021.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2021.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2021.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2021.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2021.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2021.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2021.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2021.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2021.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2021.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2021.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2021.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2021.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2021.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2021.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2021.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2021.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2021.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2021.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2021.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2021.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2021.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2021.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2021.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2021.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2021.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2021.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2021.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 14
*/
Lohnsteuer2021.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 15
*/
Lohnsteuer2021.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(85200);
		else this.BBGRV = new BigDecimal(80400);
		this.RVSATZAN = BigDecimal.valueOf(.093);
		this.TBSVORV = BigDecimal.valueOf(.84);
	}
	this.BBGKVPV = new BigDecimal(58050);
	this.bd = new BigDecimal(2);
	this.KVSATZAN = this.KVZ.divide(this.bd).divide(Lohnsteuer2021.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.07650000000000001);
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.02025);
		this.PVSATZAG = BigDecimal.valueOf(.01025);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.01525);
		this.PVSATZAG = BigDecimal.valueOf(.01525);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.0025));
	this.W1STKL5 = new BigDecimal(11237);
	this.W2STKL5 = new BigDecimal(28959);
	this.W3STKL5 = new BigDecimal(219690);
	this.GFB = new BigDecimal(9744);
	this.SOLZFREI = new BigDecimal(16956);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 16
*/
Lohnsteuer2021.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2021.ZAHL12).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2021.ZAHL12).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2021.ZAHL12).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2021.ZAHL12).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2021.ZAHL360).divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2021.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2021.TAB2[this.J].divide(Lohnsteuer2021.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2021.TAB3[this.J].divide(Lohnsteuer2021.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2021.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2021.TAB2[this.J];
			this.FVBZ = Lohnsteuer2021.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2021.TAB1[this.J]).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2021.TAB1[this.J]).divide(Lohnsteuer2021.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2021.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2021.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2021.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2021.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2021.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2021.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2021.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 18
*/
Lohnsteuer2021.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2021.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2021.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 20
*/
Lohnsteuer2021.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2021.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 21
*/
Lohnsteuer2021.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2021.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2021.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 22
*/
Lohnsteuer2021.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(Lohnsteuer2021.ZAHL1000) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(Lohnsteuer2021.ZAHL1000);
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(1908);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4194)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 23
*/
Lohnsteuer2021.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2021.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2021.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2021.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2021.ZAHL100)).divide(Lohnsteuer2021.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2021.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2021.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2021.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 24
*/
Lohnsteuer2021.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 24
*/
Lohnsteuer2021.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2021.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2021.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 25
*/
Lohnsteuer2021.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2021.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 26
*/
Lohnsteuer2021.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2021.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB21();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG) PAP Seite 27
*/
Lohnsteuer2021.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.TBSVORV.multiply(this.ZRE4VP).setScale(2, BigDecimal.ROUND_DOWN);
		this.VSP1 = this.VSP1.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 28
*/
Lohnsteuer2021.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2021.ZAHL12).divide(Lohnsteuer2021.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2021.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 30
*/
Lohnsteuer2021.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB21();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB21();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2021.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 31
*/
Lohnsteuer2021.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(11.9)).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2021.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2021.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 32
*/
Lohnsteuer2021.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2021.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2021.ZAHL7).divide(Lohnsteuer2021.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2021.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 33
*/
Lohnsteuer2021.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2021.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2021.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2021.ZAHL100);
		if (this.STS.compareTo(BigDecimal.ZERO()) == -1) this.STS = BigDecimal.ZERO();
		this.MSOLZSTS();
		if (this.R > 0) this.BKS = this.STS;
		else this.BKS = BigDecimal.ZERO();
	}
};
/**
* Berechnung des SolZ auf sonstige Bezüge, PAP Seite 34, Neu ab 2021
*/
Lohnsteuer2021.prototype.MSOLZSTS = function() {
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) this.SOLZSZVE = this.ZVE.subtract(this.KFB);
	else this.SOLZSZVE = this.ZVE;
	if (this.SOLZSZVE.compareTo(BigDecimal.ONE()) == -1) {
		this.SOLZSZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB21();
	else this.MST5_6();
	this.SOLZSBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2021.ZAHL100, 0, BigDecimal.ROUND_DOWN);
	else this.SOLZS = BigDecimal.ZERO();
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 35
*/
Lohnsteuer2021.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2021.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2021.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2021.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2021.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2021.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2021.ZAHL100);
		this.SOLZVBMG = this.STV.divide(Lohnsteuer2021.ZAHL100, 0, BigDecimal.ROUND_DOWN).add(this.JBMG);
		if (this.SOLZVBMG.compareTo(this.SOLZFREI) == 1) this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2021.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		else this.SOLZV = BigDecimal.ZERO();
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 36
*/
Lohnsteuer2021.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2021.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2021.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2021.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2021.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 37
*/
Lohnsteuer2021.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2021.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2021.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2021.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 38
*/
Lohnsteuer2021.prototype.UPTAB21 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2021.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(14754)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2021.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(995.21));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(57919)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(14753)).divide(Lohnsteuer2021.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(208.85));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(950.96)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(274613)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(9136.63)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(17374.99)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2022.ts
function Lohnsteuer2022(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG
	* sowie tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 4 EStG) in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung
	* auf der Bescheinigung für den Lohnsteuerabzug 2022 in Cent (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung auf der
	* Bescheinigung für den Lohnsteuerabzug 2022 in Cent (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge (d.h. auch ohne Vergütung
	* für mehrjährige Tätigkeit und ohne die zu besteuernden Vorteile bei Vermögensbeteiligungen,
	* § 19a Absatz 4 EStG) in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingaben zu sonstigen
	* Bezügen (Felder SONSTB, VMT oder VKAPA).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden,
	* so sind sie dem voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Gleiches gilt für zu
	* besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG). Vergütungen für
	* mehrjährige Tätigkeit aus einem vorangegangenen Abrechnungszeitraum werden in voller
	* Höhe hinzugerechnet.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Einkommensbezogener Zusatzbeitragssatz eines gesetzlich krankenversicherten Arbeitnehmers,
	* auf dessen Basis der an die Krankenkasse zu zahlende Zusatzbeitrag berechnet wird,
	* in Prozent (bspw. 0,90 für 0,90 %) mit 2 Dezimalstellen.
	* Der von der Kranken-kasse festgesetzte Zusatzbeitragssatz ist bei Abweichungen unmaßgeblich.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2022 eingetragene Freibetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2022 eingetragene Hinzurechnungsbetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Nicht zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) in Cent
	*/
	this.MBV = new BigDecimal(0);
	if (params["MBV"] !== void 0) this.setMbv(params["MBV"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. elektronischer Lohnsteuerabzugsmerkmale oder der
	* Bescheinigung für den Lohnsteuerabzug 2022 (bei keiner Religionszugehörigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn für den Lohnzahlungszeitraum vor Berücksichtigung des
	* Versorgungsfreibetrags und des Zuschlags zum Versorgungsfreibetrag, des Altersentlastungsbetrags
	* und des als elektronisches Lohnsteuerabzugsmerkmal festgestellten oder in der Bescheinigung für
	* den Lohnsteuerabzug 2022 für den Lohnzahlungszeitraum eingetragenen Freibetrags bzw.
	* Hinzurechnungsbetrags in Cent
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezüge (ohne Vergütung aus mehrjähriger Tätigkeit) einschließlich nicht tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen und Sterbegeld bei Versorgungsbezügen sowie
	* Kapitalauszahlungen/Abfindungen, soweit es sich nicht um Bezüge für mehrere Jahre handelt,
	* in Cent (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Entschädigungen und Vergütung für mehrjährige Tätigkeit sowie tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 Satz 2 EStG)
	* ohne Kapitalauszahlungen und ohne Abfindungen bei Versorgungsbezügen
	* in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG und zu besteuernde
	* Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG sowie nicht
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Bezüge (ohne Vergütung für mehrjährige Tätigkeit)
	* für die Kirchenlohnsteuer in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei
	* Vermögensbeteiligungen (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern BK
	* (maximal bis 0). Der Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen
	* im Rahmen der Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.BKS = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen für die Kirchenlohnsteuer in Cent
	*/
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern SOLZLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit und ohne
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen) in Cent
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern LSTLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt zu besteuernden
	* Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* Nach Programmablaufplan 2019
	*/
	this.bd = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag für Alleinerziehende in Euro
	* Hinweis: Der Entlastungsbetrag für Alleinerziehende beträgt ab
	* 2022 4.008 Euro. Der Erhöhungsbetrag von 2.100 Euro, der für die
	* Jahre 2020 und 2021 galt, ist ab 2022 weggefallen (Jahressteuergesetz 2020).
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro
	*/
	this.SOLZSBMG = new BigDecimal(0);
	/**
	* Neu ab 2021: Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro, Cent (2 Dezimalstellen)
	*/
	this.SOLZSZVE = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
	*/
	this.SOLZVBMG = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2022, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2022, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2022, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2022, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2022, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2022, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2022, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2022, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2022, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2022, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2022, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2022, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2022, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2022, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2022, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2022, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2022.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2022.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2022.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2022.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2022.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2022.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2022.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2022.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2022.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2022.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2022.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2022.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2022.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2022.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2022.prototype.setMbv = function(value) {
	this.MBV = value;
};
Lohnsteuer2022.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2022.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2022.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2022.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2022.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2022.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2022.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2022.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2022.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2022.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2022.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2022.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2022.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2022.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2022.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2022.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2022.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2022.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2022.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2022.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2022.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2022.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2022.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2022.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2022.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2022.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2022.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2022.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2022.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2022.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2022.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2022.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2022.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2022.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2022.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2022.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2022.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 14
*/
Lohnsteuer2022.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 15
*/
Lohnsteuer2022.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(84600);
		else this.BBGRV = new BigDecimal(81e3);
		this.RVSATZAN = BigDecimal.valueOf(.093);
		this.TBSVORV = BigDecimal.valueOf(.88);
	}
	this.BBGKVPV = new BigDecimal(58050);
	this.bd = new BigDecimal(2);
	this.KVSATZAN = this.KVZ.divide(this.bd).divide(Lohnsteuer2022.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.07650000000000001);
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.02025);
		this.PVSATZAG = BigDecimal.valueOf(.01025);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.01525);
		this.PVSATZAG = BigDecimal.valueOf(.01525);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.0035));
	this.W1STKL5 = new BigDecimal(11480);
	this.W2STKL5 = new BigDecimal(29298);
	this.W3STKL5 = new BigDecimal(222260);
	this.GFB = new BigDecimal(9984);
	this.SOLZFREI = new BigDecimal(16956);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 16
*/
Lohnsteuer2022.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2022.ZAHL12).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2022.ZAHL12).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2022.ZAHL12).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2022.ZAHL12).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2022.ZAHL360).divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2022.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2022.TAB2[this.J].divide(Lohnsteuer2022.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2022.TAB3[this.J].divide(Lohnsteuer2022.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2022.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2022.TAB2[this.J];
			this.FVBZ = Lohnsteuer2022.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2022.TAB1[this.J]).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2022.TAB1[this.J]).divide(Lohnsteuer2022.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2022.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2022.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2022.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2022.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2022.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2022.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2022.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 18
*/
Lohnsteuer2022.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2022.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2022.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 20
*/
Lohnsteuer2022.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2022.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 21
*/
Lohnsteuer2022.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2022.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2022.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 22
*/
Lohnsteuer2022.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(Lohnsteuer2022.ZAHL1000) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(Lohnsteuer2022.ZAHL1000);
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(4008);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8388)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4194)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 23
*/
Lohnsteuer2022.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2022.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2022.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2022.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2022.ZAHL100)).divide(Lohnsteuer2022.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2022.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2022.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2022.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 24
*/
Lohnsteuer2022.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 24
*/
Lohnsteuer2022.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2022.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2022.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 25
*/
Lohnsteuer2022.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2022.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 26
*/
Lohnsteuer2022.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2022.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB22();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG) PAP Seite 27
*/
Lohnsteuer2022.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.TBSVORV.multiply(this.ZRE4VP).setScale(2, BigDecimal.ROUND_DOWN);
		this.VSP1 = this.VSP1.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 28
*/
Lohnsteuer2022.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2022.ZAHL12).divide(Lohnsteuer2022.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2022.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 30
*/
Lohnsteuer2022.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB22();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB22();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2022.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 31
*/
Lohnsteuer2022.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(11.9)).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2022.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2022.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 32
*/
Lohnsteuer2022.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2022.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2022.ZAHL7).divide(Lohnsteuer2022.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2022.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 33
*/
Lohnsteuer2022.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0 && this.MBV.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2022.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2022.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2022.ZAHL100);
		this.STSMIN();
	}
};
/**
* Neu für 2022
*/
Lohnsteuer2022.prototype.STSMIN = function() {
	if (this.STS.compareTo(BigDecimal.ZERO()) == -1) {
		if (this.MBV.compareTo(BigDecimal.ZERO()) == 0) {} else {
			this.LSTLZZ = this.LSTLZZ.add(this.STS);
			if (this.LSTLZZ.compareTo(BigDecimal.ZERO()) == -1) this.LSTLZZ = BigDecimal.ZERO();
			this.SOLZLZZ = this.SOLZLZZ.add(this.STS.multiply(BigDecimal.valueOf(5.5).divide(Lohnsteuer2022.ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.SOLZLZZ.compareTo(BigDecimal.ZERO()) == -1) this.SOLZLZZ = BigDecimal.ZERO();
			this.BK = this.BK.add(this.STS);
			if (this.BK.compareTo(BigDecimal.ZERO()) == -1) this.BK = BigDecimal.ZERO();
		}
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
	} else this.MSOLZSTS();
	if (this.R > 0) this.BKS = this.STS;
	else this.BKS = BigDecimal.ZERO();
};
/**
* Berechnung des SolZ auf sonstige Bezüge, PAP Seite 34, Neu ab 2021
*/
Lohnsteuer2022.prototype.MSOLZSTS = function() {
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) this.SOLZSZVE = this.ZVE.subtract(this.KFB);
	else this.SOLZSZVE = this.ZVE;
	if (this.SOLZSZVE.compareTo(BigDecimal.ONE()) == -1) {
		this.SOLZSZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB22();
	else this.MST5_6();
	this.SOLZSBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2022.ZAHL100, 0, BigDecimal.ROUND_DOWN);
	else this.SOLZS = BigDecimal.ZERO();
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 35
*/
Lohnsteuer2022.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2022.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2022.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2022.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2022.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2022.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2022.ZAHL100);
		this.SOLZVBMG = this.STV.divide(Lohnsteuer2022.ZAHL100, 0, BigDecimal.ROUND_DOWN).add(this.JBMG);
		if (this.SOLZVBMG.compareTo(this.SOLZFREI) == 1) this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2022.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		else this.SOLZV = BigDecimal.ZERO();
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 36
*/
Lohnsteuer2022.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2022.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2022.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2022.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2022.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 37
*/
Lohnsteuer2022.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.add(this.MBV.divide(Lohnsteuer2022.ZAHL100)).subtract(this.JRE4ENT.divide(Lohnsteuer2022.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2022.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2022.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 38
*/
Lohnsteuer2022.prototype.UPTAB22 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2022.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(14927)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2022.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(1008.7));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(58597)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(14926)).divide(Lohnsteuer2022.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(206.43));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(938.24)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(277826)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(9267.53)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(17602.28)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2023.ts
function Lohnsteuer2023(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG
	* sowie tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 4 EStG) in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung
	* auf der Bescheinigung für den Lohnsteuerabzug 2023 in Cent (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung auf der
	* Bescheinigung für den Lohnsteuerabzug 2023 in Cent (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge (d.h. auch ohne Vergütung
	* für mehrjährige Tätigkeit und ohne die zu besteuernden Vorteile bei Vermögensbeteiligungen,
	* § 19a Absatz 4 EStG) in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingaben zu sonstigen
	* Bezügen (Felder SONSTB, VMT oder VKAPA).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden,
	* so sind sie dem voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Gleiches gilt für zu
	* besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG). Vergütungen für
	* mehrjährige Tätigkeit aus einem vorangegangenen Abrechnungszeitraum werden in voller
	* Höhe hinzugerechnet.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Einkommensbezogener Zusatzbeitragssatz eines gesetzlich krankenversicherten Arbeitnehmers,
	* auf dessen Basis der an die Krankenkasse zu zahlende Zusatzbeitrag berechnet wird,
	* in Prozent (bspw. 0,90 für 0,90 %) mit 2 Dezimalstellen.
	* Der von der Kranken-kasse festgesetzte Zusatzbeitragssatz ist bei Abweichungen unmaßgeblich.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2023 eingetragene Freibetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2023 eingetragene Hinzurechnungsbetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Nicht zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) in Cent
	*/
	this.MBV = new BigDecimal(0);
	if (params["MBV"] !== void 0) this.setMbv(params["MBV"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. elektronischer Lohnsteuerabzugsmerkmale oder der
	* Bescheinigung für den Lohnsteuerabzug 2023 (bei keiner Religionszugehörigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn für den Lohnzahlungszeitraum vor Berücksichtigung des
	* Versorgungsfreibetrags und des Zuschlags zum Versorgungsfreibetrag, des Altersentlastungsbetrags
	* und des als elektronisches Lohnsteuerabzugsmerkmal festgestellten oder in der Bescheinigung für
	* den Lohnsteuerabzug 2023 für den Lohnzahlungszeitraum eingetragenen Freibetrags bzw.
	* Hinzurechnungsbetrags in Cent
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezüge (ohne Vergütung aus mehrjähriger Tätigkeit) einschließlich nicht tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen und Sterbegeld bei Versorgungsbezügen sowie
	* Kapitalauszahlungen/Abfindungen, soweit es sich nicht um Bezüge für mehrere Jahre handelt,
	* in Cent (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Entschädigungen und Vergütung für mehrjährige Tätigkeit sowie tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 Satz 2 EStG)
	* ohne Kapitalauszahlungen und ohne Abfindungen bei Versorgungsbezügen
	* in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG und zu besteuernde
	* Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG sowie nicht
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Bezüge (ohne Vergütung für mehrjährige Tätigkeit)
	* für die Kirchenlohnsteuer in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei
	* Vermögensbeteiligungen (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern BK
	* (maximal bis 0). Der Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen
	* im Rahmen der Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.BKS = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen für die Kirchenlohnsteuer in Cent
	*/
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern SOLZLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit und ohne
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen) in Cent
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern LSTLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt zu besteuernden
	* Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem
	* Grundfreibetrag bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag für Alleinerziehende in Euro
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag
	* für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro
	*/
	this.SOLZSBMG = new BigDecimal(0);
	/**
	* Neu ab 2021: Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur
	* Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in
	* Euro, Cent (2 Dezimalstellen)
	*/
	this.SOLZSZVE = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim
	* Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
	*/
	this.SOLZVBMG = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2023, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2023, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2023, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2023, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2023, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2023, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2023, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2023, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2023, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2023, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2023, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2023, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2023, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2023, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2023, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2023, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2023.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2023.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2023.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2023.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2023.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2023.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2023.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2023.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2023.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2023.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2023.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2023.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2023.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2023.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2023.prototype.setMbv = function(value) {
	this.MBV = value;
};
Lohnsteuer2023.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2023.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2023.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2023.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2023.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2023.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2023.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2023.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2023.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2023.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2023.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2023.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2023.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2023.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2023.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2023.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2023.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2023.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2023.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2023.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2023.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2023.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2023.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2023.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2023.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2023.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2023.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2023.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2023.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2023.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2023.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2023.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2023.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2023.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2023.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2023.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2023.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 14
*/
Lohnsteuer2023.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 15
*/
Lohnsteuer2023.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(87600);
		else this.BBGRV = new BigDecimal(85200);
		this.RVSATZAN = BigDecimal.valueOf(.093);
		this.TBSVORV = BigDecimal.valueOf(1);
	}
	this.BBGKVPV = new BigDecimal(59850);
	this.KVSATZAN = this.KVZ.divide(Lohnsteuer2023.ZAHL2).divide(Lohnsteuer2023.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.008).add(BigDecimal.valueOf(.07));
	if (this.LZZ == 1) {
		if (this.PVS == 1) {
			this.PVSATZAN = BigDecimal.valueOf(.021125);
			this.PVSATZAG = BigDecimal.valueOf(.011125);
		} else {
			this.PVSATZAN = BigDecimal.valueOf(.016125);
			this.PVSATZAG = BigDecimal.valueOf(.016125);
		}
		if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.00475));
	} else {
		if (this.PVS == 1) {
			this.PVSATZAN = BigDecimal.valueOf(.022);
			this.PVSATZAG = BigDecimal.valueOf(.012);
		} else {
			this.PVSATZAN = BigDecimal.valueOf(.017);
			this.PVSATZAG = BigDecimal.valueOf(.017);
		}
		if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.006));
	}
	this.W1STKL5 = new BigDecimal(12485);
	this.W2STKL5 = new BigDecimal(31404);
	this.W3STKL5 = new BigDecimal(222260);
	this.GFB = new BigDecimal(10908);
	this.SOLZFREI = new BigDecimal(17543);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 16
*/
Lohnsteuer2023.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2023.ZAHL12).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2023.ZAHL12).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2023.ZAHL12).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2023.ZAHL12).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2023.ZAHL360).divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2023.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2023.TAB2[this.J].divide(Lohnsteuer2023.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2023.TAB3[this.J].divide(Lohnsteuer2023.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2023.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2023.TAB2[this.J];
			this.FVBZ = Lohnsteuer2023.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2023.TAB1[this.J]).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2023.TAB1[this.J]).divide(Lohnsteuer2023.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2023.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2023.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2023.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2023.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2023.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2023.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2023.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 18
*/
Lohnsteuer2023.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2023.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2023.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 20
*/
Lohnsteuer2023.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2023.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 21
*/
Lohnsteuer2023.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2023.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2023.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 22
*/
Lohnsteuer2023.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(BigDecimal.valueOf(1230));
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8952)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(4260);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8952)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(8952)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4476)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 23
*/
Lohnsteuer2023.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2023.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2023.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2023.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2023.ZAHL100)).divide(Lohnsteuer2023.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2023.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2023.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2023.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 24
*/
Lohnsteuer2023.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 24
*/
Lohnsteuer2023.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2023.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2023.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 25
*/
Lohnsteuer2023.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2023.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 26
*/
Lohnsteuer2023.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2023.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB23();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG) PAP Seite 27
*/
Lohnsteuer2023.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.TBSVORV.multiply(this.ZRE4VP).setScale(2, BigDecimal.ROUND_DOWN);
		this.VSP1 = this.VSP1.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 28
*/
Lohnsteuer2023.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2023.ZAHL12).divide(Lohnsteuer2023.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2023.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 30
*/
Lohnsteuer2023.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB23();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB23();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2023.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 31
*/
Lohnsteuer2023.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(11.9)).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2023.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2023.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 32
*/
Lohnsteuer2023.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2023.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2023.ZAHL7).divide(Lohnsteuer2023.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2023.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 33
*/
Lohnsteuer2023.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0 && this.MBV.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2023.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2023.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2023.ZAHL100);
		this.STSMIN();
	}
};
/**
* Neu für 2022, PAP Seite 34
*/
Lohnsteuer2023.prototype.STSMIN = function() {
	if (this.STS.compareTo(BigDecimal.ZERO()) == -1) {
		if (this.MBV.compareTo(BigDecimal.ZERO()) == 0) {} else {
			this.LSTLZZ = this.LSTLZZ.add(this.STS);
			if (this.LSTLZZ.compareTo(BigDecimal.ZERO()) == -1) this.LSTLZZ = BigDecimal.ZERO();
			this.SOLZLZZ = this.SOLZLZZ.add(this.STS.multiply(BigDecimal.valueOf(5.5).divide(Lohnsteuer2023.ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.SOLZLZZ.compareTo(BigDecimal.ZERO()) == -1) this.SOLZLZZ = BigDecimal.ZERO();
			this.BK = this.BK.add(this.STS);
			if (this.BK.compareTo(BigDecimal.ZERO()) == -1) this.BK = BigDecimal.ZERO();
		}
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
	} else this.MSOLZSTS();
	if (this.R > 0) this.BKS = this.STS;
	else this.BKS = BigDecimal.ZERO();
};
/**
* Berechnung des SolZ auf sonstige Bezüge, PAP Seite 35, Neu ab 2021
*/
Lohnsteuer2023.prototype.MSOLZSTS = function() {
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) this.SOLZSZVE = this.ZVE.subtract(this.KFB);
	else this.SOLZSZVE = this.ZVE;
	if (this.SOLZSZVE.compareTo(BigDecimal.ONE()) == -1) {
		this.SOLZSZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB23();
	else this.MST5_6();
	this.SOLZSBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2023.ZAHL100, 0, BigDecimal.ROUND_DOWN);
	else this.SOLZS = BigDecimal.ZERO();
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 36
*/
Lohnsteuer2023.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2023.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2023.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2023.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2023.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2023.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2023.ZAHL100);
		this.SOLZVBMG = this.STV.divide(Lohnsteuer2023.ZAHL100, 0, BigDecimal.ROUND_DOWN).add(this.JBMG);
		if (this.SOLZVBMG.compareTo(this.SOLZFREI) == 1) this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2023.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		else this.SOLZV = BigDecimal.ZERO();
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit,
* PAP Seite 37
*/
Lohnsteuer2023.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2023.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2023.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2023.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2023.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit,
* PAP Seite 38
*/
Lohnsteuer2023.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.add(this.MBV.divide(Lohnsteuer2023.ZAHL100)).subtract(this.JRE4ENT.divide(Lohnsteuer2023.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2023.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2023.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 39
*/
Lohnsteuer2023.prototype.UPTAB23 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2023.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(16e3)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2023.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(979.18));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(62810)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(15999)).divide(Lohnsteuer2023.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(192.59));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(966.53)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(277826)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(9972.98)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(18307.73)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2024.ts
function Lohnsteuer2024(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG
	* sowie tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 4 EStG) in Cent
	*/
	this.ENTSCH = new BigDecimal(0);
	if (params["ENTSCH"] !== void 0) this.setEntsch(params["ENTSCH"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung
	* auf der Bescheinigung für den Lohnsteuerabzug 2024 in Cent (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung auf der
	* Bescheinigung für den Lohnsteuerabzug 2024 in Cent (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge (d.h. auch ohne Vergütung
	* für mehrjährige Tätigkeit und ohne die zu besteuernden Vorteile bei Vermögensbeteiligungen,
	* § 19a Absatz 4 EStG) in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingaben zu sonstigen
	* Bezügen (Felder SONSTB, VMT oder VKAPA).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden,
	* so sind sie dem voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Gleiches gilt für zu
	* besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG). Vergütungen für
	* mehrjährige Tätigkeit aus einem vorangegangenen Abrechnungszeitraum werden in voller
	* Höhe hinzugerechnet.
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 2 = der Arbeitnehmer ist NICHT in der gesetzlichen Rentenversicherung versichert.
	*
	* 1 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze OST.
	*
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung versichert, es gilt die
	* Beitragsbemessungsgrenze WEST.
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Kassenindividueller Zusatzbeitragssatz bei einem gesetzlich krankenversicherten Arbeitnehmer
	* in Prozent (bspw. 1,70 für 1,70 %) mit 2 Dezimalstellen.
	* Es ist der volle Zusatzbeitragssatz anzugeben. Die Aufteilung in Arbeitnehmer- und Arbeitgeber-
	* anteil erfolgt im Programmablauf.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2024 eingetragene Freibetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2024 eingetragene Hinzurechnungsbetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Nicht zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) in Cent
	*/
	this.MBV = new BigDecimal(0);
	if (params["MBV"] !== void 0) this.setMbv(params["MBV"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* Zahl der beim Arbeitnehmer zu berücksichtigenden Beitragsabschläge in der sozialen Pflegeversicherung
	* bei mehr als einem Kind
	* 0 = kein Abschlag
	* 1 = Beitragsabschlag für das 2. Kind
	* 2 = Beitragsabschläge für das 2. und 3. Kind
	* 3 = Beitragsabschläge für 2. bis 4. Kinder
	* 4 = Beitragsabschläge für 2. bis 5. oder mehr Kinder
	*/
	this.PVA = new BigDecimal(0);
	if (params["PVA"] !== void 0) this.setPva(params["PVA"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. elektronischer Lohnsteuerabzugsmerkmale oder der
	* Bescheinigung für den Lohnsteuerabzug 2024 (bei keiner Religionszugehörigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn für den Lohnzahlungszeitraum vor Berücksichtigung des
	* Versorgungsfreibetrags und des Zuschlags zum Versorgungsfreibetrag, des Altersentlastungsbetrags
	* und des als elektronisches Lohnsteuerabzugsmerkmal festgestellten oder in der Bescheinigung für
	* den Lohnsteuerabzug 2024 für den Lohnzahlungszeitraum eingetragenen Freibetrags bzw.
	* Hinzurechnungsbetrags in Cent
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezüge (ohne Vergütung aus mehrjähriger Tätigkeit) einschließlich nicht tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen und Sterbegeld bei Versorgungsbezügen sowie
	* Kapitalauszahlungen/Abfindungen, soweit es sich nicht um Bezüge für mehrere Jahre handelt,
	* in Cent (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
	* (in SONSTB enthalten) in Cents
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
	* für mehrere Jahre in Cent (ggf. 0)
	*/
	this.VKAPA = new BigDecimal(0);
	if (params["VKAPA"] !== void 0) this.setVkapa(params["VKAPA"]);
	/**
	* Entschädigungen und Vergütung für mehrjährige Tätigkeit sowie tarifermäßigt
	* zu besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 Satz 2 EStG)
	* ohne Kapitalauszahlungen und ohne Abfindungen bei Versorgungsbezügen
	* in Cent (ggf. 0)
	*/
	this.VMT = new BigDecimal(0);
	if (params["VMT"] !== void 0) this.setVmt(params["VMT"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG und zu besteuernde
	* Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG sowie nicht
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Bezüge (ohne Vergütung für mehrjährige Tätigkeit)
	* für die Kirchenlohnsteuer in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei
	* Vermögensbeteiligungen (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern BK
	* (maximal bis 0). Der Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen
	* im Rahmen der Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.BKS = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen für die Kirchenlohnsteuer in Cent
	*/
	this.BKV = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern SOLZLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
	* zu besteuernden Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.SOLZV = new BigDecimal(0);
	/**
	* Lohnsteuer für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit und ohne
	* tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen) in Cent
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern LSTLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.STS = new BigDecimal(0);
	/**
	* Lohnsteuer für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt zu besteuernden
	* Vorteile bei Vermögensbeteiligungen in Cent
	*/
	this.STV = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
	* Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag für Alleinerziehende in Euro
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Versorgungsfreibetrag in €
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Jahreswert Lohnsteuer vor Gesetz zur steuerlichen Freistellung des
	* Existenzminimums 2024 in Cent
	*/
	this.JWLSTA = new BigDecimal(0);
	/**
	* Jahreswert Lohnsteuer unter Berücksichtigung des Gesetzes zur
	* steuerlichen Freistellung des Existenzminimums 2024 in Cent
	*/
	this.JWLSTN = new BigDecimal(0);
	/**
	* Jahreswert Solidaritätszuschlag vor Gesetz zur steuerlichen
	* Freistellung des Existenzminimums 2024 in Cent
	*/
	this.JWSOLZA = new BigDecimal(0);
	/**
	* Jahreswert Solidaritätszuschlag unter Berücksichtigung des
	* Gesetzes zur steuerlichen Freistellung des Existenzminimums 2024
	* in Cent
	*/
	this.JWSOLZN = new BigDecimal(0);
	/**
	* Jahreswert Bemessungsgrundlage Kirchensteuer vor Gesetz zur
	* steuerlichen Freistellung des Existenzminimums 2024 in Cent
	*/
	this.JWBKA = new BigDecimal(0);
	/**
	* Jahreswert Bemessungsgrundlage Kirchensteuer unter
	* Berücksichtigung des Gesetzes zur steuerlichen Freistellung des
	* Existenzminimums 2024 in Cent
	*/
	this.JWBKN = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
	* 0 = normale Steuerberechnung
	* 1 = Steuerberechnung für mehrjährige Tätigkeit
	* 2 = entfällt
	*/
	this.KENNVMT = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LST1 = new BigDecimal(0);
	this.LST2 = new BigDecimal(0);
	this.LST3 = new BigDecimal(0);
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Schleifenzähler für Differenzberechnung
	*/
	this.SCHLEIFZ = 0;
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro
	*/
	this.SOLZSBMG = new BigDecimal(0);
	/**
	* Neu ab 2021: Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro, Cent (2 Dezimalstellen)
	*/
	this.SOLZSZVE = new BigDecimal(0);
	/**
	* Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
	*/
	this.SOLZVBMG = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
	*/
	this.STOVMT = new BigDecimal(0);
	/**
	* Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
	*/
	this.TBSVORV = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
	*/
	this.VSPMAX1 = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
	*/
	this.VSPMAX2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPO = new BigDecimal(0);
	/**
	* Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
	* Rest von VSPO in EURO, C (2 Dezimalstellen)
	*/
	this.VSPREST = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
	* in EURO, C (2 Dezimalstellen)
	*/
	this.VSPVOR = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Merkfeld ZRE4VP für Schleifenberechnung Dezember 2024 in Euro, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VPM = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	this.ZZX = new BigDecimal(0);
	this.HOCH = new BigDecimal(0);
	this.VERGL = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
}
/**
* Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2024, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
*/
Object.defineProperty(Lohnsteuer2024, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
*/
Object.defineProperty(Lohnsteuer2024, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2024, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(0)
] });
/**
* Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
*/
Object.defineProperty(Lohnsteuer2024, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2024, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2024, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2024, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2024, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2024, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2024, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2024, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2024, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2024, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2024, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2024, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2024.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2024.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2024.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2024.prototype.setEntsch = function(value) {
	this.ENTSCH = value;
};
Lohnsteuer2024.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2024.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2024.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2024.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2024.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2024.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2024.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2024.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2024.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2024.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2024.prototype.setMbv = function(value) {
	this.MBV = value;
};
Lohnsteuer2024.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2024.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2024.prototype.setPva = function(value) {
	this.PVA = value;
};
Lohnsteuer2024.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2024.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2024.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2024.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2024.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2024.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2024.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2024.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2024.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2024.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2024.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2024.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2024.prototype.setVkapa = function(value) {
	this.VKAPA = value;
};
Lohnsteuer2024.prototype.setVmt = function(value) {
	this.VMT = value;
};
Lohnsteuer2024.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2024.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2024.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2024.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2024.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2024.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2024.prototype.getBkv = function() {
	return this.BKV;
};
Lohnsteuer2024.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2024.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2024.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2024.prototype.getSolzv = function() {
	return this.SOLZV;
};
Lohnsteuer2024.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2024.prototype.getStv = function() {
	return this.STV;
};
Lohnsteuer2024.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2024.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2024.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2024.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2024.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2024.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2024.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2024.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 15, LST1224
*/
Lohnsteuer2024.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.KENNVMT = 0;
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VPM = this.ZRE4VP;
	this.SCHLEIFZ = 1;
	this.MBERECH();
	this.SCHLEIFZ = 2;
	this.W1STKL5 = BigDecimal.valueOf(13432);
	this.GFB = BigDecimal.valueOf(11784);
	this.SOLZFREI = BigDecimal.valueOf(18130);
	this.ZRE4VP = this.ZRE4VPM;
	this.MBERECH();
	this.MLST1224();
	this.MSONST();
	this.MVMT();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 16
*/
Lohnsteuer2024.prototype.MPARA = function() {
	if (this.KRV < 2) {
		if (this.KRV == 0) this.BBGRV = new BigDecimal(90600);
		else this.BBGRV = new BigDecimal(89400);
		this.RVSATZAN = BigDecimal.valueOf(.093);
	}
	this.BBGKVPV = new BigDecimal(62100);
	this.KVSATZAN = this.KVZ.divide(Lohnsteuer2024.ZAHL2).divide(Lohnsteuer2024.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.0085).add(BigDecimal.valueOf(.07));
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.022);
		this.PVSATZAG = BigDecimal.valueOf(.012);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.017);
		this.PVSATZAG = BigDecimal.valueOf(.017);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.006));
	else this.PVSATZAN = this.PVSATZAN.subtract(this.PVA.multiply(BigDecimal.valueOf(.0025)));
	this.W1STKL5 = new BigDecimal(13279);
	this.W2STKL5 = new BigDecimal(33380);
	this.W3STKL5 = new BigDecimal(222260);
	this.GFB = new BigDecimal(11604);
	this.SOLZFREI = new BigDecimal(18130);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 17
*/
Lohnsteuer2024.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2024.ZAHL12).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2024.ZAHL12).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2024.ZAHL12).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2024.ZAHL12).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2024.ZAHL360).divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 18
*/
Lohnsteuer2024.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2040) this.J = this.VJAHR - 2004;
		else this.J = 36;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2024.TAB2[this.J].divide(Lohnsteuer2024.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB));
			this.FVBZ = Lohnsteuer2024.TAB3[this.J].divide(Lohnsteuer2024.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2024.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2024.TAB2[this.J];
			this.FVBZ = Lohnsteuer2024.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2024.TAB1[this.J]).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2024.TAB1[this.J]).divide(Lohnsteuer2024.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2024.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2024.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2024.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2024.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2024.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2024.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2024.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 19
*/
Lohnsteuer2024.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2040) this.K = this.AJAHR - 2004;
		else this.K = 36;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2024.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2024.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 21
*/
Lohnsteuer2024.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	if (this.KENNVMT == 2) this.ZRE4VP = this.ZRE4VP.subtract(this.ENTSCH.divide(Lohnsteuer2024.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme, PAP Seite 22
*/
Lohnsteuer2024.prototype.MBERECH = function() {
	if (this.SCHLEIFZ == 1) this.MZTABFBA();
	else this.MZTABFBN();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2024.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2024.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge vor Gesetzesänderung für Vergleichsberechnung (ohne Vorsorgepauschale), PAP Seite 23
*/
Lohnsteuer2024.prototype.MZTABFBA = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(BigDecimal.valueOf(1230));
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9312)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(4260);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9312)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9312)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4656)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung der festen Tabellenfreibeträge mit Kinderfreibeträgen nach dem Gesetz zur
* steuerlichen Freistellung des Existenzminimums 2024 (ohne Vorsorgepauschale), PAP Seite 24
*/
Lohnsteuer2024.prototype.MZTABFBN = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(BigDecimal.valueOf(1230));
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(4260);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4770)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 25
*/
Lohnsteuer2024.prototype.MLSTJAHR = function() {
	this.UPEVP();
	if (this.KENNVMT != 1) {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).setScale(2, BigDecimal.ROUND_DOWN);
		this.UPMLST();
	} else {
		this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP).subtract(this.VMT.divide(Lohnsteuer2024.ZAHL100)).subtract(this.VKAPA.divide(Lohnsteuer2024.ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.ZVE.compareTo(BigDecimal.ZERO()) == -1) {
			this.ZVE = this.ZVE.add(this.VMT.divide(Lohnsteuer2024.ZAHL100)).add(this.VKAPA.divide(Lohnsteuer2024.ZAHL100)).divide(Lohnsteuer2024.ZAHL5).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.multiply(Lohnsteuer2024.ZAHL5).setScale(0, BigDecimal.ROUND_DOWN);
		} else {
			this.UPMLST();
			this.STOVMT = this.ST;
			this.ZVE = this.ZVE.add(this.VMT.add(this.VKAPA).divide(Lohnsteuer2024.ZAHL500)).setScale(2, BigDecimal.ROUND_DOWN);
			this.UPMLST();
			this.ST = this.ST.subtract(this.STOVMT).multiply(Lohnsteuer2024.ZAHL5).add(this.STOVMT).setScale(0, BigDecimal.ROUND_DOWN);
		}
	}
};
/**
* PAP Seite 26
*/
Lohnsteuer2024.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 26
*/
Lohnsteuer2024.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2024.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2024.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 27
*/
Lohnsteuer2024.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2024.ZAHL100);
	if (this.SCHLEIFZ == 1) this.JWLSTA = this.JW;
	else this.JWLSTN = this.JW;
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 28
*/
Lohnsteuer2024.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2024.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) if (this.SCHLEIFZ == 1) this.UPTAB24A();
	else this.UPTAB24N();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG) PAP Seite 29
*/
Lohnsteuer2024.prototype.UPEVP = function() {
	if (this.KRV > 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.ZRE4VP.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 30
*/
Lohnsteuer2024.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2024.ZAHL12).divide(Lohnsteuer2024.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 31
*/
Lohnsteuer2024.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 32
*/
Lohnsteuer2024.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.SCHLEIFZ == 1) this.UPTAB24A();
	else this.UPTAB24N();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.SCHLEIFZ == 1) this.UPTAB24A();
	else this.UPTAB24N();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2024.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 33
*/
Lohnsteuer2024.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(11.9)).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2024.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		if (this.SCHLEIFZ == 1) this.JWSOLZA = this.JW;
		else this.JWSOLZN = this.JW;
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2024.ZAHL100);
		if (this.SCHLEIFZ == 1) this.JWBKA = this.JW;
		else this.JWBKN = this.JW;
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Differenzrechnung Dezember 2024, PAP Seite 34
*/
Lohnsteuer2024.prototype.MLST1224 = function() {
	if (this.LZZ > 1) {
		this.JW = this.JWLSTN.subtract(BigDecimal.valueOf(11).multiply(this.JWLSTA.subtract(this.JWLSTN)));
		if (this.JW.compareTo(BigDecimal.ZERO()) < 0) this.ANTEIL1 = BigDecimal.ZERO();
		else this.UPANTEIL();
		this.LSTLZZ = this.ANTEIL1;
		this.JW = this.JWSOLZN.subtract(BigDecimal.valueOf(11).multiply(this.JWSOLZA.subtract(this.JWSOLZN)));
		if (this.JW.compareTo(BigDecimal.ZERO()) < 0) this.ANTEIL1 = BigDecimal.ZERO();
		else this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
		this.JW = this.JWBKN.subtract(BigDecimal.valueOf(11).multiply(this.JWBKA.subtract(this.JWBKN)));
		if (this.JW.compareTo(BigDecimal.ZERO()) < 0) this.ANTEIL1 = BigDecimal.ZERO();
		else this.UPANTEIL();
		this.BK = this.ANTEIL1;
	}
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 35
*/
Lohnsteuer2024.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2024.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2024.ZAHL7).divide(Lohnsteuer2024.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2024.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 36
*/
Lohnsteuer2024.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0 && this.MBV.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2024.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2024.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2024.ZAHL100);
		this.STSMIN();
	}
};
/**
* PAP Seite 37
*/
Lohnsteuer2024.prototype.STSMIN = function() {
	if (this.STS.compareTo(BigDecimal.ZERO()) == -1) {
		if (this.MBV.compareTo(BigDecimal.ZERO()) == 0) {} else {
			this.LSTLZZ = this.LSTLZZ.add(this.STS);
			if (this.LSTLZZ.compareTo(BigDecimal.ZERO()) == -1) this.LSTLZZ = BigDecimal.ZERO();
			this.SOLZLZZ = this.SOLZLZZ.add(this.STS.multiply(BigDecimal.valueOf(5.5).divide(Lohnsteuer2024.ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.SOLZLZZ.compareTo(BigDecimal.ZERO()) == -1) this.SOLZLZZ = BigDecimal.ZERO();
			this.BK = this.BK.add(this.STS);
			if (this.BK.compareTo(BigDecimal.ZERO()) == -1) this.BK = BigDecimal.ZERO();
		}
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
	} else this.MSOLZSTS();
	if (this.R > 0) this.BKS = this.STS;
	else this.BKS = BigDecimal.ZERO();
};
/**
* Berechnung des SolZ auf sonstige Bezüge, PAP Seite 38
*/
Lohnsteuer2024.prototype.MSOLZSTS = function() {
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) this.SOLZSZVE = this.ZVE.subtract(this.KFB);
	else this.SOLZSZVE = this.ZVE;
	if (this.SOLZSZVE.compareTo(BigDecimal.ONE()) == -1) {
		this.SOLZSZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB24N();
	else this.MST5_6();
	this.SOLZSBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2024.ZAHL100, 0, BigDecimal.ROUND_DOWN);
	else this.SOLZS = BigDecimal.ZERO();
};
/**
* Berechnung der Verguetung fuer mehrjaehrige Taetigkeit nach § 39b Abs. 3 Satz 9 und 10 EStG), PAP Seite 39
*/
Lohnsteuer2024.prototype.MVMT = function() {
	if (this.VKAPA.compareTo(BigDecimal.ZERO()) == -1) this.VKAPA = BigDecimal.ZERO();
	if (this.VMT.add(this.VKAPA).compareTo(BigDecimal.ZERO()) == 1) {
		if (this.LSTSO.compareTo(BigDecimal.ZERO()) == 0) {
			this.MOSONST();
			this.LST1 = this.LSTOSO;
		} else this.LST1 = this.LSTSO;
		this.VBEZBSO = this.STERBE.add(this.VKAPA);
		this.ZRE4J = this.JRE4.add(this.SONSTB).add(this.VMT).add(this.VKAPA).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).add(this.VKAPA).divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.KENNVMT = 2;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.LST3 = this.ST.multiply(Lohnsteuer2024.ZAHL100);
		this.MRE4ABZ();
		this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2024.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2024.ZAHL100));
		this.KENNVMT = 1;
		this.MLSTJAHR();
		this.LST2 = this.ST.multiply(Lohnsteuer2024.ZAHL100);
		this.STV = this.LST2.subtract(this.LST1);
		this.LST3 = this.LST3.subtract(this.LST1);
		if (this.LST3.compareTo(this.STV) == -1) this.STV = this.LST3;
		if (this.STV.compareTo(BigDecimal.ZERO()) == -1) this.STV = BigDecimal.ZERO();
		else this.STV = this.STV.multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2024.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2024.ZAHL100);
		this.SOLZVBMG = this.STV.divide(Lohnsteuer2024.ZAHL100, 0, BigDecimal.ROUND_DOWN).add(this.JBMG);
		if (this.SOLZVBMG.compareTo(this.SOLZFREI) == 1) this.SOLZV = this.STV.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2024.ZAHL100, 0, BigDecimal.ROUND_DOWN);
		else this.SOLZV = BigDecimal.ZERO();
		if (this.R > 0) this.BKV = this.STV;
		else this.BKV = BigDecimal.ZERO();
	} else {
		this.STV = BigDecimal.ZERO();
		this.SOLZV = BigDecimal.ZERO();
		this.BKV = BigDecimal.ZERO();
	}
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 40
*/
Lohnsteuer2024.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2024.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2024.ZAHL100));
	this.MZTABFBN();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2024.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2024.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 41
*/
Lohnsteuer2024.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.add(this.MBV.divide(Lohnsteuer2024.ZAHL100)).subtract(this.JRE4ENT.divide(Lohnsteuer2024.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2024.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFBN();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2024.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG vor Gesetzesänderung, PAP Seite 42
*/
Lohnsteuer2024.prototype.UPTAB24A = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2024.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(17006)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2024.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(922.98));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(66761)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(17005)).divide(Lohnsteuer2024.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(181.19));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(1025.38)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(277826)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(10602.13)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(18936.88)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};
/**
* Tarifliche Einkommensteuer (§ 32a EStG) nach Gesetz zur steuerlichen Freistellung des
* Existenzminimums 2024, PAP Seite 43
*/
Lohnsteuer2024.prototype.UPTAB24N = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2024.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(17006)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2024.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(954.8));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(66761)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(17005)).divide(Lohnsteuer2024.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(181.19));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(991.21)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(277826)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(10636.31)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(18971.06)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/2025.ts
function Lohnsteuer2025(params = {}) {
	/**
	* 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
	*/
	this.af = 1;
	if (params["af"] !== void 0) this.setAf(params["af"]);
	/**
	* Auf die Vollendung des 64. Lebensjahres folgende
	* Kalenderjahr (erforderlich, wenn ALTER1=1)
	*/
	this.AJAHR = 0;
	if (params["AJAHR"] !== void 0) this.setAjahr(params["AJAHR"]);
	/**
	* 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
	* der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
	*/
	this.ALTER1 = 0;
	if (params["ALTER1"] !== void 0) this.setAlter1(params["ALTER1"]);
	/**
	* eingetragener Faktor mit drei Nachkommastellen
	*/
	this.f = 1;
	if (params["f"] !== void 0) this.setF(params["f"]);
	/**
	* Jahresfreibetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung
	* auf der Bescheinigung für den Lohnsteuerabzug 2025 in Cent (ggf. 0)
	*/
	this.JFREIB = new BigDecimal(0);
	if (params["JFREIB"] !== void 0) this.setJfreib(params["JFREIB"]);
	/**
	* Jahreshinzurechnungsbetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
	* sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
	* elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung auf der
	* Bescheinigung für den Lohnsteuerabzug 2025 in Cent (ggf. 0)
	*/
	this.JHINZU = new BigDecimal(0);
	if (params["JHINZU"] !== void 0) this.setJhinzu(params["JHINZU"]);
	/**
	* Voraussichtlicher Jahresarbeitslohn ohne sonstige Bezüge (d.h. auch ohne
	* die zu besteuernden Vorteile bei Vermögensbeteiligungen,
	* § 19a Absatz 4 EStG) in Cent.
	* Anmerkung: Die Eingabe dieses Feldes (ggf. 0) ist erforderlich bei Eingaben zu sonstigen
	* Bezügen (Feld SONSTB).
	* Sind in einem vorangegangenen Abrechnungszeitraum bereits sonstige Bezüge gezahlt worden,
	* so sind sie dem voraussichtlichen Jahresarbeitslohn hinzuzurechnen. Gleiches gilt für zu
	* besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG).
	*/
	this.JRE4 = new BigDecimal(0);
	if (params["JRE4"] !== void 0) this.setJre4(params["JRE4"]);
	/**
	* In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG und zu besteuernde
	* Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG in Cent
	*/
	this.JRE4ENT = BigDecimal.ZERO();
	if (params["JRE4ENT"] !== void 0) this.setJre4ent(params["JRE4ENT"]);
	/**
	* In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.JVBEZ = new BigDecimal(0);
	if (params["JVBEZ"] !== void 0) this.setJvbez(params["JVBEZ"]);
	/**
	* Merker für die Vorsorgepauschale
	* 0 = der Arbeitnehmer ist in der gesetzlichen Rentenversicherung oder einer
	* berufsständischen Versorgungseinrichtung pflichtversichert oder bei Befreiung von der
	* Versicherungspflicht freiwillig versichert; es gilt die allgemeine Beitragsbemessungsgrenze
	*
	* 1 = wenn nicht 0
	*
	*/
	this.KRV = 0;
	if (params["KRV"] !== void 0) this.setKrv(params["KRV"]);
	/**
	* Kassenindividueller Zusatzbeitragssatz bei einem gesetzlich krankenversicherten Arbeitnehmer
	* in Prozent (bspw. 2,50 für 2,50 %) mit 2 Dezimalstellen.
	* Es ist der volle Zusatzbeitragssatz anzugeben. Die Aufteilung in Arbeitnehmer- und Arbeitgeber-
	* anteil erfolgt im Programmablauf.
	*/
	this.KVZ = new BigDecimal(0);
	if (params["KVZ"] !== void 0) this.setKvz(params["KVZ"]);
	/**
	* Lohnzahlungszeitraum:
	* 1 = Jahr
	* 2 = Monat
	* 3 = Woche
	* 4 = Tag
	*/
	this.LZZ = 0;
	if (params["LZZ"] !== void 0) this.setLzz(params["LZZ"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2025 eingetragene Freibetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZFREIB = new BigDecimal(0);
	if (params["LZZFREIB"] !== void 0) this.setLzzfreib(params["LZZFREIB"]);
	/**
	* Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
	* oder in der Bescheinigung für den Lohnsteuerabzug 2025 eingetragene Hinzurechnungsbetrag für den
	* Lohnzahlungszeitraum in Cent
	*/
	this.LZZHINZU = new BigDecimal(0);
	if (params["LZZHINZU"] !== void 0) this.setLzzhinzu(params["LZZHINZU"]);
	/**
	* Nicht zu besteuernde Vorteile bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) in Cent
	*/
	this.MBV = new BigDecimal(0);
	if (params["MBV"] !== void 0) this.setMbv(params["MBV"]);
	/**
	* Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
	* Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
	* als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
	* als Monatsbetrag anzugeben).
	*/
	this.PKPV = new BigDecimal(0);
	if (params["PKPV"] !== void 0) this.setPkpv(params["PKPV"]);
	/**
	* Krankenversicherung:
	* 0 = gesetzlich krankenversicherte Arbeitnehmer
	* 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
	* 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
	*/
	this.PKV = 0;
	if (params["PKV"] !== void 0) this.setPkv(params["PKV"]);
	/**
	* Zahl der beim Arbeitnehmer zu berücksichtigenden Beitragsabschläge in der sozialen Pflegeversicherung
	* bei mehr als einem Kind
	* 0 = kein Abschlag
	* 1 = Beitragsabschlag für das 2. Kind
	* 2 = Beitragsabschläge für das 2. und 3. Kind
	* 3 = Beitragsabschläge für 2. bis 4. Kinder
	* 4 = Beitragsabschläge für 2. bis 5. oder mehr Kinder
	*/
	this.PVA = new BigDecimal(0);
	if (params["PVA"] !== void 0) this.setPva(params["PVA"]);
	/**
	* 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
	* zu berücksichtigen wären, sonst 0.
	*/
	this.PVS = 0;
	if (params["PVS"] !== void 0) this.setPvs(params["PVS"]);
	/**
	* 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
	* zu zahlen hat, sonst 0.
	*/
	this.PVZ = 0;
	if (params["PVZ"] !== void 0) this.setPvz(params["PVZ"]);
	/**
	* Religionsgemeinschaft des Arbeitnehmers lt. elektronischer Lohnsteuerabzugsmerkmale oder der
	* Bescheinigung für den Lohnsteuerabzug 2025 (bei keiner Religionszugehörigkeit = 0)
	*/
	this.R = 0;
	if (params["R"] !== void 0) this.setR(params["R"]);
	/**
	* Steuerpflichtiger Arbeitslohn für den Lohnzahlungszeitraum vor Berücksichtigung des
	* Versorgungsfreibetrags und des Zuschlags zum Versorgungsfreibetrag, des Altersentlastungsbetrags
	* und des als elektronisches Lohnsteuerabzugsmerkmal festgestellten oder in der Bescheinigung für
	* den Lohnsteuerabzug 2025 für den Lohnzahlungszeitraum eingetragenen Freibetrags bzw.
	* Hinzurechnungsbetrags in Cent
	*/
	this.RE4 = new BigDecimal(0);
	if (params["RE4"] !== void 0) this.setRe4(params["RE4"]);
	/**
	* Sonstige Bezüge einschließlich zu besteuernde Vorteile bei Vermögensbeteiligungen und Sterbegeld bei Versorgungsbezügen sowie
	* Kapitalauszahlungen/Abfindungen, in Cent (ggf. 0)
	*/
	this.SONSTB = new BigDecimal(0);
	if (params["SONSTB"] !== void 0) this.setSonstb(params["SONSTB"]);
	/**
	* In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG
	*/
	this.SONSTENT = BigDecimal.ZERO();
	if (params["SONSTENT"] !== void 0) this.setSonstent(params["SONSTENT"]);
	/**
	* Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
	* (in SONSTB enthalten) in Cent
	*/
	this.STERBE = new BigDecimal(0);
	if (params["STERBE"] !== void 0) this.setSterbe(params["STERBE"]);
	/**
	* Steuerklasse:
	* 1 = I
	* 2 = II
	* 3 = III
	* 4 = IV
	* 5 = V
	* 6 = VI
	*/
	this.STKL = 0;
	if (params["STKL"] !== void 0) this.setStkl(params["STKL"]);
	/**
	* In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
	*/
	this.VBEZ = new BigDecimal(0);
	if (params["VBEZ"] !== void 0) this.setVbez(params["VBEZ"]);
	/**
	* Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
	* in Cents
	*/
	this.VBEZM = new BigDecimal(0);
	if (params["VBEZM"] !== void 0) this.setVbezm(params["VBEZM"]);
	/**
	* Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
	* bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
	* bei Versorgungsbezuegen in Cents
	*/
	this.VBEZS = new BigDecimal(0);
	if (params["VBEZS"] !== void 0) this.setVbezs(params["VBEZS"]);
	/**
	* In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
	* in Cents (ggf. 0)
	*/
	this.VBS = new BigDecimal(0);
	if (params["VBS"] !== void 0) this.setVbs(params["VBS"]);
	/**
	* Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
	* mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
	*/
	this.VJAHR = 0;
	if (params["VJAHR"] !== void 0) this.setVjahr(params["VJAHR"]);
	/**
	* Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
	* I, II, III und IV)
	*/
	this.ZKF = new BigDecimal(0);
	if (params["ZKF"] !== void 0) this.setZkf(params["ZKF"]);
	/**
	* Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
	* erforderlich bei Jahresberechnung (LZZ = 1)
	*/
	this.ZMVB = 0;
	if (params["ZMVB"] !== void 0) this.setZmvb(params["ZMVB"]);
	/**
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
	*/
	this.BK = new BigDecimal(0);
	/**
	* Bemessungsgrundlage der sonstigen Bezüge  für die Kirchenlohnsteuer in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei
	* Vermögensbeteiligungen (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern BK
	* (maximal bis 0). Der Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen
	* im Rahmen der Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.BKS = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
	*/
	this.LSTLZZ = new BigDecimal(0);
	/**
	* Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
	* in Cents
	*/
	this.SOLZLZZ = new BigDecimal(0);
	/**
	* Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit in Cent.
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern SOLZLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.SOLZS = new BigDecimal(0);
	/**
	* Lohnsteuer für sonstige Bezüge in Cent
	* Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
	* (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern LSTLZZ (maximal bis 0). Der
	* Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
	* Veranlagung zur Einkommensteuer bleibt unberührt.
	*/
	this.STS = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
	* privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
	* die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
	* steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
	* steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
	* VKVSONST
	*/
	this.VKVLZZ = new BigDecimal(0);
	/**
	* Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
	* zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
	* auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
	* auch negativ sein.
	*/
	this.VKVSONST = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.VFRB = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.VFRBS1 = new BigDecimal(0);
	/**
	* Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
	*/
	this.VFRBS2 = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
	* dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
	*/
	this.WVFRB = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
	* bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
	*/
	this.WVFRBO = new BigDecimal(0);
	/**
	* Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
	* über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
	*/
	this.WVFRBM = new BigDecimal(0);
	/**
	* Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
	* Cent (2 Dezimalstellen)
	*/
	this.ALTE = new BigDecimal(0);
	/**
	* Arbeitnehmer-Pauschbetrag in EURO
	*/
	this.ANP = new BigDecimal(0);
	/**
	* Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
	* auf ganze Cents abgerundet
	*/
	this.ANTEIL1 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
	* (2 Dezimalstellen)
	*/
	this.BMG = new BigDecimal(0);
	/**
	* Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
	* und der sozialen Pflegeversicherung in Euro
	*/
	this.BBGKVPV = new BigDecimal(0);
	/**
	* allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
	*/
	this.BBGRV = new BigDecimal(0);
	/**
	* Differenz zwischen ST1 und ST2 in EURO
	*/
	this.DIFF = new BigDecimal(0);
	/**
	* Entlastungsbetrag für Alleinerziehende in Euro
	*/
	this.EFA = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
	*/
	this.FVB = new BigDecimal(0);
	/**
	* Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
	* der Lohnsteuer für den sonstigen Bezug
	*/
	this.FVBSO = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO
	*/
	this.FVBZ = new BigDecimal(0);
	/**
	* Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
	* der Lohnsteuer beim sonstigen Bezug
	*/
	this.FVBZSO = new BigDecimal(0);
	/**
	* Grundfreibetrag in Euro
	*/
	this.GFB = new BigDecimal(0);
	/**
	* Maximaler Altersentlastungsbetrag in €
	*/
	this.HBALTE = new BigDecimal(0);
	/**
	* Maßgeblicher maximaler Versorgungsfreibetrag in Euro, Cent (2 Dezimalstellen)
	*/
	this.HFVB = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
	* (2 Dezimalstellen)
	*/
	this.HFVBZ = new BigDecimal(0);
	/**
	* Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
	* (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
	* sonstigen Bezug
	*/
	this.HFVBZSO = new BigDecimal(0);
	/**
	* Zwischenfeld zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.HOCH = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Versorgungsparameter
	*/
	this.J = 0;
	/**
	* Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
	* Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
	*/
	this.JBMG = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLFREIB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
	* (2 Dezimalstellen)
	*/
	this.JLHINZU = new BigDecimal(0);
	/**
	* Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
	* UPANTEIL errechnet werden soll in Cents
	*/
	this.JW = new BigDecimal(0);
	/**
	* Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
	*/
	this.K = 0;
	/**
	* Summe der Freibetraege fuer Kinder in EURO
	*/
	this.KFB = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Krankenversicherung
	*/
	this.KVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Krankenversicherung
	*/
	this.KVSATZAN = new BigDecimal(0);
	/**
	* Kennzahl fuer die Einkommensteuer-Tabellenart:
	* 1 = Grundtabelle
	* 2 = Splittingtabelle
	*/
	this.KZTAB = 0;
	/**
	* Jahreslohnsteuer in EURO
	*/
	this.LSTJAHR = new BigDecimal(0);
	/**
	* Zwischenfelder der Jahreslohnsteuer in Cent
	*/
	this.LSTOSO = new BigDecimal(0);
	this.LSTSO = new BigDecimal(0);
	/**
	* Mindeststeuer fuer die Steuerklassen V und VI in EURO
	*/
	this.MIST = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitgebers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAG = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers zur Pflegeversicherung (6 Dezimalstellen)
	*/
	this.PVSATZAN = new BigDecimal(0);
	/**
	* Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
	*/
	this.RVSATZAN = new BigDecimal(0);
	/**
	* Rechenwert in Gleitkommadarstellung
	*/
	this.RW = new BigDecimal(0);
	/**
	* Sonderausgaben-Pauschbetrag in EURO
	*/
	this.SAP = new BigDecimal(0);
	/**
	* Freigrenze fuer den Solidaritaetszuschlag in EURO
	*/
	this.SOLZFREI = new BigDecimal(0);
	/**
	* Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZJ = new BigDecimal(0);
	/**
	* Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
	* in EURO, C (2 Dezimalstellen)
	*/
	this.SOLZMIN = new BigDecimal(0);
	/**
	* Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge in Euro
	*/
	this.SOLZSBMG = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge in Euro, Cent (2 Dezimalstellen)
	*/
	this.SOLZSZVE = new BigDecimal(0);
	/**
	* Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
	*/
	this.SOLZVBMG = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer in EURO
	*/
	this.ST = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
	*/
	this.ST1 = new BigDecimal(0);
	/**
	* Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
	*/
	this.ST2 = new BigDecimal(0);
	/**
	* Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
	*/
	this.VBEZB = new BigDecimal(0);
	/**
	* Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
	* den sonstigen Bezug
	*/
	this.VBEZBSO = new BigDecimal(0);
	/**
	* Zwischenfeld zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.VERGL = new BigDecimal(0);
	/**
	* Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VHB = new BigDecimal(0);
	/**
	* Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
	* privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
	*/
	this.VKV = new BigDecimal(0);
	/**
	* Vorsorgepauschale in EURO, C (2 Dezimalstellen)
	*/
	this.VSP = new BigDecimal(0);
	/**
	* Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
	*/
	this.VSPN = new BigDecimal(0);
	/**
	* Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP1 = new BigDecimal(0);
	/**
	* Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
	* dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
	*/
	this.VSP2 = new BigDecimal(0);
	/**
	* Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
	* soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
	* private Basiskrankenversicherung und private Pflege-Pflichtversicherung
	* in Euro, Cent (2 Dezimalstellen)
	*/
	this.VSP3 = new BigDecimal(0);
	/**
	* Erster Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W1STKL5 = new BigDecimal(0);
	/**
	* Zweiter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W2STKL5 = new BigDecimal(0);
	/**
	* Dritter Grenzwert in Steuerklasse V/VI in Euro
	*/
	this.W3STKL5 = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
	* (2 Dezimalstellen)
	*/
	this.X = new BigDecimal(0);
	/**
	* Gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
	*/
	this.Y = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
	*/
	this.ZRE4 = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	*/
	this.ZRE4J = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
	* nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
	* zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
	*/
	this.ZRE4VP = new BigDecimal(0);
	/**
	* Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
	* (2 Dezimalstellen)
	*/
	this.ZTABFB = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
	* EURO, C (2 Dezimalstellen)
	*/
	this.ZVBEZ = new BigDecimal(0);
	/**
	* Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
	*/
	this.ZVBEZJ = new BigDecimal(0);
	/**
	* Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
	*/
	this.ZVE = new BigDecimal(0);
	/**
	* Zwischenfeld zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZX = new BigDecimal(0);
	/**
	* Zwischenfeld zu X fuer die Berechnung der Steuer nach § 39b
	* Abs. 2 Satz 7 EStG in €
	*/
	this.ZZX = new BigDecimal(0);
}
/**
* geändert für 2025
*/
Object.defineProperty(Lohnsteuer2025, "TAB1", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.14),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.132),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.124),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.116),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.108),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.1),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.092),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.084),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.076),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.068),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.06),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.052),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.044),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.036),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.028),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.02),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.012),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(.004),
	BigDecimal.valueOf(0)
] });
/**
* geändert für 2025
*/
Object.defineProperty(Lohnsteuer2025, "TAB2", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(3e3),
	BigDecimal.valueOf(2880),
	BigDecimal.valueOf(2760),
	BigDecimal.valueOf(2640),
	BigDecimal.valueOf(2520),
	BigDecimal.valueOf(2400),
	BigDecimal.valueOf(2280),
	BigDecimal.valueOf(2160),
	BigDecimal.valueOf(2040),
	BigDecimal.valueOf(1920),
	BigDecimal.valueOf(1800),
	BigDecimal.valueOf(1680),
	BigDecimal.valueOf(1560),
	BigDecimal.valueOf(1440),
	BigDecimal.valueOf(1320),
	BigDecimal.valueOf(1200),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1080),
	BigDecimal.valueOf(1050),
	BigDecimal.valueOf(1020),
	BigDecimal.valueOf(990),
	BigDecimal.valueOf(960),
	BigDecimal.valueOf(930),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(870),
	BigDecimal.valueOf(840),
	BigDecimal.valueOf(810),
	BigDecimal.valueOf(780),
	BigDecimal.valueOf(750),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(690),
	BigDecimal.valueOf(660),
	BigDecimal.valueOf(630),
	BigDecimal.valueOf(600),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(510),
	BigDecimal.valueOf(480),
	BigDecimal.valueOf(450),
	BigDecimal.valueOf(420),
	BigDecimal.valueOf(390),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(330),
	BigDecimal.valueOf(300),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(240),
	BigDecimal.valueOf(210),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(150),
	BigDecimal.valueOf(120),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(60),
	BigDecimal.valueOf(30),
	BigDecimal.valueOf(0)
] });
/**
* geändert für 2025
*/
Object.defineProperty(Lohnsteuer2025, "TAB3", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(900),
	BigDecimal.valueOf(864),
	BigDecimal.valueOf(828),
	BigDecimal.valueOf(792),
	BigDecimal.valueOf(756),
	BigDecimal.valueOf(720),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(648),
	BigDecimal.valueOf(612),
	BigDecimal.valueOf(576),
	BigDecimal.valueOf(540),
	BigDecimal.valueOf(504),
	BigDecimal.valueOf(468),
	BigDecimal.valueOf(432),
	BigDecimal.valueOf(396),
	BigDecimal.valueOf(360),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(324),
	BigDecimal.valueOf(315),
	BigDecimal.valueOf(306),
	BigDecimal.valueOf(297),
	BigDecimal.valueOf(288),
	BigDecimal.valueOf(279),
	BigDecimal.valueOf(270),
	BigDecimal.valueOf(261),
	BigDecimal.valueOf(252),
	BigDecimal.valueOf(243),
	BigDecimal.valueOf(234),
	BigDecimal.valueOf(225),
	BigDecimal.valueOf(216),
	BigDecimal.valueOf(207),
	BigDecimal.valueOf(198),
	BigDecimal.valueOf(189),
	BigDecimal.valueOf(180),
	BigDecimal.valueOf(171),
	BigDecimal.valueOf(162),
	BigDecimal.valueOf(153),
	BigDecimal.valueOf(144),
	BigDecimal.valueOf(135),
	BigDecimal.valueOf(126),
	BigDecimal.valueOf(117),
	BigDecimal.valueOf(108),
	BigDecimal.valueOf(99),
	BigDecimal.valueOf(90),
	BigDecimal.valueOf(81),
	BigDecimal.valueOf(72),
	BigDecimal.valueOf(63),
	BigDecimal.valueOf(54),
	BigDecimal.valueOf(45),
	BigDecimal.valueOf(36),
	BigDecimal.valueOf(27),
	BigDecimal.valueOf(18),
	BigDecimal.valueOf(9),
	BigDecimal.valueOf(0)
] });
/**
* geändert für 2025
*/
Object.defineProperty(Lohnsteuer2025, "TAB4", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(.4),
	BigDecimal.valueOf(.384),
	BigDecimal.valueOf(.368),
	BigDecimal.valueOf(.352),
	BigDecimal.valueOf(.336),
	BigDecimal.valueOf(.32),
	BigDecimal.valueOf(.304),
	BigDecimal.valueOf(.288),
	BigDecimal.valueOf(.272),
	BigDecimal.valueOf(.256),
	BigDecimal.valueOf(.24),
	BigDecimal.valueOf(.224),
	BigDecimal.valueOf(.208),
	BigDecimal.valueOf(.192),
	BigDecimal.valueOf(.176),
	BigDecimal.valueOf(.16),
	BigDecimal.valueOf(.152),
	BigDecimal.valueOf(.144),
	BigDecimal.valueOf(.14),
	BigDecimal.valueOf(.136),
	BigDecimal.valueOf(.132),
	BigDecimal.valueOf(.128),
	BigDecimal.valueOf(.124),
	BigDecimal.valueOf(.12),
	BigDecimal.valueOf(.116),
	BigDecimal.valueOf(.112),
	BigDecimal.valueOf(.108),
	BigDecimal.valueOf(.104),
	BigDecimal.valueOf(.1),
	BigDecimal.valueOf(.096),
	BigDecimal.valueOf(.092),
	BigDecimal.valueOf(.088),
	BigDecimal.valueOf(.084),
	BigDecimal.valueOf(.08),
	BigDecimal.valueOf(.076),
	BigDecimal.valueOf(.072),
	BigDecimal.valueOf(.068),
	BigDecimal.valueOf(.064),
	BigDecimal.valueOf(.06),
	BigDecimal.valueOf(.056),
	BigDecimal.valueOf(.052),
	BigDecimal.valueOf(.048),
	BigDecimal.valueOf(.044),
	BigDecimal.valueOf(.04),
	BigDecimal.valueOf(.036),
	BigDecimal.valueOf(.032),
	BigDecimal.valueOf(.028),
	BigDecimal.valueOf(.024),
	BigDecimal.valueOf(.02),
	BigDecimal.valueOf(.016),
	BigDecimal.valueOf(.012),
	BigDecimal.valueOf(.008),
	BigDecimal.valueOf(.004),
	BigDecimal.valueOf(0)
] });
/**
* geändert für 2025
*/
Object.defineProperty(Lohnsteuer2025, "TAB5", { value: [
	BigDecimal.valueOf(0),
	BigDecimal.valueOf(1900),
	BigDecimal.valueOf(1824),
	BigDecimal.valueOf(1748),
	BigDecimal.valueOf(1672),
	BigDecimal.valueOf(1596),
	BigDecimal.valueOf(1520),
	BigDecimal.valueOf(1444),
	BigDecimal.valueOf(1368),
	BigDecimal.valueOf(1292),
	BigDecimal.valueOf(1216),
	BigDecimal.valueOf(1140),
	BigDecimal.valueOf(1064),
	BigDecimal.valueOf(988),
	BigDecimal.valueOf(912),
	BigDecimal.valueOf(836),
	BigDecimal.valueOf(760),
	BigDecimal.valueOf(722),
	BigDecimal.valueOf(684),
	BigDecimal.valueOf(665),
	BigDecimal.valueOf(646),
	BigDecimal.valueOf(627),
	BigDecimal.valueOf(608),
	BigDecimal.valueOf(589),
	BigDecimal.valueOf(570),
	BigDecimal.valueOf(551),
	BigDecimal.valueOf(532),
	BigDecimal.valueOf(513),
	BigDecimal.valueOf(494),
	BigDecimal.valueOf(475),
	BigDecimal.valueOf(456),
	BigDecimal.valueOf(437),
	BigDecimal.valueOf(418),
	BigDecimal.valueOf(399),
	BigDecimal.valueOf(380),
	BigDecimal.valueOf(361),
	BigDecimal.valueOf(342),
	BigDecimal.valueOf(323),
	BigDecimal.valueOf(304),
	BigDecimal.valueOf(285),
	BigDecimal.valueOf(266),
	BigDecimal.valueOf(247),
	BigDecimal.valueOf(228),
	BigDecimal.valueOf(209),
	BigDecimal.valueOf(190),
	BigDecimal.valueOf(171),
	BigDecimal.valueOf(152),
	BigDecimal.valueOf(133),
	BigDecimal.valueOf(114),
	BigDecimal.valueOf(95),
	BigDecimal.valueOf(76),
	BigDecimal.valueOf(57),
	BigDecimal.valueOf(38),
	BigDecimal.valueOf(19),
	BigDecimal.valueOf(0)
] });
/**
* Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
*/
Object.defineProperty(Lohnsteuer2025, "ZAHL1", { value: BigDecimal.ONE() });
Object.defineProperty(Lohnsteuer2025, "ZAHL2", { value: new BigDecimal(2) });
Object.defineProperty(Lohnsteuer2025, "ZAHL5", { value: new BigDecimal(5) });
Object.defineProperty(Lohnsteuer2025, "ZAHL7", { value: new BigDecimal(7) });
Object.defineProperty(Lohnsteuer2025, "ZAHL12", { value: new BigDecimal(12) });
Object.defineProperty(Lohnsteuer2025, "ZAHL100", { value: new BigDecimal(100) });
Object.defineProperty(Lohnsteuer2025, "ZAHL360", { value: new BigDecimal(360) });
Object.defineProperty(Lohnsteuer2025, "ZAHL500", { value: new BigDecimal(500) });
Object.defineProperty(Lohnsteuer2025, "ZAHL700", { value: new BigDecimal(700) });
Object.defineProperty(Lohnsteuer2025, "ZAHL1000", { value: new BigDecimal(1e3) });
Object.defineProperty(Lohnsteuer2025, "ZAHL10000", { value: new BigDecimal(1e4) });
Lohnsteuer2025.prototype.setAf = function(value) {
	this.af = value;
};
Lohnsteuer2025.prototype.setAjahr = function(value) {
	this.AJAHR = value;
};
Lohnsteuer2025.prototype.setAlter1 = function(value) {
	this.ALTER1 = value;
};
Lohnsteuer2025.prototype.setF = function(value) {
	this.f = value;
};
Lohnsteuer2025.prototype.setJfreib = function(value) {
	this.JFREIB = value;
};
Lohnsteuer2025.prototype.setJhinzu = function(value) {
	this.JHINZU = value;
};
Lohnsteuer2025.prototype.setJre4 = function(value) {
	this.JRE4 = value;
};
Lohnsteuer2025.prototype.setJre4ent = function(value) {
	this.JRE4ENT = value;
};
Lohnsteuer2025.prototype.setJvbez = function(value) {
	this.JVBEZ = value;
};
Lohnsteuer2025.prototype.setKrv = function(value) {
	this.KRV = value;
};
Lohnsteuer2025.prototype.setKvz = function(value) {
	this.KVZ = value;
};
Lohnsteuer2025.prototype.setLzz = function(value) {
	this.LZZ = value;
};
Lohnsteuer2025.prototype.setLzzfreib = function(value) {
	this.LZZFREIB = value;
};
Lohnsteuer2025.prototype.setLzzhinzu = function(value) {
	this.LZZHINZU = value;
};
Lohnsteuer2025.prototype.setMbv = function(value) {
	this.MBV = value;
};
Lohnsteuer2025.prototype.setPkpv = function(value) {
	this.PKPV = value;
};
Lohnsteuer2025.prototype.setPkv = function(value) {
	this.PKV = value;
};
Lohnsteuer2025.prototype.setPva = function(value) {
	this.PVA = value;
};
Lohnsteuer2025.prototype.setPvs = function(value) {
	this.PVS = value;
};
Lohnsteuer2025.prototype.setPvz = function(value) {
	this.PVZ = value;
};
Lohnsteuer2025.prototype.setR = function(value) {
	this.R = value;
};
Lohnsteuer2025.prototype.setRe4 = function(value) {
	this.RE4 = value;
};
Lohnsteuer2025.prototype.setSonstb = function(value) {
	this.SONSTB = value;
};
Lohnsteuer2025.prototype.setSonstent = function(value) {
	this.SONSTENT = value;
};
Lohnsteuer2025.prototype.setSterbe = function(value) {
	this.STERBE = value;
};
Lohnsteuer2025.prototype.setStkl = function(value) {
	this.STKL = value;
};
Lohnsteuer2025.prototype.setVbez = function(value) {
	this.VBEZ = value;
};
Lohnsteuer2025.prototype.setVbezm = function(value) {
	this.VBEZM = value;
};
Lohnsteuer2025.prototype.setVbezs = function(value) {
	this.VBEZS = value;
};
Lohnsteuer2025.prototype.setVbs = function(value) {
	this.VBS = value;
};
Lohnsteuer2025.prototype.setVjahr = function(value) {
	this.VJAHR = value;
};
Lohnsteuer2025.prototype.setZkf = function(value) {
	this.ZKF = value;
};
Lohnsteuer2025.prototype.setZmvb = function(value) {
	this.ZMVB = value;
};
Lohnsteuer2025.prototype.getBk = function() {
	return this.BK;
};
Lohnsteuer2025.prototype.getBks = function() {
	return this.BKS;
};
Lohnsteuer2025.prototype.getLstlzz = function() {
	return this.LSTLZZ;
};
Lohnsteuer2025.prototype.getSolzlzz = function() {
	return this.SOLZLZZ;
};
Lohnsteuer2025.prototype.getSolzs = function() {
	return this.SOLZS;
};
Lohnsteuer2025.prototype.getSts = function() {
	return this.STS;
};
Lohnsteuer2025.prototype.getVkvlzz = function() {
	return this.VKVLZZ;
};
Lohnsteuer2025.prototype.getVkvsonst = function() {
	return this.VKVSONST;
};
Lohnsteuer2025.prototype.getVfrb = function() {
	return this.VFRB;
};
Lohnsteuer2025.prototype.getVfrbs1 = function() {
	return this.VFRBS1;
};
Lohnsteuer2025.prototype.getVfrbs2 = function() {
	return this.VFRBS2;
};
Lohnsteuer2025.prototype.getWvfrb = function() {
	return this.WVFRB;
};
Lohnsteuer2025.prototype.getWvfrbo = function() {
	return this.WVFRBO;
};
Lohnsteuer2025.prototype.getWvfrbm = function() {
	return this.WVFRBM;
};
/**
* PROGRAMMABLAUFPLAN, PAP Seite 13
*/
Lohnsteuer2025.prototype.MAIN = function() {
	this.MPARA();
	this.MRE4JL();
	this.VBEZBSO = BigDecimal.ZERO();
	this.MRE4();
	this.MRE4ABZ();
	this.MBERECH();
	this.MSONST();
};
/**
* Zuweisung von Werten für bestimmte Sozialversicherungsparameter  PAP Seite 14
*/
Lohnsteuer2025.prototype.MPARA = function() {
	if (this.KRV < 1) {
		this.BBGRV = new BigDecimal(96600);
		this.RVSATZAN = BigDecimal.valueOf(.093);
	}
	this.BBGKVPV = new BigDecimal(66150);
	this.KVSATZAN = this.KVZ.divide(Lohnsteuer2025.ZAHL2).divide(Lohnsteuer2025.ZAHL100).add(BigDecimal.valueOf(.07));
	this.KVSATZAG = BigDecimal.valueOf(.0125).add(BigDecimal.valueOf(.07));
	if (this.PVS == 1) {
		this.PVSATZAN = BigDecimal.valueOf(.023);
		this.PVSATZAG = BigDecimal.valueOf(.013);
	} else {
		this.PVSATZAN = BigDecimal.valueOf(.018);
		this.PVSATZAG = BigDecimal.valueOf(.018);
	}
	if (this.PVZ == 1) this.PVSATZAN = this.PVSATZAN.add(BigDecimal.valueOf(.006));
	else this.PVSATZAN = this.PVSATZAN.subtract(this.PVA.multiply(BigDecimal.valueOf(.0025)));
	this.W1STKL5 = new BigDecimal(13432);
	this.W2STKL5 = new BigDecimal(33380);
	this.W3STKL5 = new BigDecimal(222260);
	this.GFB = new BigDecimal(12096);
	this.SOLZFREI = new BigDecimal(18130);
};
/**
* Ermittlung des Jahresarbeitslohns nach § 39 b Abs. 2 Satz 2 EStG, PAP Seite 15
*/
Lohnsteuer2025.prototype.MRE4JL = function() {
	if (this.LZZ == 1) {
		this.ZRE4J = this.RE4.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 2) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2025.ZAHL12).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2025.ZAHL12).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2025.ZAHL12).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2025.ZAHL12).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	} else if (this.LZZ == 3) {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL700, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL700, 2, BigDecimal.ROUND_DOWN);
	} else {
		this.ZRE4J = this.RE4.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.VBEZ.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLFREIB = this.LZZFREIB.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
		this.JLHINZU = this.LZZHINZU.multiply(Lohnsteuer2025.ZAHL360).divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	}
	if (this.af == 0) this.f = 1;
};
/**
* Freibeträge für Versorgungsbezüge, Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 16
*/
Lohnsteuer2025.prototype.MRE4 = function() {
	if (this.ZVBEZJ.compareTo(BigDecimal.ZERO()) == 0) {
		this.FVBZ = BigDecimal.ZERO();
		this.FVB = BigDecimal.ZERO();
		this.FVBZSO = BigDecimal.ZERO();
		this.FVBSO = BigDecimal.ZERO();
	} else {
		if (this.VJAHR < 2006) this.J = 1;
		else if (this.VJAHR < 2058) this.J = this.VJAHR - 2004;
		else this.J = 54;
		if (this.LZZ == 1) {
			this.VBEZB = this.VBEZM.multiply(BigDecimal.valueOf(this.ZMVB)).add(this.VBEZS);
			this.HFVB = Lohnsteuer2025.TAB2[this.J].divide(Lohnsteuer2025.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
			this.FVBZ = Lohnsteuer2025.TAB3[this.J].divide(Lohnsteuer2025.ZAHL12).multiply(BigDecimal.valueOf(this.ZMVB)).setScale(0, BigDecimal.ROUND_UP);
		} else {
			this.VBEZB = this.VBEZM.multiply(Lohnsteuer2025.ZAHL12).add(this.VBEZS).setScale(2, BigDecimal.ROUND_DOWN);
			this.HFVB = Lohnsteuer2025.TAB2[this.J];
			this.FVBZ = Lohnsteuer2025.TAB3[this.J];
		}
		this.FVB = this.VBEZB.multiply(Lohnsteuer2025.TAB1[this.J]).divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVB.compareTo(this.HFVB) == 1) this.FVB = this.HFVB;
		if (this.FVB.compareTo(this.ZVBEZJ) == 1) this.FVB = this.ZVBEZJ;
		this.FVBSO = this.FVB.add(this.VBEZBSO.multiply(Lohnsteuer2025.TAB1[this.J]).divide(Lohnsteuer2025.ZAHL100)).setScale(2, BigDecimal.ROUND_UP);
		if (this.FVBSO.compareTo(Lohnsteuer2025.TAB2[this.J]) == 1) this.FVBSO = Lohnsteuer2025.TAB2[this.J];
		this.HFVBZSO = this.VBEZB.add(this.VBEZBSO).divide(Lohnsteuer2025.ZAHL100).subtract(this.FVBSO).setScale(2, BigDecimal.ROUND_DOWN);
		this.FVBZSO = this.FVBZ.add(this.VBEZBSO.divide(Lohnsteuer2025.ZAHL100)).setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(this.HFVBZSO) == 1) this.FVBZSO = this.HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
		if (this.FVBZSO.compareTo(Lohnsteuer2025.TAB3[this.J]) == 1) this.FVBZSO = Lohnsteuer2025.TAB3[this.J];
		this.HFVBZ = this.VBEZB.divide(Lohnsteuer2025.ZAHL100).subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.FVBZ.compareTo(this.HFVBZ) == 1) this.FVBZ = this.HFVBZ.setScale(0, BigDecimal.ROUND_UP);
	}
	this.MRE4ALTE();
};
/**
* Altersentlastungsbetrag (§ 39b Abs. 2 Satz 3 EStG), PAP Seite 17
*/
Lohnsteuer2025.prototype.MRE4ALTE = function() {
	if (this.ALTER1 == 0) this.ALTE = BigDecimal.ZERO();
	else {
		if (this.AJAHR < 2006) this.K = 1;
		else if (this.AJAHR < 2058) this.K = this.AJAHR - 2004;
		else this.K = 54;
		this.BMG = this.ZRE4J.subtract(this.ZVBEZJ);
		this.ALTE = this.BMG.multiply(Lohnsteuer2025.TAB4[this.K]).setScale(0, BigDecimal.ROUND_UP);
		this.HBALTE = Lohnsteuer2025.TAB5[this.K];
		if (this.ALTE.compareTo(this.HBALTE) == 1) this.ALTE = this.HBALTE;
	}
};
/**
* Ermittlung des Jahresarbeitslohns nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4 EStG, PAP Seite 20
*/
Lohnsteuer2025.prototype.MRE4ABZ = function() {
	this.ZRE4 = this.ZRE4J.subtract(this.FVB).subtract(this.ALTE).subtract(this.JLFREIB).add(this.JLHINZU).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZRE4.compareTo(BigDecimal.ZERO()) == -1) this.ZRE4 = BigDecimal.ZERO();
	this.ZRE4VP = this.ZRE4J;
	this.ZVBEZ = this.ZVBEZJ.subtract(this.FVB).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == -1) this.ZVBEZ = BigDecimal.ZERO();
};
/**
* Berechnung fuer laufende Lohnzahlungszeitraueme Seite 21
*/
Lohnsteuer2025.prototype.MBERECH = function() {
	this.MZTABFB();
	this.VFRB = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2025.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRB = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2025.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.WVFRB.compareTo(BigDecimal.ZERO()) == -1) this.WVFRB = BigDecimal.valueOf(0);
	this.LSTJAHR = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	this.UPLSTLZZ();
	this.UPVKVLZZ();
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) {
		this.ZTABFB = this.ZTABFB.add(this.KFB);
		this.MRE4ABZ();
		this.MLSTJAHR();
		this.JBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	} else this.JBMG = this.LSTJAHR;
	this.MSOLZ();
};
/**
* Ermittlung der festen Tabellenfreibeträge (ohne Vorsorgepauschale), PAP Seite 22
*/
Lohnsteuer2025.prototype.MZTABFB = function() {
	this.ANP = BigDecimal.ZERO();
	if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) >= 0 && this.ZVBEZ.compareTo(this.FVBZ) == -1) this.FVBZ = BigDecimal.valueOf(this.ZVBEZ.longValue());
	if (this.STKL < 6) {
		if (this.ZVBEZ.compareTo(BigDecimal.ZERO()) == 1) if (this.ZVBEZ.subtract(this.FVBZ).compareTo(BigDecimal.valueOf(102)) == -1) this.ANP = this.ZVBEZ.subtract(this.FVBZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = BigDecimal.valueOf(102);
	} else {
		this.FVBZ = BigDecimal.valueOf(0);
		this.FVBZSO = BigDecimal.valueOf(0);
	}
	if (this.STKL < 6) {
		if (this.ZRE4.compareTo(this.ZVBEZ) == 1) if (this.ZRE4.subtract(this.ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) this.ANP = this.ANP.add(this.ZRE4).subtract(this.ZVBEZ).setScale(0, BigDecimal.ROUND_UP);
		else this.ANP = this.ANP.add(BigDecimal.valueOf(1230));
	}
	this.KZTAB = 1;
	if (this.STKL == 1) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 2) {
		this.EFA = BigDecimal.valueOf(4260);
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 3) {
		this.KZTAB = 2;
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(9540)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 4) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = this.ZKF.multiply(BigDecimal.valueOf(4770)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.STKL == 5) {
		this.SAP = BigDecimal.valueOf(36);
		this.KFB = BigDecimal.ZERO();
	} else this.KFB = BigDecimal.ZERO();
	this.ZTABFB = this.EFA.add(this.ANP).add(this.SAP).add(this.FVBZ).setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Ermittlung Jahreslohnsteuer, PAP Seite 23
*/
Lohnsteuer2025.prototype.MLSTJAHR = function() {
	this.UPEVP();
	this.ZVE = this.ZRE4.subtract(this.ZTABFB).subtract(this.VSP);
	this.UPMLST();
};
/**
* PAP Seite 24
*/
Lohnsteuer2025.prototype.UPVKVLZZ = function() {
	this.UPVKV();
	this.JW = this.VKV;
	this.UPANTEIL();
	this.VKVLZZ = this.ANTEIL1;
};
/**
* PAP Seite 24
*/
Lohnsteuer2025.prototype.UPVKV = function() {
	if (this.PKV > 0) if (this.VSP2.compareTo(this.VSP3) == 1) this.VKV = this.VSP2.multiply(Lohnsteuer2025.ZAHL100);
	else this.VKV = this.VSP3.multiply(Lohnsteuer2025.ZAHL100);
	else this.VKV = BigDecimal.ZERO();
};
/**
* PAP Seite 25
*/
Lohnsteuer2025.prototype.UPLSTLZZ = function() {
	this.JW = this.LSTJAHR.multiply(Lohnsteuer2025.ZAHL100);
	this.UPANTEIL();
	this.LSTLZZ = this.ANTEIL1;
};
/**
* Ermittlung der Jahreslohnsteuer aus dem Einkommensteuertarif. PAP Seite 26
*/
Lohnsteuer2025.prototype.UPMLST = function() {
	if (this.ZVE.compareTo(Lohnsteuer2025.ZAHL1) == -1) {
		this.ZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.ZVE.divide(BigDecimal.valueOf(this.KZTAB)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB24();
	else this.MST5_6();
};
/**
* Vorsorgepauschale (§ 39b Absatz 2 Satz 5 Nummer 3 und Absatz 4 EStG) PAP Seite 27
*/
Lohnsteuer2025.prototype.UPEVP = function() {
	if (this.KRV == 1) this.VSP1 = BigDecimal.ZERO();
	else {
		if (this.ZRE4VP.compareTo(this.BBGRV) == 1) this.ZRE4VP = this.BBGRV;
		this.VSP1 = this.ZRE4VP.multiply(this.RVSATZAN).setScale(2, BigDecimal.ROUND_DOWN);
	}
	this.VSP2 = this.ZRE4VP.multiply(BigDecimal.valueOf(.12)).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.STKL == 3) this.VHB = BigDecimal.valueOf(3e3);
	else this.VHB = BigDecimal.valueOf(1900);
	if (this.VSP2.compareTo(this.VHB) == 1) this.VSP2 = this.VHB;
	this.VSPN = this.VSP1.add(this.VSP2).setScale(0, BigDecimal.ROUND_UP);
	this.MVSP();
	if (this.VSPN.compareTo(this.VSP) == 1) this.VSP = this.VSPN.setScale(2, BigDecimal.ROUND_DOWN);
};
/**
* Vorsorgepauschale (§39b Abs. 2 Satz 5 Nr 3 EStG) Vergleichsberechnung fuer Guenstigerpruefung, PAP Seite 28
*/
Lohnsteuer2025.prototype.MVSP = function() {
	if (this.ZRE4VP.compareTo(this.BBGKVPV) == 1) this.ZRE4VP = this.BBGKVPV;
	if (this.PKV > 0) if (this.STKL == 6) this.VSP3 = BigDecimal.ZERO();
	else {
		this.VSP3 = this.PKPV.multiply(Lohnsteuer2025.ZAHL12).divide(Lohnsteuer2025.ZAHL100);
		if (this.PKV == 2) this.VSP3 = this.VSP3.subtract(this.ZRE4VP.multiply(this.KVSATZAG.add(this.PVSATZAG))).setScale(2, BigDecimal.ROUND_DOWN);
	}
	else this.VSP3 = this.ZRE4VP.multiply(this.KVSATZAN.add(this.PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
	this.VSP = this.VSP3.add(this.VSP1).setScale(0, BigDecimal.ROUND_UP);
};
/**
* Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 29
*/
Lohnsteuer2025.prototype.MST5_6 = function() {
	this.ZZX = this.X;
	if (this.ZZX.compareTo(this.W2STKL5) == 1) {
		this.ZX = this.W2STKL5;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W3STKL5) == 1) {
			this.ST = this.ST.add(this.W3STKL5.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			this.ST = this.ST.add(this.ZZX.subtract(this.W3STKL5).multiply(BigDecimal.valueOf(.45))).setScale(0, BigDecimal.ROUND_DOWN);
		} else this.ST = this.ST.add(this.ZZX.subtract(this.W2STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
	} else {
		this.ZX = this.ZZX;
		this.UP5_6();
		if (this.ZZX.compareTo(this.W1STKL5) == 1) {
			this.VERGL = this.ST;
			this.ZX = this.W1STKL5;
			this.UP5_6();
			this.HOCH = this.ST.add(this.ZZX.subtract(this.W1STKL5).multiply(BigDecimal.valueOf(.42))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.HOCH.compareTo(this.VERGL) == -1) this.ST = this.HOCH;
			else this.ST = this.VERGL;
		}
	}
};
/**
* Unterprogramm zur Lohnsteuer fuer die Steuerklassen V und VI (§ 39b Abs. 2 Satz 7 EStG), PAP Seite 30
*/
Lohnsteuer2025.prototype.UP5_6 = function() {
	this.X = this.ZX.multiply(BigDecimal.valueOf(1.25)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB24();
	this.ST1 = this.ST;
	this.X = this.ZX.multiply(BigDecimal.valueOf(.75)).setScale(2, BigDecimal.ROUND_DOWN);
	this.UPTAB24();
	this.ST2 = this.ST;
	this.DIFF = this.ST1.subtract(this.ST2).multiply(Lohnsteuer2025.ZAHL2);
	this.MIST = this.ZX.multiply(BigDecimal.valueOf(.14)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.MIST.compareTo(this.DIFF) == 1) this.ST = this.MIST;
	else this.ST = this.DIFF;
};
/**
* Solidaritaetszuschlag, PAP Seite 31
*/
Lohnsteuer2025.prototype.MSOLZ = function() {
	this.SOLZFREI = this.SOLZFREI.multiply(BigDecimal.valueOf(this.KZTAB));
	if (this.JBMG.compareTo(this.SOLZFREI) == 1) {
		this.SOLZJ = this.JBMG.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.SOLZMIN = this.JBMG.subtract(this.SOLZFREI).multiply(BigDecimal.valueOf(11.9)).divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.SOLZMIN.compareTo(this.SOLZJ) == -1) this.SOLZJ = this.SOLZMIN;
		this.JW = this.SOLZJ.multiply(Lohnsteuer2025.ZAHL100).setScale(0, BigDecimal.ROUND_DOWN);
		this.UPANTEIL();
		this.SOLZLZZ = this.ANTEIL1;
	} else this.SOLZLZZ = BigDecimal.ZERO();
	if (this.R > 0) {
		this.JW = this.JBMG.multiply(Lohnsteuer2025.ZAHL100);
		this.UPANTEIL();
		this.BK = this.ANTEIL1;
	} else this.BK = BigDecimal.ZERO();
};
/**
* Anteil von Jahresbetraegen fuer einen LZZ (§ 39b Abs. 2 Satz 9 EStG), PAP Seite 32
*/
Lohnsteuer2025.prototype.UPANTEIL = function() {
	if (this.LZZ == 1) this.ANTEIL1 = this.JW;
	else if (this.LZZ == 2) this.ANTEIL1 = this.JW.divide(Lohnsteuer2025.ZAHL12, 0, BigDecimal.ROUND_DOWN);
	else if (this.LZZ == 3) this.ANTEIL1 = this.JW.multiply(Lohnsteuer2025.ZAHL7).divide(Lohnsteuer2025.ZAHL360, 0, BigDecimal.ROUND_DOWN);
	else this.ANTEIL1 = this.JW.divide(Lohnsteuer2025.ZAHL360, 0, BigDecimal.ROUND_DOWN);
};
/**
* Berechnung sonstiger Bezuege nach § 39b Abs. 3 Saetze 1 bis 8 EStG), PAP Seite 33
*/
Lohnsteuer2025.prototype.MSONST = function() {
	this.LZZ = 1;
	if (this.ZMVB == 0) this.ZMVB = 12;
	if (this.SONSTB.compareTo(BigDecimal.ZERO()) == 0 && this.MBV.compareTo(BigDecimal.ZERO()) == 0) {
		this.VKVSONST = BigDecimal.ZERO();
		this.LSTSO = BigDecimal.ZERO();
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
		this.BKS = BigDecimal.ZERO();
	} else {
		this.MOSONST();
		this.UPVKV();
		this.VKVSONST = this.VKV;
		this.ZRE4J = this.JRE4.add(this.SONSTB).divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.ZVBEZJ = this.JVBEZ.add(this.VBS).divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		this.VBEZBSO = this.STERBE;
		this.MRE4SONST();
		this.MLSTJAHR();
		this.WVFRBM = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
		if (this.WVFRBM.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBM = BigDecimal.ZERO();
		this.UPVKV();
		this.VKVSONST = this.VKV.subtract(this.VKVSONST);
		this.LSTSO = this.ST.multiply(Lohnsteuer2025.ZAHL100);
		this.STS = this.LSTSO.subtract(this.LSTOSO).multiply(BigDecimal.valueOf(this.f)).divide(Lohnsteuer2025.ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(Lohnsteuer2025.ZAHL100);
		this.STSMIN();
	}
};
/**
* PAP Seite 34
*/
Lohnsteuer2025.prototype.STSMIN = function() {
	if (this.STS.compareTo(BigDecimal.ZERO()) == -1) {
		if (this.MBV.compareTo(BigDecimal.ZERO()) == 0) {} else {
			this.LSTLZZ = this.LSTLZZ.add(this.STS);
			if (this.LSTLZZ.compareTo(BigDecimal.ZERO()) == -1) this.LSTLZZ = BigDecimal.ZERO();
			this.SOLZLZZ = this.SOLZLZZ.add(this.STS.multiply(BigDecimal.valueOf(5.5).divide(Lohnsteuer2025.ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
			if (this.SOLZLZZ.compareTo(BigDecimal.ZERO()) == -1) this.SOLZLZZ = BigDecimal.ZERO();
			this.BK = this.BK.add(this.STS);
			if (this.BK.compareTo(BigDecimal.ZERO()) == -1) this.BK = BigDecimal.ZERO();
		}
		this.STS = BigDecimal.ZERO();
		this.SOLZS = BigDecimal.ZERO();
	} else this.MSOLZSTS();
	if (this.R > 0) this.BKS = this.STS;
	else this.BKS = BigDecimal.ZERO();
};
/**
* Berechnung des SolZ auf sonstige Bezüge, PAP Seite 35
*/
Lohnsteuer2025.prototype.MSOLZSTS = function() {
	if (this.ZKF.compareTo(BigDecimal.ZERO()) == 1) this.SOLZSZVE = this.ZVE.subtract(this.KFB);
	else this.SOLZSZVE = this.ZVE;
	if (this.SOLZSZVE.compareTo(BigDecimal.ONE()) == -1) {
		this.SOLZSZVE = BigDecimal.ZERO();
		this.X = BigDecimal.ZERO();
	} else this.X = this.SOLZSZVE.divide(BigDecimal.valueOf(this.KZTAB), 0, BigDecimal.ROUND_DOWN);
	if (this.STKL < 5) this.UPTAB24();
	else this.MST5_6();
	this.SOLZSBMG = this.ST.multiply(BigDecimal.valueOf(this.f)).setScale(0, BigDecimal.ROUND_DOWN);
	if (this.SOLZSBMG.compareTo(this.SOLZFREI) == 1) this.SOLZS = this.STS.multiply(BigDecimal.valueOf(5.5)).divide(Lohnsteuer2025.ZAHL100, 0, BigDecimal.ROUND_DOWN);
	else this.SOLZS = BigDecimal.ZERO();
};
/**
* Sonderberechnung ohne sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 36
*/
Lohnsteuer2025.prototype.MOSONST = function() {
	this.ZRE4J = this.JRE4.divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.ZVBEZJ = this.JVBEZ.divide(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.JLFREIB = this.JFREIB.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.JLHINZU = this.JHINZU.divide(Lohnsteuer2025.ZAHL100, 2, BigDecimal.ROUND_DOWN);
	this.MRE4();
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.subtract(this.JRE4ENT.divide(Lohnsteuer2025.ZAHL100));
	this.MZTABFB();
	this.VFRBS1 = this.ANP.add(this.FVB.add(this.FVBZ)).multiply(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	this.MLSTJAHR();
	this.WVFRBO = this.ZVE.subtract(this.GFB).multiply(Lohnsteuer2025.ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
	if (this.WVFRBO.compareTo(BigDecimal.ZERO()) == -1) this.WVFRBO = BigDecimal.ZERO();
	this.LSTOSO = this.ST.multiply(Lohnsteuer2025.ZAHL100);
};
/**
* Sonderberechnung mit sonstige Bezüge für Berechnung bei sonstigen Bezügen oder Vergütung für mehrjährige Tätigkeit, PAP Seite 37
*/
Lohnsteuer2025.prototype.MRE4SONST = function() {
	this.MRE4();
	this.FVB = this.FVBSO;
	this.MRE4ABZ();
	this.ZRE4VP = this.ZRE4VP.add(this.MBV.divide(Lohnsteuer2025.ZAHL100)).subtract(this.JRE4ENT.divide(Lohnsteuer2025.ZAHL100)).subtract(this.SONSTENT.divide(Lohnsteuer2025.ZAHL100));
	this.FVBZ = this.FVBZSO;
	this.MZTABFB();
	this.VFRBS2 = this.ANP.add(this.FVB).add(this.FVBZ).multiply(Lohnsteuer2025.ZAHL100).subtract(this.VFRBS1);
};
/**
* Tarifliche Einkommensteuer §32a EStG, PAP Seite 38
*/
Lohnsteuer2025.prototype.UPTAB24 = function() {
	if (this.X.compareTo(this.GFB.add(Lohnsteuer2025.ZAHL1)) == -1) this.ST = BigDecimal.ZERO();
	else if (this.X.compareTo(BigDecimal.valueOf(17006)) == -1) {
		this.Y = this.X.subtract(this.GFB).divide(Lohnsteuer2025.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(954.8));
		this.RW = this.RW.add(BigDecimal.valueOf(1400));
		this.ST = this.RW.multiply(this.Y).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(66761)) == -1) {
		this.Y = this.X.subtract(BigDecimal.valueOf(17005)).divide(Lohnsteuer2025.ZAHL10000, 6, BigDecimal.ROUND_DOWN);
		this.RW = this.Y.multiply(BigDecimal.valueOf(181.19));
		this.RW = this.RW.add(BigDecimal.valueOf(2397));
		this.RW = this.RW.multiply(this.Y);
		this.ST = this.RW.add(BigDecimal.valueOf(991.21)).setScale(0, BigDecimal.ROUND_DOWN);
	} else if (this.X.compareTo(BigDecimal.valueOf(277826)) == -1) this.ST = this.X.multiply(BigDecimal.valueOf(.42)).subtract(BigDecimal.valueOf(10636.31)).setScale(0, BigDecimal.ROUND_DOWN);
	else this.ST = this.X.multiply(BigDecimal.valueOf(.45)).subtract(BigDecimal.valueOf(18971.06)).setScale(0, BigDecimal.ROUND_DOWN);
	this.ST = this.ST.multiply(BigDecimal.valueOf(this.KZTAB));
};

//#endregion
//#region src/utils/Lohnsteuer/index.ts
const INCOME_TAX_CLASSES = {
	2019: Lohnsteuer2019,
	2020: Lohnsteuer2020,
	2021: Lohnsteuer2021,
	2022: Lohnsteuer2022,
	2023: Lohnsteuer2023,
	2024: Lohnsteuer2024,
	2025: Lohnsteuer2025
};

//#endregion
//#region src/calculators/gross-to-net.ts
const schema$1 = z.object({
	output: z.literal("grossToNetCalc").optional(),
	inputAccountingYear: z.enum([
		"2019",
		"2020",
		"2021",
		"2022",
		"2023",
		"2024",
		"2025"
	]).transform(Number),
	inputTaxClass: z.coerce.number(),
	inputTaxAllowance: z.coerce.number(),
	inputChurchTax: z.coerce.number(),
	inputState: z.string(),
	inputYearOfBirth: z.coerce.number(),
	inputChildren: z.coerce.number().default(0),
	inputChildTaxAllowance: z.coerce.number(),
	inputPkvContribution: z.coerce.number(),
	inputEmployerSubsidy: z.coerce.number(),
	inputPensionInsurance: z.coerce.number(),
	inputLevyOne: z.coerce.number(),
	inputLevyTwo: z.coerce.number(),
	inputActivateLevy: z.coerce.number(),
	inputHealthInsurance: z.coerce.number(),
	inputAdditionalContribution: z.coerce.number(),
	inputGrossWage: z.coerce.number().min(-(10 ** 9)).max(10 ** 9),
	inputPeriod: z.coerce.number()
});
const grossToNet = defineCalculator({
	schema: schema$1,
	calculate: calculate$1
});
function calculate$1({ inputAccountingYear, inputTaxClass, inputTaxAllowance, inputChurchTax, inputState, inputYearOfBirth, inputChildren, inputChildTaxAllowance, inputPkvContribution, inputEmployerSubsidy, inputPensionInsurance, inputLevyOne, inputLevyTwo, inputActivateLevy, inputHealthInsurance, inputAdditionalContribution, inputGrossWage, inputPeriod }) {
	const { PENSION_LIMIT_WEST, PENSION_LIMIT_EAST } = PENSION_VALUES;
	const ZERO = new BigDecimal(0);
	const ZAHL2 = new BigDecimal(2);
	const ZAHL12 = new BigDecimal(12);
	const ZAHL100 = new BigDecimal(100);
	const ZAHL450 = new BigDecimal(450);
	const ZAHL54450 = BigDecimal.valueOf(54450);
	const ZAHL56250 = BigDecimal.valueOf(56250);
	const ZAHL58050 = BigDecimal.valueOf(58050);
	const ZAHL59850 = BigDecimal.valueOf(59850);
	const ZAHL62100 = BigDecimal.valueOf(62100);
	const ZAHL66150 = BigDecimal.valueOf(66150);
	const SOCIAL_THRESHOLDS = {
		2019: ZAHL54450,
		2020: ZAHL56250,
		2021: ZAHL58050,
		2022: ZAHL58050,
		2023: ZAHL59850,
		2024: ZAHL62100,
		2025: ZAHL66150
	};
	const GROSS_WAGE = inputPeriod === 1 ? new BigDecimal(inputGrossWage) : new BigDecimal(inputGrossWage).multiply(ZAHL12);
	const STATE_IS_OST = isNewFederalState(inputState);
	const SOCIAL_INSURANCE_THRESHOLD_KEY = Object.keys(SOCIAL_THRESHOLDS).find((key) => key === inputAccountingYear.toString()) ?? Object.keys(SOCIAL_THRESHOLDS).at(-1);
	const HI_INCOME_THRESHOLD = SOCIAL_THRESHOLDS[SOCIAL_INSURANCE_THRESHOLD_KEY];
	let inputContributionRate = ZERO;
	if (inputHealthInsurance === 0) inputContributionRate = new BigDecimal(14.6);
	else if (inputHealthInsurance === -1) {
		inputContributionRate = new BigDecimal(14);
		inputAdditionalContribution = 0;
		inputHealthInsurance = 0;
	} else if (inputHealthInsurance === 1) inputAdditionalContribution = 0;
	const HI_TOTAL_PERCENTAGE = inputContributionRate.add(new BigDecimal(inputAdditionalContribution));
	const HI_GROSS_WAGE_THRESHOLD = GROSS_WAGE.comparedTo(HI_INCOME_THRESHOLD) === 1 ? HI_INCOME_THRESHOLD : GROSS_WAGE;
	const HI_ADDITIONAL_CONTRIBUTION_PROPOTION = new BigDecimal(inputAdditionalContribution).divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN);
	const HI_CONTRIBUTION_PROPOTION = inputContributionRate.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN);
	const HI_CONTRIBUTION_AMOUNT_PROPOTION = HI_ADDITIONAL_CONTRIBUTION_PROPOTION.add(HI_CONTRIBUTION_PROPOTION).divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).multiply(HI_GROSS_WAGE_THRESHOLD);
	let healthInsurance = ZERO;
	let noCareInsurance = false;
	let privateHealthInsurance = ZERO;
	if (inputHealthInsurance === 0) healthInsurance = HI_CONTRIBUTION_AMOUNT_PROPOTION;
	else if (inputHealthInsurance === 1) {
		inputAdditionalContribution = 0;
		noCareInsurance = true;
		healthInsurance = new BigDecimal(inputPkvContribution).multiply(ZAHL12);
		if (inputEmployerSubsidy === 1) {
			let maxEmployerGrant = inputAccountingYear === 2019 ? new BigDecimal(351.66) : new BigDecimal(367.97);
			maxEmployerGrant = maxEmployerGrant.multiply(ZAHL12);
			healthInsurance = healthInsurance.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN);
			if (healthInsurance.comparedTo(maxEmployerGrant) === 1) {
				privateHealthInsurance = maxEmployerGrant;
				healthInsurance = healthInsurance.add(healthInsurance.subtract(maxEmployerGrant));
			} else privateHealthInsurance = healthInsurance;
		}
	}
	if (GROSS_WAGE.comparedTo(ZAHL450.multiply(ZAHL12)) < 1) healthInsurance = ZERO;
	const CI_INCOME_THRESHOLD = SOCIAL_THRESHOLDS[SOCIAL_INSURANCE_THRESHOLD_KEY];
	const CI_GROSS_WAGE_THRESHOLD = GROSS_WAGE.comparedTo(CI_INCOME_THRESHOLD) === 1 ? CI_INCOME_THRESHOLD : GROSS_WAGE;
	const LOCAL_CI_CONTRIBUTION_RATES = inputState === "Sachsen" ? CARE_INSURANCE_CONTRIBUTION_RATES_SAXONY : CARE_INSURANCE_CONTRIBUTION_RATES;
	const CI_CONTRIBUTION_RATE = LOCAL_CI_CONTRIBUTION_RATES[inputChildren];
	let CI_CONTRIBUTION_TOTAL = new BigDecimal(CI_CONTRIBUTION_RATE.AN + CI_CONTRIBUTION_RATE.AG);
	let ciContribution = new BigDecimal(CI_CONTRIBUTION_RATE.AN);
	const hasExtraCiContribution = inputAccountingYear - inputYearOfBirth > 23 && inputChildren === 0;
	if (hasExtraCiContribution) ciContribution = ciContribution.add(new BigDecimal(.6));
	let careInsurance = ciContribution.divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).multiply(CI_GROSS_WAGE_THRESHOLD);
	if (GROSS_WAGE.comparedTo(ZAHL450.multiply(ZAHL12)) < 1) careInsurance = ZERO;
	if (noCareInsurance) {
		CI_CONTRIBUTION_TOTAL = ZERO;
		careInsurance = ZERO;
	}
	let piIncomeThreshold = ZERO;
	if (inputPensionInsurance === 0) if (STATE_IS_OST) piIncomeThreshold = BigDecimal.valueOf(PENSION_LIMIT_EAST);
	else piIncomeThreshold = BigDecimal.valueOf(PENSION_LIMIT_WEST);
	else if (inputPensionInsurance === 1) piIncomeThreshold = ZERO;
	const PI_PERCENTAGE = new BigDecimal(18.6);
	const PI_GROSS_WAGE_THRESHOLD = GROSS_WAGE.comparedTo(piIncomeThreshold) === 1 ? piIncomeThreshold : GROSS_WAGE;
	const PI_CONTRIBUTION_PROPOTION = PI_PERCENTAGE.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN);
	const pensionInsurance = PI_CONTRIBUTION_PROPOTION.divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).multiply(PI_GROSS_WAGE_THRESHOLD);
	let uiIncomeThreshold;
	if (STATE_IS_OST) uiIncomeThreshold = BigDecimal.valueOf(PENSION_LIMIT_EAST);
	else uiIncomeThreshold = BigDecimal.valueOf(PENSION_LIMIT_WEST);
	const UI_PERCENTAGE = new BigDecimal(2.6);
	const UI_GROSS_WAGE_THRESHOLD = GROSS_WAGE.comparedTo(piIncomeThreshold) === 1 ? uiIncomeThreshold : GROSS_WAGE;
	const UI_CONTRIBUTION_PROPOTION = UI_PERCENTAGE.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN);
	let unemploymentInsurance = UI_CONTRIBUTION_PROPOTION.divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).multiply(UI_GROSS_WAGE_THRESHOLD);
	if (GROSS_WAGE.comparedTo(ZAHL450.multiply(ZAHL12)) < 1) unemploymentInsurance = ZERO;
	const WageTaxClass = INCOME_TAX_CLASSES[inputAccountingYear];
	const lst = new WageTaxClass();
	let grossWage = new BigDecimal(inputGrossWage);
	if (inputPeriod === 1) {
		inputPeriod = 2;
		grossWage = grossWage.divide(WageTaxClass.ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN);
	} else if (inputPeriod === 0) inputPeriod = 2;
	lst.setAf(0);
	lst.setAlter1(0);
	if (inputTaxAllowance === 0) lst.setF(1);
	else lst.setLzzfreib(new BigDecimal(inputTaxAllowance).divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).multiply(ZAHL100));
	lst.setKrv(inputPensionInsurance);
	lst.setKvz(new BigDecimal(inputAdditionalContribution));
	lst.setLzz(inputPeriod);
	lst.setLzzhinzu(ZERO);
	lst.setPkv(inputHealthInsurance);
	lst.setPvs(inputState === "Sachsen" ? 1 : 0);
	lst.setR(inputChurchTax);
	lst.setRe4(grossWage.multiply(WageTaxClass.ZAHL100));
	lst.setStkl(inputTaxClass);
	if (hasExtraCiContribution) lst.setPvz(1);
	else lst.setPvz(0);
	if (inputChildTaxAllowance > 0) lst.setZkf(new BigDecimal(inputChildTaxAllowance));
	if (lst.setPva) lst.setPva(new BigDecimal(0));
	lst.MAIN();
	let churchTaxRate = new BigDecimal(9);
	if (inputState === "Baden-Wuerttemberg" || inputState === "Bayern") churchTaxRate = new BigDecimal(8);
	const incomeTax = lst.getLstlzz().add((inputAccountingYear >= 2025 ? BigDecimal.ZERO() : lst.getStv()).add(lst.getSts())).divide(WageTaxClass.ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const solidaritySurcharge = lst.getSolzlzz().add(lst.getSolzs().add(inputAccountingYear >= 2025 ? BigDecimal.ZERO() : lst.getSolzv())).divide(WageTaxClass.ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const churchTax = lst.getBk().add(lst.getBks().add(inputAccountingYear >= 2025 ? BigDecimal.ZERO() : lst.getBkv())).divide(WageTaxClass.ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).multiply(churchTaxRate).divide(WageTaxClass.ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const insuranceComplete = healthInsurance.add(careInsurance).add(pensionInsurance).add(unemploymentInsurance).divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN);
	const totalTaxes = incomeTax.add(solidaritySurcharge).add(churchTax);
	const complete = grossWage.subtract(totalTaxes).subtract(insuranceComplete);
	const healthInsurancePercentage = HI_TOTAL_PERCENTAGE.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN).toNumber();
	const unemploymentInsurancePercentage = UI_PERCENTAGE.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN).toNumber();
	const pensionInsurancePercentage = PI_PERCENTAGE.divide(ZAHL2, 50, BigDecimal.ROUND_HALF_DOWN).toNumber();
	let employerCareInsurancePercentage = CI_CONTRIBUTION_RATE.AG;
	let employeeCareInsurancePercentage = ciContribution.toNumber();
	if (noCareInsurance) employerCareInsurancePercentage = employeeCareInsurancePercentage = CI_CONTRIBUTION_TOTAL.toNumber() / 2;
	let employerCareInsuranceMonth = careInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN);
	let employerCareInsuranceYear = careInsurance;
	if (employeeCareInsurancePercentage !== employerCareInsurancePercentage) {
		employerCareInsuranceMonth = employerCareInsuranceMonth.divide(new BigDecimal(employeeCareInsurancePercentage), 50, BigDecimal.ROUND_HALF_DOWN).multiply(new BigDecimal(employerCareInsurancePercentage));
		employerCareInsuranceYear = employerCareInsuranceMonth.multiply(ZAHL12);
	}
	let employerHealthInsuranceMonth = healthInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN);
	let employerHealthInsuranceYear = healthInsurance;
	if (inputHealthInsurance === 1) {
		employerHealthInsuranceMonth = inputEmployerSubsidy === 1 ? privateHealthInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN) : ZERO;
		employerHealthInsuranceYear = inputEmployerSubsidy === 1 ? privateHealthInsurance : ZERO;
	}
	const employerTotalInsurances = employerHealthInsuranceMonth.add(employerCareInsuranceMonth).add(pensionInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN)).add(unemploymentInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN));
	const employerTotalInsurancesYear = employerHealthInsuranceYear.add(employerCareInsuranceYear).add(pensionInsurance).add(unemploymentInsurance);
	const levyOne = GROSS_WAGE.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).multiply(new BigDecimal(inputLevyOne)).divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const levyTwo = GROSS_WAGE.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).multiply(new BigDecimal(inputLevyTwo)).divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const levyThree = GROSS_WAGE.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).multiply(new BigDecimal(.06)).divide(ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN);
	const levyTotal = levyOne.add(levyTwo).add(levyThree);
	const employerGrossWageMonth = GROSS_WAGE.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).add(employerTotalInsurances).add(inputActivateLevy === 1 ? levyTotal : ZERO);
	return {
		outputResGrossWageMonth: formatResultWithTwoOptionalDecimals(lst.RE4.divide(WageTaxClass.ZAHL100, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResGrossWageYear: formatResultWithTwoOptionalDecimals(lst.ZRE4J.toNumber()),
		outputResIncomeTaxMonth: formatResultWithTwoOptionalDecimals(incomeTax.toNumber()),
		outputResIncomeTaxYear: formatResultWithTwoOptionalDecimals(incomeTax.multiply(ZAHL12).toNumber()),
		outputResSolidaritySurchargeMonth: formatResultWithTwoOptionalDecimals(solidaritySurcharge.toNumber()),
		outputResSolidaritySurchargeYear: formatResultWithTwoOptionalDecimals(solidaritySurcharge.multiply(ZAHL12).toNumber()),
		outputResChurchTaxPercentage: ` (${churchTaxRate.toNumber()}% der Lohnsteuer)`,
		outputResChurchTaxMonth: formatResultWithTwoOptionalDecimals(churchTax.toNumber()),
		outputResChurchTaxYear: formatResultWithTwoOptionalDecimals(churchTax.multiply(ZAHL12).toNumber()),
		outputTotalTaxes: formatResultWithTwoOptionalDecimals(totalTaxes.toNumber()),
		outputTotalTaxesYear: formatResultWithTwoOptionalDecimals(totalTaxes.multiply(ZAHL12).toNumber()),
		outputResHealthInsurancePercentage: formatPercent(healthInsurancePercentage, 2),
		outputResHealthInsuranceMonth: formatResultWithTwoOptionalDecimals(healthInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResHealthInsuranceYear: formatResultWithTwoOptionalDecimals(healthInsurance.toNumber()),
		outputResPrivateHealthInsuranceEmployerMonth: formatResultWithTwoOptionalDecimals(privateHealthInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResPrivateHealthInsuranceEmployerYear: formatResultWithTwoOptionalDecimals(privateHealthInsurance.toNumber()),
		outputDisableResCareInsurance: noCareInsurance,
		outputResCareInsurancePercentage: formatPercent(employeeCareInsurancePercentage, 2),
		outputResCareInsuranceMonth: formatResultWithTwoOptionalDecimals(careInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResCareInsuranceYear: formatResultWithTwoOptionalDecimals(careInsurance.toNumber()),
		outputResPensionInsurancePercentage: formatPercent(pensionInsurancePercentage, 2),
		outputResPensionInsuranceMonth: formatResultWithTwoOptionalDecimals(pensionInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResPensionInsuranceYear: formatResultWithTwoOptionalDecimals(pensionInsurance.toNumber()),
		outputResUnemploymentInsurancePercentage: formatPercent(unemploymentInsurancePercentage, 2),
		outputResUnemploymentInsuranceMonth: formatResultWithTwoOptionalDecimals(unemploymentInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResUnemploymentInsuranceYear: formatResultWithTwoOptionalDecimals(unemploymentInsurance.toNumber()),
		outputTotalInsurances: formatResultWithTwoOptionalDecimals(insuranceComplete.toNumber()),
		outputTotalInsurancesYear: formatResultWithTwoOptionalDecimals(insuranceComplete.multiply(ZAHL12).toNumber()),
		outputResNetWageMonth: formatResultWithTwoOptionalDecimals(complete.toNumber()),
		outputResNetWageYear: formatResultWithTwoOptionalDecimals(complete.multiply(ZAHL12).toNumber()),
		outputResEmployerHealthInsuranceMonth: formatResultWithTwoOptionalDecimals(employerHealthInsuranceMonth.toNumber()),
		outputResEmployerHealthInsuranceYear: formatResultWithTwoOptionalDecimals(employerHealthInsuranceYear.toNumber()),
		outputResEmployerCareInsuranceMonth: formatResultWithTwoOptionalDecimals(employerCareInsuranceMonth.toNumber()),
		outputResEmployerCareInsuranceYear: formatResultWithTwoOptionalDecimals(employerCareInsuranceYear.toNumber()),
		outputResEmployerPensionInsuranceMonth: formatResultWithTwoOptionalDecimals(pensionInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResEmployerPensionInsuranceYear: formatResultWithTwoOptionalDecimals(pensionInsurance.toNumber()),
		outputResEmployerUnemploymentInsuranceMonth: formatResultWithTwoOptionalDecimals(unemploymentInsurance.divide(ZAHL12, 50, BigDecimal.ROUND_HALF_DOWN).toNumber()),
		outputResEmployerUnemploymentInsuranceYear: formatResultWithTwoOptionalDecimals(unemploymentInsurance.toNumber()),
		outputResEmployerHealthInsurancePercentage: formatPercent(healthInsurancePercentage, 2),
		outputResEmployerCareInsurancePercentage: formatPercent(employerCareInsurancePercentage, 2),
		outputResEmployerPensionInsurancePercentage: formatPercent(pensionInsurancePercentage, 2),
		outputResEmployerUnemploymentInsurancePercentage: formatPercent(unemploymentInsurancePercentage, 2),
		outputEmployerTotalInsurances: formatResultWithTwoOptionalDecimals(employerTotalInsurances.toNumber()),
		outputEmployerTotalInsurancesYear: formatResultWithTwoOptionalDecimals(employerTotalInsurancesYear.toNumber()),
		outputResEmployerLevyOneMonth: formatResultWithTwoOptionalDecimals(levyOne.toNumber()),
		outputResEmployerLevyOneYear: formatResultWithTwoOptionalDecimals(levyOne.multiply(ZAHL12).toNumber()),
		outputResEmployerLevyTwoMonth: formatResultWithTwoOptionalDecimals(levyTwo.toNumber()),
		outputResEmployerLevyTwoYear: formatResultWithTwoOptionalDecimals(levyTwo.multiply(ZAHL12).toNumber()),
		outputResEmployerLevyThreeMonth: formatResultWithTwoOptionalDecimals(levyThree.toNumber()),
		outputResEmployerLevyThreeYear: formatResultWithTwoOptionalDecimals(levyThree.multiply(ZAHL12).toNumber()),
		outputResEmployerLevyTotal: formatResultWithTwoOptionalDecimals(levyTotal.toNumber()),
		outputResEmployerLevyTotalYear: formatResultWithTwoOptionalDecimals(levyTotal.multiply(ZAHL12).toNumber()),
		outputResEmployerGrossWageMonth: formatResultWithTwoOptionalDecimals(employerGrossWageMonth.toNumber()),
		outputResEmployerGrossWageYear: formatResultWithTwoOptionalDecimals(employerGrossWageMonth.multiply(ZAHL12).toNumber())
	};
}
function isNewFederalState(state) {
	return [
		"Brandenburg",
		"Mecklenburg-Vorpommern",
		"Sachsen",
		"Sachsen-Anhalt",
		"Thueringen"
	].includes(state);
}

//#endregion
//#region src/constants/net-policy.ts
/**
* These values are added artificially to offset automatic deductions (such as lump sums and costs)
* made by the gross-net calculator, which are not relevant for our policy tax calculations.
* By adding them here, the calculator will subtract them again, resulting in the correct values for our use case.
* Values as of 2025.
*/
const CORRECTION_VALUES = {
	werbungskostenpauschale: 1230,
	beitragsbemessungsgrenze: 96600,
	arbeitslosenversicherung: .013
};

//#endregion
//#region src/calculators/net-policy.ts
const MAX_EURO = 1e4;
const MAX_PERCENT = 100;
const schema = z.object({
	savingRate: z.coerce.number().nonnegative().max(MAX_EURO).transform(toDinero),
	duration: z.coerce.number().positive().int().max(100).transform((years) => years * 12),
	taxAllowance: z.coerce.number().nonnegative().max(MAX_EURO).transform(toDinero),
	additionalIncome: z.coerce.number().nonnegative().max(MAX_EURO * 100).transform(toDinero),
	capitalGainsTax: z.coerce.number().nonnegative().max(MAX_PERCENT).transform(toPercentRate),
	placementCommission: z.coerce.number().nonnegative().max(MAX_EURO).transform(toDinero),
	savingRateCosts: z.coerce.number().nonnegative().max(MAX_PERCENT).optional().default(0).transform(toPercentRate),
	balanceCosts: z.coerce.number().nonnegative().max(MAX_PERCENT).optional().default(0).transform(toPercentRate).transform(toMonthly),
	fixedCosts: z.coerce.number().nonnegative().max(MAX_EURO).optional().default(0).transform(toMonthly).transform(toDinero),
	minimumCosts: z.coerce.number().nonnegative().max(MAX_EURO).optional().default(0).transform(toMonthly).transform(toDinero),
	ter: z.coerce.number().nonnegative().max(MAX_PERCENT).transform(toPercentRate).transform(toMonthly),
	expectedInterest: z.coerce.number().nonnegative().max(MAX_PERCENT).transform(toMonthlyConformalRate),
	partialExemption: z.coerce.number().nonnegative().max(MAX_PERCENT).transform(toPercentRate).transform((rate) => 1 - rate),
	reallocationOccurrence: z.coerce.number().int().max(100).optional().default(0).transform((years) => years * 12),
	reallocationRate: z.coerce.number().nonnegative().max(MAX_PERCENT).optional().default(0).transform(toPercentRate)
});
const netPolicy = defineCalculator({
	schema,
	calculate
});
function calculate(parsedInput) {
	const { policyBalance, etfBalance, etfGain } = simulateOverPeriod(parsedInput);
	return { tableData: calcTableData(policyBalance, etfBalance, etfGain, parsedInput) };
}
function simulateOverPeriod(parsedInput) {
	const { duration, savingRate, placementCommission, balanceCosts, fixedCosts, minimumCosts, savingRateCosts, ter, expectedInterest, reallocationOccurrence, reallocationRate, taxAllowance, capitalGainsTax, partialExemption } = parsedInput;
	let policyBalance = toDinero(0);
	let etfBalance = toDinero(0);
	let etfGain = toDinero(0);
	for (let month = 1; month <= duration; month++) {
		let tax = toDinero(0);
		if (reallocationOccurrence > 0 && month % reallocationOccurrence === 0) {
			const realizedGain = etfGain.multiply(reallocationRate);
			const taxableAmount = Dinero.maximum([toDinero(0), realizedGain.multiply(partialExemption).subtract(taxAllowance)]);
			tax = taxableAmount.multiply(capitalGainsTax);
			etfGain = etfGain.subtract(realizedGain);
		}
		const etfCost = etfBalance.multiply(ter);
		const etfInterest = etfBalance.multiply(expectedInterest);
		etfGain = etfGain.add(etfInterest).subtract(etfCost);
		etfBalance = etfBalance.add(savingRate).subtract(tax).add(etfInterest).subtract(etfCost);
		if (month === 1) etfBalance = etfBalance.add(placementCommission);
		const policyInterest = policyBalance.multiply(expectedInterest);
		const policyBalanceCost = policyBalance.multiply(balanceCosts);
		const policyCostAdministration = policyBalance.multiply(ter).add(Dinero.maximum([policyBalanceCost, minimumCosts])).add(fixedCosts);
		const policyCostSaving = savingRate.multiply(savingRateCosts);
		policyBalance = policyBalance.add(savingRate).add(policyInterest).subtract(policyCostAdministration).subtract(policyCostSaving);
	}
	return {
		policyBalance,
		etfBalance,
		etfGain
	};
}
function calcTableData(policyGrossWorth, etfGrossWorth, etfGain, parsedInput) {
	const { duration, savingRate, placementCommission, taxAllowance, capitalGainsTax, partialExemption, additionalIncome } = parsedInput;
	const etfGross = Dinero.maximum([toDinero(0), etfGain.multiply(partialExemption).subtract(taxAllowance)]);
	const totalSavings = savingRate.multiply(duration);
	const policyGain = policyGrossWorth.subtract(totalSavings);
	const appliesPolicy12YearRule = duration >= 144;
	const policyGross = appliesPolicy12YearRule ? policyGain.multiply(.85 / 2) : policyGain.multiply(.85);
	const policyTax = appliesPolicy12YearRule ? toDinero(calcPolicyTax(policyGross.toUnit(), additionalIncome.toUnit())) : policyGross.subtract(taxAllowance).multiply(capitalGainsTax);
	return {
		grossWorth: {
			policy: formatResult(policyGrossWorth, ""),
			etf: formatResult(etfGrossWorth, "")
		},
		totalPayments: {
			policy: formatResult(totalSavings, ""),
			etf: formatResult(totalSavings.add(placementCommission), "")
		},
		gain: {
			policy: formatResult(policyGain, ""),
			etf: formatResult(etfGain, "")
		},
		gross: {
			policy: formatResult(policyGross, ""),
			etf: formatResult(etfGross, "")
		},
		tax: {
			policy: formatResult(policyTax, ""),
			etf: formatResult(etfGross.multiply(capitalGainsTax), "")
		},
		netWorth: {
			policy: formatResult(policyGrossWorth.subtract(policyTax), ""),
			etf: formatResult(etfGrossWorth.subtract(etfGross.multiply(capitalGainsTax)), "")
		}
	};
}
function calcPolicyTax(policyGross, additionalIncome) {
	const sharedInput = {
		inputPeriod: 1,
		inputAccountingYear: "2025",
		inputTaxClass: 1,
		inputTaxAllowance: 0,
		inputChurchTax: 0,
		inputState: "Hamburg",
		inputYearOfBirth: 1980,
		inputChildren: 0,
		inputChildTaxAllowance: 0,
		inputHealthInsurance: 1,
		inputAdditionalContribution: 0,
		inputPkvContribution: 0,
		inputEmployerSubsidy: 0,
		inputPensionInsurance: 1,
		inputLevyOne: 0,
		inputLevyTwo: 0,
		inputActivateLevy: 0
	};
	const correction = CORRECTION_VALUES.werbungskostenpauschale + CORRECTION_VALUES.arbeitslosenversicherung * Math.min(policyGross, CORRECTION_VALUES.beitragsbemessungsgrenze);
	const taxesWithPolicy = grossToNet.validateAndCalculate({
		...sharedInput,
		inputGrossWage: policyGross + correction + additionalIncome
	}).outputTotalTaxesYear.replace("€", "");
	const taxesWithoutPolicy = grossToNet.validateAndCalculate({
		...sharedInput,
		inputGrossWage: additionalIncome + correction
	}).outputTotalTaxesYear.replace("€", "");
	return formatInput(taxesWithPolicy) - formatInput(taxesWithoutPolicy);
}

//#endregion
export { compoundInterest, defineCalculator, grossToNet, isNewFederalState, netPolicy };