import type { BigDecimal } from './shims/BigDecimal'

export abstract class GenericLohnsteuer {
  // Constants

  /**
   * Tabelle fuer die Vomhundertsaetze des Versorgungsfreibetrags
   */
  abstract TAB1: BigDecimal[]

  /**
   * Tabelle fuer die Hoechstbetrage des Versorgungsfreibetrags
   */
  abstract TAB2: BigDecimal[]

  /**
   * Tabelle fuer die Zuschlaege zum Versorgungsfreibetrag
   */
  abstract TAB3: BigDecimal[]

  /**
   * Tabelle fuer die Vomhundertsaetze des Altersentlastungsbetrags
   */
  abstract TAB4: BigDecimal[]

  /**
   * Tabelle fuer die Hoechstbetraege des Altersentlastungsbetrags
   */
  abstract TAB5: BigDecimal[]

  /**
   * Zahlenkonstanten fuer im Plan oft genutzte BigDecimal Werte
   */
  abstract ZAHL1: BigDecimal
  abstract ZAHL2: BigDecimal
  abstract ZAHL5: BigDecimal
  abstract ZAHL7: BigDecimal
  abstract ZAHL12: BigDecimal
  abstract ZAHL100: BigDecimal
  abstract ZAHL360: BigDecimal
  abstract ZAHL500: BigDecimal
  abstract ZAHL700: BigDecimal
  abstract ZAHL1000: BigDecimal
  abstract ZAHL10000: BigDecimal

  // Inputs

  /**
   * 1, wenn die Anwendung des Faktorverfahrens gewählt wurden (nur in Steuerklasse IV)
   */
  abstract af: number

  /**
   * Auf die Vollendung des 64. Lebensjahres folgende
   * Kalenderjahr (erforderlich, wenn ALTER1=1)
   */
  abstract AJAHR: number

  /**
   * 1, wenn das 64. Lebensjahr zu Beginn des Kalenderjahres vollendet wurde, in dem
   * der Lohnzahlungszeitraum endet (§ 24 a EStG), sonst = 0
   */
  abstract ALTER1: number

  /**
   * in VKAPA und VMT enthaltene Entschädigungen nach §24 Nummer 1 EStG
   * sowie tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen
   * (§ 19a Absatz 4 EStG) in Cent
   */
  abstract ENTSCH: BigDecimal

  /**
   * eingetragener Faktor mit drei Nachkommastellen
   */
  abstract f: number

  /**
   * Jahresfreibetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
   * sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
   * elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung
   * auf der Bescheinigung für den Lohnsteuerabzug 2024 in Cent (ggf. 0)
   */
  abstract JFREIB: BigDecimal

  /**
   * Jahreshinzurechnungsbetrag für die Ermittlung der Lohnsteuer für die sonstigen Bezüge
   * sowie für Vermögensbeteiligungen nach § 19a Absatz 1 und 4 EStG nach Maßgabe der
   * elektronischen Lohnsteuerabzugsmerkmale nach § 39e EStG oder der Eintragung auf der
   * Bescheinigung für den Lohnsteuerabzug 2024 in Cent (ggf. 0)
   */
  abstract JHINZU: BigDecimal

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
  abstract JRE4: BigDecimal

  /**
   * In JRE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
   */
  abstract JVBEZ: BigDecimal

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
  abstract KRV: number

  /**
   * Kassenindividueller Zusatzbeitragssatz bei einem gesetzlich krankenversicherten Arbeitnehmer
   * in Prozent (bspw. 1,70 für 1,70 %) mit 2 Dezimalstellen.
   * Es ist der volle Zusatzbeitragssatz anzugeben. Die Aufteilung in Arbeitnehmer- und Arbeitgeber-
   * anteil erfolgt im Programmablauf.
   */
  abstract KVZ: BigDecimal

  /**
   * Lohnzahlungszeitraum:
   * 1 = Jahr
   * 2 = Monat
   * 3 = Woche
   * 4 = Tag
   */
  abstract LZZ: number

