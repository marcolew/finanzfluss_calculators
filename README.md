  <img src="./.github/calculators-icon.svg" alt="Logo for @finanzfluss/calculators Repository" width="120" height="120">

# @finanzfluss/calculators

A selection of financial calculators used on the Finanzfluss Website: [https://www.finanzfluss.de/rechner/](https://www.finanzfluss.de/rechner/)

🎯 **Type-safe**: built with TypeScript and Zod validation

🔍 **Real-world tested**: used by millions of Finanzfluss users

🏛️ **German tax system support**: Correct tax and insurance calculation

<br/>

## Installation

```bash
# pnpm
pnpm add -D @finanzfluss/calculators

# npm
npm install -D @finanzfluss/calculators

# yarn
yarn add -D @finanzfluss/calculators
```

<br/>

## Calculators


### Gross-to-Net Calculator

The Brutto-Netto-Rechner ([https://finanzfluss.de/rechner/brutto-netto-rechner](https://www.finanzfluss.de/rechner/brutto-netto-rechner/)) calculates a net salary from gross income, accounting for all German tax and social insurance deductions. It is based on the official pseudo code for tax calculation provided by the German ministry of finance: [https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml](https://www.bmf-steuerrechner.de/interface/pseudocodes.xhtml).

#### Key Features:

- **All 6 German tax classes** (I-VI) with specific calculations for single, married, and divorced individuals
- **State-specific calculations** for all 16 German states including varying church tax rates (8% in Bavaria/Baden-Württemberg, 9% elsewhere)
- **Age-based adjustments** including senior citizen tax relief (Altersentlastungsbetrag) for 64+ years
- **Child allowances** with support for partial children (e.g., 0.5 children for blended families)
- **Flexible insurance options** supporting both public (GKV) and private (PKV) health insurance
- **Comprehensive social insurance** including pension, unemployment, and care insurance calculations

```ts
import {
  calcGrossToNet,
  GROSS_NET_QUERY_SCHEMA,
} from '@finanzfluss/calculators'

const input = {
  inputAccountingYear: '2025',
  inputTaxClass: '1',
  inputTaxAllowance: '0',
  inputChurchTax: '0',
  inputState: 'Hamburg',
  inputYearOfBirth: '1990',
  inputChildren: '0',
  inputChildTaxAllowance: '0',
  inputPkvContribution: '0',
  inputEmployerSubsidy: '0',
  inputPensionInsurance: '0',
  inputLevyOne: '0',
  inputLevyTwo: '0',
  inputActivateLevy: '0',
  inputHealthInsurance: '0',
  inputAdditionalContribution: '1.7',
  inputGrossWage: '5000',
  inputPeriod: '2', // 2 = monthly, 1 = yearly
}

// Validate input
const validatedInput = GROSS_NET_QUERY_SCHEMA.parse(input)

// Calculate net salary
const result = calcGrossToNet(validatedInput)

console.log(result.outputResNetWageMonth) // Net monthly salary
console.log(result.outputResNetWageYear) // Net yearly salary
```

<br/>

### Net Policy Calculator

The Rentenversicherung-Rechner ([https://finanzfluss.de/rechner/rentenversicherung](https://www.finanzfluss.de/rechner/rentenversicherung/)) compares ETF-based pension insurance policies (Nettopolice) with traditional ETF savings plans for retirement planning.

#### Key Features:

- **ETF pension insurance analysis** comparing net policies vs. direct ETF investments
- **Tax optimization calculations** including different taxation rules for insurance vs. investment gains
- **Cost structure analysis** factoring in management fees, placement commissions, and ongoing charges
- **Long-term projections** with realistic return assumptions (typically 7% for diversified equity portfolios)
- **Flexible withdrawal scenarios** supporting both lump-sum and gradual withdrawal strategies
- **Real-world cost modeling** using actual insurance product data and fee structures

```ts
import {
  calcNetPolicy,
  NET_POLICY_QUERY_SCHEMA,
} from '@finanzfluss/calculators'

const input = {
  savingRate: '500',
  duration: '30', // years
  taxAllowance: '1000',
  useGrossToNet: 'false',
  additionalIncome: '0',
  personalTaxRate: '25',
  capitalGainsTax: '26.375',
  placementCommission: '0',
  savingRateCosts: '2.5',
  balanceCosts: '1.5',
  fixedCosts: '10',
  minimumCosts: '15',
  ter: '0.2',
  expectedInterest: '7',
  reallocationOccurrence: '0',
  partialExemption: '30',
  reallocationRate: '0',
}

// Validate input
const validatedInput = NET_POLICY_QUERY_SCHEMA.parse(input)

// Calculate net policy
const result = calcNetPolicy(validatedInput)

console.log(result.tableData.netWorth) // Projected net worth over time
```

<br/>

## Testing

Run the test suite:

```bash
pnpm test
```

Run type checking:

```bash
pnpm test:types
```

<br/>

## License

[AGPL-3.0](./LICENSE) License © 2025-PRESENT [Finflow GmbH](https://www.finanzfluss.de/impressum/)
