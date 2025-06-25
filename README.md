<p align="center">
  <img src="./.github/hippocalc-icon.svg" alt="Finanzfluss Hippocalc Repository" width="180" height="180">
</p>

<h3 align="center">Hippocalc</h3>

<p align="center">
  A collection of financial calculators for the Finanzfluss.de calculators.
</p>

<br>

# @finanzfluss/hippocalc

A collection of financial calculators powering the [Finanzfluss.de calculators](https://www.finanzfluss.de/rechner/), including comprehensive salary calculations and insurance comparison tools. All exported functions are used for our `api.finanzfluss.de` API.

## Live Calculators

These calculators are actively used on the Finanzfluss website:

- 🧮 **[Brutto-Netto-Rechner](https://www.finanzfluss.de/rechner/brutto-netto-rechner/)** - Salary calculator
- 📊 **[Rentenversicherung-Rechner](https://www.finanzfluss.de/rechner/rentenversicherung/)** - ETF pension insurance vs. ETF savings plan comparison

## Features

- 🧮 **Gross-to-Net Calculator**: Calculate net salary from gross income with complete German tax and social insurance system support
- 📊 **Net Policy Calculator**: Compare ETF-based pension insurance policies (Nettopolice) with traditional ETF savings plans
- 🏛️ **German Tax System**: Full support for all 6 tax classes and state-specific regulations including church tax variations
- 💰 **Social Insurance**: Comprehensive calculations for health, care, pension, and unemployment insurance
- 📅 **Multi-Year Support**: Accurate tax calculations for years 2019-2025 with updated rates and thresholds
- 🎯 **Type-Safe**: Built with TypeScript and Zod validation for reliable calculations
- 🔍 **Real-World Tested**: Powers live calculators used by thousands of users monthly

## Installation

```bash
# pnpm
pnpm add -D @finanzfluss/hippocalc

# npm
npm install -D @finanzfluss/hippocalc

# yarn
yarn add -D @finanzfluss/hippocalc
```

## Usage

> [!NOTE]
> All of our calculation functions are used for our `api.finanzfluss.de` GET requests and thus expect a valid query object as input. That's why all values have to be a string, even if they are numbers.

### Gross-to-Net Calculator

The Brutto-Netto-Rechner calculates your net salary from gross income, accounting for all German tax and social insurance deductions. This calculator powers the comprehensive salary tool used by thousands of users on [finanzfluss.de/rechner/brutto-netto-rechner](https://www.finanzfluss.de/rechner/brutto-netto-rechner/).

#### Key Features:

- **All 6 German tax classes** (I-VI) with specific calculations for single, married, and divorced individuals
- **State-specific calculations** for all 16 German states including varying church tax rates (8% in Bavaria/Baden-Württemberg, 9% elsewhere)
- **Age-based adjustments** including senior citizen tax relief (Altersentlastungsbetrag) for 64+ years
- **Child allowances** with support for partial children (e.g., 0.5 children for blended families)
- **Flexible insurance options** supporting both public (GKV) and private (PKV) health insurance
- **Comprehensive social insurance** including pension, unemployment, and care insurance calculations

```ts
import { calcGrossToNet, GROSS_NET_QUERY_SCHEMA } from '@finanzfluss/hippocalc'

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

### Net Policy Calculator

The Rentenversicherung-Rechner compares ETF-based pension insurance policies (Nettopolice) with traditional ETF savings plans for retirement planning. This calculator is available at [finanzfluss.de/rechner/rentenversicherung](https://www.finanzfluss.de/rechner/rentenversicherung/).

#### Key Features:

- **ETF pension insurance analysis** comparing net policies vs. direct ETF investments
- **Tax optimization calculations** including different taxation rules for insurance vs. investment gains
- **Cost structure analysis** factoring in management fees, placement commissions, and ongoing charges
- **Long-term projections** with realistic return assumptions (typically 7% for diversified equity portfolios)
- **Flexible withdrawal scenarios** supporting both lump-sum and gradual withdrawal strategies
- **Real-world cost modeling** using actual insurance product data and fee structures

```ts
import { calcNetPolicy, NET_POLICY_QUERY_SCHEMA } from '@finanzfluss/hippocalc'

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

## Testing

Run the test suite:

```bash
pnpm test
```

Run type checking:

```bash
pnpm test:types
```

## License

[AGPL-3.0](./LICENSE) License © 2025-PRESENT [Finflow GmbH](https://github.com/finanzfluss)