  /**
   * Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
   * oder in der Bescheinigung für den Lohnsteuerabzug 2024 eingetragene Freibetrag für den
   * Lohnzahlungszeitraum in Cent
   */
  abstract LZZFREIB: BigDecimal

  /**
   * Der als elektronisches Lohnsteuerabzugsmerkmal für den Arbeitgeber nach § 39e EStG festgestellte
   * oder in der Bescheinigung für den Lohnsteuerabzug 2024 eingetragene Hinzurechnungsbetrag für den
   * Lohnzahlungszeitraum in Cent
   */
  abstract LZZHINZU: BigDecimal

  /**
   * Nicht zu besteuernde Vorteile bei Vermögensbeteiligungen
   * (§ 19a Absatz 1 Satz 4 EStG) in Cent
   */
  abstract MBV: BigDecimal

  /**
   * Dem Arbeitgeber mitgeteilte Zahlungen des Arbeitnehmers zur privaten
   * Kranken- bzw. Pflegeversicherung im Sinne des §10 Abs. 1 Nr. 3 EStG 2010
   * als Monatsbetrag in Cent (der Wert ist inabhängig vom Lohnzahlungszeitraum immer
   * als Monatsbetrag anzugeben).
   */
  abstract PKPV: BigDecimal

  /**
   * Krankenversicherung:
   * 0 = gesetzlich krankenversicherte Arbeitnehmer
   * 1 = ausschließlich privat krankenversicherte Arbeitnehmer OHNE Arbeitgeberzuschuss
   * 2 = ausschließlich privat krankenversicherte Arbeitnehmer MIT Arbeitgeberzuschuss
   */
  abstract PKV: number

  /**
   * Zahl der beim Arbeitnehmer zu berücksichtigenden Beitragsabschläge in der sozialen Pflegeversicherung
   * bei mehr als einem Kind
   * 0 = kein Abschlag
   * 1 = Beitragsabschlag für das 2. Kind
   * 2 = Beitragsabschläge für das 2. und 3. Kind
   * 3 = Beitragsabschläge für 2. bis 4. Kinder
   * 4 = Beitragsabschläge für 2. bis 5. oder mehr Kinder
   *
   * @remarks Added in Lohnsteuer 2024
   */
  abstract PVA?: number

  /**
   * 1, wenn bei der sozialen Pflegeversicherung die Besonderheiten in Sachsen zu berücksichtigen sind bzw.
   * zu berücksichtigen wären, sonst 0.
   */
  abstract PVS: number

  /**
   * 1, wenn er der Arbeitnehmer den Zuschlag zur sozialen Pflegeversicherung
   * zu zahlen hat, sonst 0.
   */
  abstract PVZ: number

  /**
   * Religionsgemeinschaft des Arbeitnehmers lt. elektronischer Lohnsteuerabzugsmerkmale oder der
   * Bescheinigung für den Lohnsteuerabzug 2024 (bei keiner Religionszugehörigkeit = 0)
   */
  abstract R: number

  /**
   * Steuerpflichtiger Arbeitslohn für den Lohnzahlungszeitraum vor Berücksichtigung des
   * Versorgungsfreibetrags und des Zuschlags zum Versorgungsfreibetrag, des Altersentlastungsbetrags
   * und des als elektronisches Lohnsteuerabzugsmerkmal festgestellten oder in der Bescheinigung für
   * den Lohnsteuerabzug 2024 für den Lohnzahlungszeitraum eingetragenen Freibetrags bzw.
   * Hinzurechnungsbetrags in Cent
   */
  abstract RE4: BigDecimal

  /**
   * Sonstige Bezüge (ohne Vergütung aus mehrjähriger Tätigkeit) einschließlich nicht tarifermäßigt
   * zu besteuernde Vorteile bei Vermögensbeteiligungen und Sterbegeld bei Versorgungsbezügen sowie
   * Kapitalauszahlungen/Abfindungen, soweit es sich nicht um Bezüge für mehrere Jahre handelt,
   * in Cent (ggf. 0)
   */
  abstract SONSTB: BigDecimal

