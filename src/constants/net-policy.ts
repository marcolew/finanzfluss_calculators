/**
 * These values are added artificially to offset automatic deductions (such as lump sums and costs)
 * made by the gross-net calculator, which are not relevant for our policy tax calculations.
 * By adding them here, the calculator will subtract them again, resulting in the correct values for our use case.
 * Values as of 2025.
 */
export const CORRECTION_VALUES = {
  werbungskostenpauschale: 1_230,
  beitragsbemessungsgrenze: 96_600,
  arbeitslosenversicherung: 0.013,
} as const
