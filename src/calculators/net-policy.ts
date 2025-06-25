import { z } from 'zod'
import { CORRECTION_VALUES } from '../constants/net-policy'
import { formatInput, formatNumber } from '../utils/formatters'
import { calcGrossToNet } from './gross-to-net'

const MAX_EURO = 10_000
const MAX_PERCENT = 100

export const NET_POLICY_QUERY_SCHEMA = z.object({
  // general inputs
  savingRate: z.coerce.number().nonnegative().max(MAX_EURO),
  duration: z.coerce
    .number()
    .positive()
    .int()
    .max(100)
    .transform(years => years * 12),
  taxAllowance: z.coerce.number().nonnegative().max(MAX_EURO),
  useGrossToNet: z.string().transform(i => i === 'true'),
  additionalIncome: z.coerce.number().nonnegative().max(MAX_EURO),
  personalTaxRate: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .optional()
    .default(0)
    .transform(toPercentRate),
  capitalGainsTax: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .transform(toPercentRate),

  // policy inputs
  placementCommission: z.coerce.number().nonnegative().max(MAX_EURO),
  savingRateCosts: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .optional()
    .default(0)
    .transform(toPercentRate),
  balanceCosts: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .optional()
    .default(0)
    .transform(toPercentRate)
    .transform(toMonthly),
  fixedCosts: z.coerce
    .number()
    .nonnegative()
    .max(MAX_EURO)
    .optional()
    .default(0)
    .transform(toMonthly),
  minimumCosts: z.coerce
    .number()
    .nonnegative()
    .max(MAX_EURO)
    .optional()
    .default(0)
    .transform(toMonthly),

  // etf inputs
  ter: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .transform(toPercentRate)
    .transform(toMonthly),
  expectedInterest: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .transform(toMonthlyConformalRate),

  // reallocation inputs
  reallocationOccurrence: z.coerce
    .number()
    .int()
    .max(100)
    .optional()
    .default(0)
    .transform(years => years * 12),
  partialExemption: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .transform(toPercentRate)
    .transform(rate => 1 - rate),
  reallocationRate: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PERCENT)
    .optional()
    .default(0)
    .transform(toPercentRate),
})

type NetPolicyQuery = z.output<typeof NET_POLICY_QUERY_SCHEMA>

export function calcNetPolicy(parsedQuery: NetPolicyQuery) {
  const { policyBalance, etfBalance, etfGain } = simulateOverPeriod(parsedQuery)

  return {
    tableData: calcTableData(policyBalance, etfBalance, etfGain, parsedQuery),
  }
}

function simulateOverPeriod(parsedQuery: NetPolicyQuery) {
  const {
    duration,
    savingRate,
    placementCommission,
    balanceCosts,
    fixedCosts,
    minimumCosts,
    savingRateCosts,
    ter,
    expectedInterest,
    reallocationOccurrence,
    reallocationRate,
    taxAllowance,
    capitalGainsTax,
    partialExemption,
  } = parsedQuery

  let policyBalance = 0
  let etfBalance = 0
  let etfGain = 0

  for (let month = 1; month <= duration; month++) {
    // reallocation
    let tax = 0
    if (reallocationOccurrence > 0 && month % reallocationOccurrence === 0) {
      const realizedGain = etfGain * reallocationRate
      tax
        = Math.max(0, realizedGain * partialExemption - taxAllowance)
          * capitalGainsTax
      etfGain -= realizedGain
    }

    // for etf
    const etfCost = etfBalance * ter
    const etfInterest = etfBalance * expectedInterest
    etfGain += etfInterest - etfCost
    etfBalance += savingRate - tax + etfInterest - etfCost
    if (month === 1)
      etfBalance += placementCommission

    // for policy
    const policyInterest = policyBalance * expectedInterest
    const policyCostAdministration
      = policyBalance * ter
        + Math.max(policyBalance * balanceCosts, minimumCosts)
        + fixedCosts
    const policyCostSaving = savingRate * savingRateCosts
    policyBalance
      += savingRate + policyInterest - policyCostAdministration - policyCostSaving
  }

  return { policyBalance, etfBalance, etfGain }
}

function calcTableData(
  policyGrossWorth: number,
  etfGrossWorth: number,
  etfGain: number,
  parsedQuery: NetPolicyQuery,
) {
  const {
    duration,
    savingRate,
    placementCommission,
    personalTaxRate,
    taxAllowance,
    capitalGainsTax,
    partialExemption,
    additionalIncome,
    useGrossToNet,
  } = parsedQuery

  const policyGross = ((policyGrossWorth - savingRate * duration) * 0.85) / 2
  const etfGross = Math.max(0, etfGain * partialExemption - taxAllowance)
  const policyTax = useGrossToNet
    ? calcPolicyTax(policyGross, additionalIncome)
    : policyGross * personalTaxRate

  return {
    grossWorth: {
      policy: formatNumber(policyGrossWorth),
      etf: formatNumber(etfGrossWorth),
    },
    totalPayments: {
      policy: formatNumber(savingRate * duration),
      etf: formatNumber(savingRate * duration + placementCommission),
    },
    gain: {
      policy: formatNumber(policyGrossWorth - savingRate * duration),
      etf: formatNumber(etfGain),
    },
    gross: {
      policy: formatNumber(policyGross),
      etf: formatNumber(etfGross),
    },
    tax: {
      policy: formatNumber(policyTax),
      etf: formatNumber(etfGross * capitalGainsTax),
    },
    netWorth: {
      policy: formatNumber(policyGrossWorth - policyTax),
      etf: formatNumber(etfGrossWorth - etfGross * capitalGainsTax),
    },
  }
}

function calcPolicyTax(policyGross: number, additionalIncome: number) {
  const sharedQuery = {
    inputPeriod: 1,
    inputAccountingYear: 2025,
    inputTaxClass: 1,
    inputTaxAllowance: 0,
    inputChurchTax: 0,
    inputState: 'Hamburg',
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
    inputActivateLevy: 0,
  }
  const correction
    = CORRECTION_VALUES.werbungskostenpauschale
      + CORRECTION_VALUES.arbeitslosenversicherung
      * Math.min(policyGross, CORRECTION_VALUES.beitragsbemessungsgrenze)
  const taxesWithPolicy = calcGrossToNet({
    ...sharedQuery,
    inputGrossWage: policyGross + correction + additionalIncome,
  }).outputTotalTaxesYear.replace('€', '')

  const taxesWithoutPolicy = calcGrossToNet({
    ...sharedQuery,
    inputGrossWage: additionalIncome + correction,
  }).outputTotalTaxesYear.replace('€', '')

  return formatInput(taxesWithPolicy) - formatInput(taxesWithoutPolicy)
}

function toMonthly(valuePerYear: number) {
  return valuePerYear / 12
}

function toPercentRate(value: number) {
  return value / 100
}

function toMonthlyConformalRate(valuePerYear: number) {
  return (1 + valuePerYear / 100) ** (1 / 12) - 1
}