  /**
   * Sterbegeld bei Versorgungsbezuegen sowie Kapitalauszahlungen/Abfindungen,
   * soweit es sich nicht um Bezuege fuer mehrere Jahre handelt
   * (in SONSTB enthalten) in Cents
   */
  abstract STERBE: BigDecimal

  /**
   * Steuerklasse:
   * 1 = I
   * 2 = II
   * 3 = III
   * 4 = IV
   * 5 = V
   * 6 = VI
   */
  abstract STKL: number

  /**
   * In RE4 enthaltene Versorgungsbezuege in Cents (ggf. 0)
   */
  abstract VBEZ: BigDecimal

  /**
   * Vorsorgungsbezug im Januar 2005 bzw. fuer den ersten vollen Monat
   * in Cents
   */
  abstract VBEZM: BigDecimal

  /**
   * Voraussichtliche Sonderzahlungen im Kalenderjahr des Versorgungsbeginns
   * bei Versorgungsempfaengern ohne Sterbegeld, Kapitalauszahlungen/Abfindungen
   * bei Versorgungsbezuegen in Cents
   */
  abstract VBEZS: BigDecimal

  /**
   * In SONSTB enthaltene Versorgungsbezuege einschliesslich Sterbegeld
   * in Cents (ggf. 0)
   */
  abstract VBS: BigDecimal

  /**
   * Jahr, in dem der Versorgungsbezug erstmalig gewaehrt wurde; werden
   * mehrere Versorgungsbezuege gezahlt, so gilt der aelteste erstmalige Bezug
   */
  abstract VJAHR: number

  /**
   * Kapitalauszahlungen / Abfindungen / Nachzahlungen bei Versorgungsbezügen
   * für mehrere Jahre in Cent (ggf. 0)
   */
  abstract VKAPA: BigDecimal

  /**
   * Entschädigungen und Vergütung für mehrjährige Tätigkeit sowie tarifermäßigt
   * zu besteuernde Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 Satz 2 EStG)
   * ohne Kapitalauszahlungen und ohne Abfindungen bei Versorgungsbezügen
   * in Cent (ggf. 0)
   */
  abstract VMT: BigDecimal

  /**
   * Zahl der Freibetraege fuer Kinder (eine Dezimalstelle, nur bei Steuerklassen
   * I, II, III und IV)
   */
  abstract ZKF: BigDecimal

  /**
   * Zahl der Monate, fuer die Versorgungsbezuege gezahlt werden (nur
   * erforderlich bei Jahresberechnung (LZZ = 1)
   */
  abstract ZMVB: number

  /**
   * In JRE4 enthaltene Entschädigungen nach § 24 Nummer 1 EStG und zu besteuernde
   * Vorteile bei Vermögensbeteiligungen (§ 19a Absatz 4 EStG in Cent
   */
  abstract JRE4ENT: BigDecimal

  /**
   * In SONSTB enthaltene Entschädigungen nach § 24 Nummer 1 EStG sowie nicht
   * tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen in Cent
   */
  abstract SONSTENT: BigDecimal

  /* Output variables */

  /**
   * Bemessungsgrundlage fuer die Kirchenlohnsteuer in Cents
   */
  abstract BK: BigDecimal

  /**
   * Bemessungsgrundlage der sonstigen Bezüge (ohne Vergütung für mehrjährige Tätigkeit)
   * für die Kirchenlohnsteuer in Cent.
   * Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei
   * Vermögensbeteiligungen (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern BK
   * (maximal bis 0). Der Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen
   * im Rahmen der Veranlagung zur Einkommensteuer bleibt unberührt.
   */
  abstract BKS: BigDecimal

  /**
   * Bemessungsgrundlage der Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
   * zu besteuernden Vorteile bei Vermögensbeteiligungen für die Kirchenlohnsteuer in Cent
   */
  abstract BKV: BigDecimal

  /**
   * Fuer den Lohnzahlungszeitraum einzubehaltende Lohnsteuer in Cents
   */
  abstract LSTLZZ: BigDecimal

