import { describe, expect, it } from 'vitest'
import { calcNetPolicy, NET_POLICY_QUERY_SCHEMA } from '../../src/calculators/net-policy'
import { stringifyValues } from '../utils'

const SHARED_QUERY = {
  savingRate: 250,
  taxAllowance: 1000,
  useGrossToNet: false,
  additionalIncome: 0,
  personalTaxRate: 35,
  capitalGainsTax: 26.375,

  placementCommission: 299,
  savingRateCosts: 4,
  balanceCosts: 0.22,
  minimumCosts: 30,

  ter: 0.15,
  expectedInterest: 7,
  partialExemption: 30,

  reallocationOccurrence: 10,
  reallocationRate: 40,
}

describe('calculators/net-policy', () => {
  it('should have correct table data', () => {
    const parsedQuery = NET_POLICY_QUERY_SCHEMA.parse(stringifyValues({
      ...SHARED_QUERY,
      duration: 35,
    }))

    const data = calcNetPolicy(parsedQuery)
    expect(data.tableData).toMatchSnapshot()
  })

  it('should work with fixed costs', () => {
    const parsedQuery = NET_POLICY_QUERY_SCHEMA.parse(stringifyValues({
      ...SHARED_QUERY,
      duration: 35,
      fixedCosts: 12,
    }))

    const data = calcNetPolicy(parsedQuery)

    expect(data.tableData.grossWorth.policy).toBe('374.366')
    expect(data.tableData.netWorth.policy).toBe('334.298')
  })

  it('should work with useGrossToNet', () => {
    const parsedQuery = NET_POLICY_QUERY_SCHEMA.parse(stringifyValues({
      ...SHARED_QUERY,
      duration: 35,
      useGrossToNet: true,
    }))

    const data = calcNetPolicy(parsedQuery)

    expect(data.tableData.tax.policy).toMatch(/^39/)
    expect(data.tableData.netWorth.policy).toMatch(/^33/)
  })
})