  /**
   * Fuer den Lohnzahlungszeitraum einzubehaltender Solidaritaetszuschlag
   * in Cents
   */
  abstract SOLZLZZ: BigDecimal

  /**
   * Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit in Cent.
   * Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
   * (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern SOLZLZZ (maximal bis 0). Der
   * Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
   * Veranlagung zur Einkommensteuer bleibt unberührt.
   */
  abstract SOLZS: BigDecimal

  /**
   * Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt
   * zu besteuernden Vorteile bei Vermögensbeteiligungen in Cent
   */
  abstract SOLZV: BigDecimal

  /**
   * Lohnsteuer für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit und ohne
   * tarifermäßigt zu besteuernde Vorteile bei Vermögensbeteiligungen) in Cent
   * Hinweis: Negativbeträge, die aus nicht zu besteuernden Vorteilen bei Vermögensbeteiligungen
   * (§ 19a Absatz 1 Satz 4 EStG) resultieren, mindern LSTLZZ (maximal bis 0). Der
   * Sonderausgabenabzug für tatsächlich erbrachte Vorsorgeaufwendungen im Rahmen der
   * Veranlagung zur Einkommensteuer bleibt unberührt.
   */
  abstract STS: BigDecimal

  /**
   * Lohnsteuer für die Vergütung für mehrjährige Tätigkeit und der tarifermäßigt zu besteuernden
   * Vorteile bei Vermögensbeteiligungen in Cent
   */
  abstract STV: BigDecimal

  /**
   * Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers zur
   * privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf. auch
   * die Mindestvorsorgepauschale) in Cent beim laufenden Arbeitslohn. Für Zwecke der Lohn-
   * steuerbescheinigung sind die einzelnen Ausgabewerte außerhalb des eigentlichen Lohn-
   * steuerbescheinigungsprogramms zu addieren; hinzuzurechnen sind auch die Ausgabewerte
   * VKVSONST
   */
  abstract VKVLZZ: BigDecimal

  /**
   * Für den Lohnzahlungszeitraum berücksichtigte Beiträge des Arbeitnehmers
   * zur privaten Basis-Krankenversicherung und privaten Pflege-Pflichtversicherung (ggf.
   * auch die Mindestvorsorgepauschale) in Cent bei sonstigen Bezügen. Der Ausgabewert kann
   * auch negativ sein. Für tarifermäßigt zu besteuernde Vergütungen für mehrjährige
   * Tätigkeiten enthält der PAP keinen entsprechenden Ausgabewert.
   */
  abstract VKVSONST: BigDecimal

  /**
   * Verbrauchter Freibetrag bei Berechnung des laufenden Arbeitslohns, in Cent
   */
  abstract VFRB: BigDecimal

  /**
   * Verbrauchter Freibetrag bei Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
   */
  abstract VFRBS1: BigDecimal

  /**
   * Verbrauchter Freibetrag bei Berechnung der sonstigen Bezüge, in Cent
   */
  abstract VFRBS2: BigDecimal

  /**
   * Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über
   * dem Grundfreibetrag bei der Berechnung des laufenden Arbeitslohns, in Cent
   */
  abstract WVFRB: BigDecimal

  /**
   * Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE über dem Grundfreibetrag
   * bei der Berechnung des voraussichtlichen Jahresarbeitslohns, in Cent
   */
  abstract WVFRBO: BigDecimal

  /**
   * Für die weitergehende Berücksichtigung des Steuerfreibetrags nach dem DBA Türkei verfügbares ZVE
   * über dem Grundfreibetrag bei der Berechnung der sonstigen Bezüge, in Cent
   */
  abstract WVFRBM: BigDecimal

  // Internals

  /**
   * Altersentlastungsbetrag nach Alterseinkünftegesetz in €,
   * Cent (2 Dezimalstellen)
   */
  abstract ALTE: BigDecimal

  /**
   * Arbeitnehmer-Pauschbetrag in EURO
   */
  abstract ANP: BigDecimal

  /**
   * Auf den Lohnzahlungszeitraum entfallender Anteil von Jahreswerten
   * auf ganze Cents abgerundet
   */
  abstract ANTEIL1: BigDecimal

  /**
   * Bemessungsgrundlage für Altersentlastungsbetrag in €, Cent
   * (2 Dezimalstellen)
   */
  abstract BMG: BigDecimal

  /**
   * Beitragsbemessungsgrenze in der gesetzlichen Krankenversicherung
   * und der sozialen Pflegeversicherung in Euro
   */
  abstract BBGKVPV: BigDecimal

  /**
   * allgemeine Beitragsbemessungsgrenze in der allgemeinen Renten-versicherung in Euro
   */
  abstract BBGRV: BigDecimal

  /**
   * Differenz zwischen ST1 und ST2 in EURO
   */
  abstract DIFF: BigDecimal

  /**
   * Entlastungsbetrag für Alleinerziehende in Euro
   */
  abstract EFA: BigDecimal

  /**
   * Versorgungsfreibetrag in €, Cent (2 Dezimalstellen)
   */
  abstract FVB: BigDecimal

  /**
   * Versorgungsfreibetrag in €, Cent (2 Dezimalstellen) für die Berechnung
   * der Lohnsteuer für den sonstigen Bezug
   */
  abstract FVBSO: BigDecimal

  /**
   * Zuschlag zum Versorgungsfreibetrag in EURO
   */
  abstract FVBZ: BigDecimal

  /**
   * Zuschlag zum Versorgungsfreibetrag in EURO fuer die Berechnung
   * der Lohnsteuer beim sonstigen Bezug
   */
  abstract FVBZSO: BigDecimal

  /**
   * Grundfreibetrag in Euro
   */
  abstract GFB: BigDecimal

  /**
   * Maximaler Altersentlastungsbetrag in €
   */
  abstract HBALTE: BigDecimal

  /**
   * Massgeblicher maximaler Versorgungsfreibetrag in €
   */
  abstract HFVB: BigDecimal

  /**
   * Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €,Cent
   * (2 Dezimalstellen)
   */
  abstract HFVBZ: BigDecimal

  /**
   * Massgeblicher maximaler Zuschlag zum Versorgungsfreibetrag in €, Cent
   * (2 Dezimalstellen) für die Berechnung der Lohnsteuer für den
   * sonstigen Bezug
   */
  abstract HFVBZSO: BigDecimal

  /**
   * Nummer der Tabellenwerte fuer Versorgungsparameter
   */
  abstract J: number

  /**
   * Jahressteuer nach § 51a EStG, aus der Solidaritaetszuschlag und
   * Bemessungsgrundlage fuer die Kirchenlohnsteuer ermittelt werden in EURO
   */
  abstract JBMG: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechneter LZZFREIB in €, Cent
   * (2 Dezimalstellen)
   */
  abstract JLFREIB: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnete LZZHINZU in €, Cent
   * (2 Dezimalstellen)
   */
  abstract JLHINZU: BigDecimal

  /**
   * Jahreswert, dessen Anteil fuer einen Lohnzahlungszeitraum in
   * UPANTEIL errechnet werden soll in Cents
   */
  abstract JW: BigDecimal

  /**
   * Nummer der Tabellenwerte fuer Parameter bei Altersentlastungsbetrag
   */
  abstract K: number

  /**
   * Merker für Berechnung Lohnsteuer für mehrjährige Tätigkeit.
   * 0 = normale Steuerberechnung
   * 1 = Steuerberechnung für mehrjährige Tätigkeit
   * 2 = entfällt
   */
  abstract KENNVMT: number

  /**
   * Summe der Freibetraege fuer Kinder in EURO
   */
  abstract KFB: BigDecimal

  /**
   * Beitragssatz des Arbeitgebers zur Krankenversicherung
   */
  abstract KVSATZAG: BigDecimal

  /**
   * Beitragssatz des Arbeitnehmers zur Krankenversicherung
   */
  abstract KVSATZAN: BigDecimal

  /**
   * Kennzahl fuer die Einkommensteuer-Tabellenart:
   * 1 = Grundtabelle
   * 2 = Splittingtabelle
   */
  abstract KZTAB: number

  /**
   * Jahreslohnsteuer in EURO
   */
  abstract LSTJAHR: BigDecimal

  /**
   * Zwischenfelder der Jahreslohnsteuer in Cent
   */
  abstract LST1: BigDecimal
  abstract LST2: BigDecimal
  abstract LST3: BigDecimal
  abstract LSTOSO: BigDecimal
  abstract LSTSO: BigDecimal

  /**
   * Mindeststeuer fuer die Steuerklassen V und VI in EURO
   */
  abstract MIST: BigDecimal

  /**
   * Beitragssatz des Arbeitgebers zur Pflegeversicherung (6 Dezimalstellen)
   */
  abstract PVSATZAG: BigDecimal

  /**
   * Beitragssatz des Arbeitnehmers zur Pflegeversicherung (6 Dezimalstellen)
   */
  abstract PVSATZAN: BigDecimal

  /**
   * Beitragssatz des Arbeitnehmers in der allgemeinen gesetzlichen Rentenversicherung (4 Dezimalstellen)
   */
  abstract RVSATZAN: BigDecimal

  /**
   * Rechenwert in Gleitkommadarstellung
   */
  abstract RW: BigDecimal

  /**
   * Sonderausgaben-Pauschbetrag in EURO
   */
  abstract SAP: BigDecimal

  /**
   * Freigrenze fuer den Solidaritaetszuschlag in EURO
   */
  abstract SOLZFREI: BigDecimal

  /**
   * Solidaritaetszuschlag auf die Jahreslohnsteuer in EURO, C (2 Dezimalstellen)
   */
  abstract SOLZJ: BigDecimal

  /**
   * Zwischenwert fuer den Solidaritaetszuschlag auf die Jahreslohnsteuer
   * in EURO, C (2 Dezimalstellen)
   */
  abstract SOLZMIN: BigDecimal

  /**
   * Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro
   */
  abstract SOLZSBMG: BigDecimal

  /**
   * Neu ab 2021: Zu versteuerndes Einkommen für die Ermittlung der Bemessungsgrundlage des Solidaritätszuschlags zur Prüfung der Freigrenze beim Solidaritätszuschlag für sonstige Bezüge (ohne Vergütung für mehrjährige Tätigkeit) in Euro, Cent (2 Dezimalstellen)
   */
  abstract SOLZSZVE: BigDecimal

  /**
   * Neu ab 2021: Bemessungsgrundlage des Solidaritätszuschlags für die Prüfung der Freigrenze beim Solidaritätszuschlag für die Vergütung für mehrjährige Tätigkeit in Euro
   */
  abstract SOLZVBMG: BigDecimal

  /**
   * Tarifliche Einkommensteuer in EURO
   */
  abstract ST: BigDecimal

  /**
   * Tarifliche Einkommensteuer auf das 1,25-fache ZX in EURO
   */
  abstract ST1: BigDecimal

  /**
   * Tarifliche Einkommensteuer auf das 0,75-fache ZX in EURO
   */
  abstract ST2: BigDecimal

  /**
   * Zwischenfeld zur Ermittlung der Steuer auf Vergütungen für mehrjährige Tätigkeit
   */
  abstract STOVMT: BigDecimal

  /**
   * Teilbetragssatz der Vorsorgepauschale für die Rentenversicherung (2 Dezimalstellen)
   */
  abstract TBSVORV: BigDecimal

  /**
   * Bemessungsgrundlage fuer den Versorgungsfreibetrag in Cents
   */
  abstract VBEZB: BigDecimal

  /**
   * Bemessungsgrundlage für den Versorgungsfreibetrag in Cent für
   * den sonstigen Bezug
   */
  abstract VBEZBSO: BigDecimal

  /**
   * Hoechstbetrag der Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
   */
  abstract VHB: BigDecimal

  /**
   * Vorsorgepauschale in EURO, C (2 Dezimalstellen)
   */
  abstract VSP: BigDecimal

  /**
   * Vorsorgepauschale nach Alterseinkuenftegesetz in EURO, C
   */
  abstract VSPN: BigDecimal

  /**
   * Zwischenwert 1 bei der Berechnung der Vorsorgepauschale nach
   * dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
   */
  abstract VSP1: BigDecimal

  /**
   * Zwischenwert 2 bei der Berechnung der Vorsorgepauschale nach
   * dem Alterseinkuenftegesetz in EURO, C (2 Dezimalstellen)
   */
  abstract VSP2: BigDecimal

  /**
   * Vorsorgepauschale mit Teilbeträgen für die gesetzliche Kranken- und
   * soziale Pflegeversicherung nach fiktiven Beträgen oder ggf. für die
   * private Basiskrankenversicherung und private Pflege-Pflichtversicherung
   * in Euro, Cent (2 Dezimalstellen)
   */
  abstract VSP3: BigDecimal

  /**
   * Erster Grenzwert in Steuerklasse V/VI in Euro
   */
  abstract W1STKL5: BigDecimal

  /**
   * Zweiter Grenzwert in Steuerklasse V/VI in Euro
   */
  abstract W2STKL5: BigDecimal

  /**
   * Dritter Grenzwert in Steuerklasse V/VI in Euro
   */
  abstract W3STKL5: BigDecimal

  /**
   * Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 2 EStG in EURO
   */
  abstract VSPMAX1: BigDecimal

  /**
   * Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 3 EStG in EURO
   */
  abstract VSPMAX2: BigDecimal

  /**
   * Vorsorgepauschale nach § 10c Abs. 2 Satz 2 EStG vor der Hoechstbetragsberechnung
   * in EURO, C (2 Dezimalstellen)
   */
  abstract VSPO: BigDecimal

  /**
   * Fuer den Abzug nach § 10c Abs. 2 Nrn. 2 und 3 EStG verbleibender
   * Rest von VSPO in EURO, C (2 Dezimalstellen)
   */
  abstract VSPREST: BigDecimal

  /**
   * Hoechstbetrag der Vorsorgepauschale nach § 10c Abs. 2 Nr. 1 EStG
   * in EURO, C (2 Dezimalstellen)
   */
  abstract VSPVOR: BigDecimal

  /**
   * Zu versteuerndes Einkommen gem. § 32a Abs. 1 und 2 EStG €, C
   * (2 Dezimalstellen)
   */
  abstract X: BigDecimal

  /**
   * gem. § 32a Abs. 1 EStG (6 Dezimalstellen)
   */
  abstract Y: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
   * nach Abzug der Freibeträge nach § 39 b Abs. 2 Satz 3 und 4.
   */
  abstract ZRE4: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
   */
  abstract ZRE4J: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnetes RE4 in €, C (2 Dezimalstellen)
   * nach Abzug des Versorgungsfreibetrags und des Alterentlastungsbetrags
   * zur Berechnung der Vorsorgepauschale in €, Cent (2 Dezimalstellen)
   */
  abstract ZRE4VP: BigDecimal

  /**
   * Feste Tabellenfreibeträge (ohne Vorsorgepauschale) in €, Cent
   * (2 Dezimalstellen)
   */
  abstract ZTABFB: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnetes (VBEZ abzueglich FVB) in
   * EURO, C (2 Dezimalstellen)
   */
  abstract ZVBEZ: BigDecimal

  /**
   * Auf einen Jahreslohn hochgerechnetes VBEZ in €, C (2 Dezimalstellen)
   */
  abstract ZVBEZJ: BigDecimal

  /**
   * Zu versteuerndes Einkommen in €, C (2 Dezimalstellen)
   */
  abstract ZVE: BigDecimal

  /**
   * Zwischenfelder zu X fuer die Berechnung der Steuer nach § 39b
   * Abs. 2 Satz 7 EStG in €
   */
  abstract ZX: BigDecimal
  abstract ZZX: BigDecimal
  abstract HOCH: BigDecimal
  abstract VERGL: BigDecimal

  /**
   * Jahreswert der berücksichtigten Beiträge zur privaten Basis-Krankenversicherung und
   * privaten Pflege-Pflichtversicherung (ggf. auch die Mindestvorsorgepauschale) in Cent.
   */
  abstract VKV: BigDecimal

  // Methods
  abstract MAIN: () => void
  abstract MPARA: () => void
  abstract MRE4JL: () => void
  abstract MRE4: () => void
  abstract MRE4ALTE: () => void
  abstract MRE4ABZ: () => void
  abstract MBERECH: () => void
  abstract MZTABFB: () => void
  abstract MLSTJAHR: () => void
  abstract UPVKVLZZ: () => void
  abstract UPVKV: () => void
  abstract UPLSTLZZ: () => void
  abstract UPMLST: () => void
  abstract UPEVP: () => void
  abstract MVSP: () => void
  abstract MST5_6: () => void
  abstract UP5_6: () => void
  abstract MSOLZ: () => void
  abstract UPANTEIL: () => void
  abstract MSONST: () => void
  abstract MVMT: () => void
  abstract MOSONST: () => void
  abstract MRE4SONST: () => void
  abstract UPTAB22: () => void

  // Setters
  abstract setAf: (value: number) => void
  abstract setAjahr: (value: number) => void
  abstract setAlter1: (value: number) => void
  abstract setEntsch: (value: BigDecimal) => void
  abstract setF: (value: number) => void
  abstract setJfreib: (value: BigDecimal) => void
  abstract setJhinzu: (value: BigDecimal) => void
  abstract setJre4: (value: BigDecimal) => void
  abstract setJvbez: (value: BigDecimal) => void
  abstract setKrv: (value: number) => void
  abstract setKvz: (value: BigDecimal) => void
  abstract setLzz: (value: number) => void
  abstract setLzzfreib: (value: BigDecimal) => void
  abstract setLzzhinzu: (value: BigDecimal) => void
  abstract setMbv: (value: BigDecimal) => void
  abstract setPkpv: (value: BigDecimal) => void
  abstract setPkv: (value: number) => void
  abstract setPvs: (value: number) => void
  abstract setPvz: (value: number) => void
  /** @remarks Added in Lohnsteuer 2024 */
  abstract setPva?: (value: number | BigDecimal) => void
  abstract setR: (value: number) => void
  abstract setRe4: (value: BigDecimal) => void
  abstract setSonstb: (value: BigDecimal) => void
  abstract setSterbe: (value: BigDecimal) => void
  abstract setStkl: (value: number) => void
  abstract setVbez: (value: BigDecimal) => void
  abstract setVbezm: (value: BigDecimal) => void
  abstract setVbezs: (value: BigDecimal) => void
  abstract setVbs: (value: BigDecimal) => void
  abstract setVjahr: (value: number) => void
  abstract setVkapa: (value: BigDecimal) => void
  abstract setVmt: (value: BigDecimal) => void
  abstract setZkf: (value: BigDecimal) => void
  abstract setZmvb: (value: number) => void
  abstract setJre4ent: (value: BigDecimal) => void
  abstract setSonstent: (value: BigDecimal) => void

  // Getters
  abstract getBk: () => BigDecimal
  abstract getBks: () => BigDecimal
  abstract getBkv: () => BigDecimal
  abstract getLstlzz: () => BigDecimal
  abstract getSolzlzz: () => BigDecimal
  abstract getSolzs: () => BigDecimal
  abstract getSolzv: () => BigDecimal
  abstract getSts: () => BigDecimal
  abstract getStv: () => BigDecimal
  abstract getVkvlzz: () => BigDecimal
  abstract getVkvsonst: () => BigDecimal
  abstract getVfrb: () => BigDecimal
  abstract getVfrbs1: () => BigDecimal
  abstract getVfrbs2: () => BigDecimal
  abstract getWvfrb: () => BigDecimal
  abstract getWvfrbo: () => BigDecimal
  abstract getWvfrbm: () => BigDecimal
}
