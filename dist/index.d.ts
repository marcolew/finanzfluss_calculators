import { z } from "zod";
import Dinero from "dinero.js";

//#region src/calculators/compound-interest.d.ts
declare const compoundInterest: {
  validateAndCalculate: (rawInput: unknown) => {
    finalCapital: string;
    totalPayments: string;
    totalInterest: string;
    diagramData: {
      CAPITAL_LIST: number[];
      INTEREST_LIST: number[];
      LAST_CAPITAL: string;
      LAST_INTEREST: string;
      TOTAL_CAPITAL: string;
    };
  };
  schema: z.ZodObject<{
    startCapital: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    monthlyPayment: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    durationYears: z.ZodNumber;
    yearlyInterest: z.ZodEffects<z.ZodNumber, number, number>;
    type: z.ZodEnum<["monthly", "quarterly", "yearly"]>;
  }, z.UnknownKeysParam, z.ZodTypeAny, {
    type: "monthly" | "quarterly" | "yearly";
    startCapital: Dinero.Dinero;
    monthlyPayment: Dinero.Dinero;
    durationYears: number;
    yearlyInterest: number;
  }, {
    type: "monthly" | "quarterly" | "yearly";
    startCapital: number;
    monthlyPayment: number;
    durationYears: number;
    yearlyInterest: number;
  }>;
  calculate: (input: {
    type: "monthly" | "quarterly" | "yearly";
    startCapital: Dinero.Dinero;
    monthlyPayment: Dinero.Dinero;
    durationYears: number;
    yearlyInterest: number;
  }) => {
    finalCapital: string;
    totalPayments: string;
    totalInterest: string;
    diagramData: {
      CAPITAL_LIST: number[];
      INTEREST_LIST: number[];
      LAST_CAPITAL: string;
      LAST_INTEREST: string;
      TOTAL_CAPITAL: string;
    };
  };
};
//#endregion
//#region src/calculators/gross-to-net.d.ts
declare const grossToNet: {
  validateAndCalculate: (rawInput: unknown) => {
    outputResGrossWageMonth: string;
    outputResGrossWageYear: string;
    outputResIncomeTaxMonth: string;
    outputResIncomeTaxYear: string;
    outputResSolidaritySurchargeMonth: string;
    outputResSolidaritySurchargeYear: string;
    outputResChurchTaxPercentage: string;
    outputResChurchTaxMonth: string;
    outputResChurchTaxYear: string;
    outputTotalTaxes: string;
    outputTotalTaxesYear: string;
    outputResHealthInsurancePercentage: string;
    outputResHealthInsuranceMonth: string;
    outputResHealthInsuranceYear: string;
    outputResPrivateHealthInsuranceEmployerMonth: string;
    outputResPrivateHealthInsuranceEmployerYear: string;
    outputDisableResCareInsurance: boolean;
    outputResCareInsurancePercentage: string;
    outputResCareInsuranceMonth: string;
    outputResCareInsuranceYear: string;
    outputResPensionInsurancePercentage: string;
    outputResPensionInsuranceMonth: string;
    outputResPensionInsuranceYear: string;
    outputResUnemploymentInsurancePercentage: string;
    outputResUnemploymentInsuranceMonth: string;
    outputResUnemploymentInsuranceYear: string;
    outputTotalInsurances: string;
    outputTotalInsurancesYear: string;
    outputResNetWageMonth: string;
    outputResNetWageYear: string;
    outputResEmployerHealthInsuranceMonth: string;
    outputResEmployerHealthInsuranceYear: string;
    outputResEmployerCareInsuranceMonth: string;
    outputResEmployerCareInsuranceYear: string;
    outputResEmployerPensionInsuranceMonth: string;
    outputResEmployerPensionInsuranceYear: string;
    outputResEmployerUnemploymentInsuranceMonth: string;
    outputResEmployerUnemploymentInsuranceYear: string;
    outputResEmployerHealthInsurancePercentage: string;
    outputResEmployerCareInsurancePercentage: string;
    outputResEmployerPensionInsurancePercentage: string;
    outputResEmployerUnemploymentInsurancePercentage: string;
    outputEmployerTotalInsurances: string;
    outputEmployerTotalInsurancesYear: string;
    outputResEmployerLevyOneMonth: string;
    outputResEmployerLevyOneYear: string;
    outputResEmployerLevyTwoMonth: string;
    outputResEmployerLevyTwoYear: string;
    outputResEmployerLevyThreeMonth: string;
    outputResEmployerLevyThreeYear: string;
    outputResEmployerLevyTotal: string;
    outputResEmployerLevyTotalYear: string;
    outputResEmployerGrossWageMonth: string;
    outputResEmployerGrossWageYear: string;
  };
  schema: z.ZodObject<{
    output: z.ZodOptional<z.ZodLiteral<"grossToNetCalc">>;
    inputAccountingYear: z.ZodEffects<z.ZodEnum<["2019", "2020", "2021", "2022", "2023", "2024", "2025"]>, number, "2019" | "2020" | "2021" | "2022" | "2023" | "2024" | "2025">;
    inputTaxClass: z.ZodNumber;
    inputTaxAllowance: z.ZodNumber;
    inputChurchTax: z.ZodNumber;
    inputState: z.ZodString;
    inputYearOfBirth: z.ZodNumber;
    inputChildren: z.ZodDefault<z.ZodNumber>;
    inputChildTaxAllowance: z.ZodNumber;
    inputPkvContribution: z.ZodNumber;
    inputEmployerSubsidy: z.ZodNumber;
    inputPensionInsurance: z.ZodNumber;
    inputLevyOne: z.ZodNumber;
    inputLevyTwo: z.ZodNumber;
    inputActivateLevy: z.ZodNumber;
    inputHealthInsurance: z.ZodNumber;
    inputAdditionalContribution: z.ZodNumber;
    inputGrossWage: z.ZodNumber;
    inputPeriod: z.ZodNumber;
  }, z.UnknownKeysParam, z.ZodTypeAny, {
    inputAccountingYear: number;
    inputTaxClass: number;
    inputTaxAllowance: number;
    inputChurchTax: number;
    inputState: string;
    inputYearOfBirth: number;
    inputChildren: number;
    inputChildTaxAllowance: number;
    inputPkvContribution: number;
    inputEmployerSubsidy: number;
    inputPensionInsurance: number;
    inputLevyOne: number;
    inputLevyTwo: number;
    inputActivateLevy: number;
    inputHealthInsurance: number;
    inputAdditionalContribution: number;
    inputGrossWage: number;
    inputPeriod: number;
    output?: "grossToNetCalc" | undefined;
  }, {
    inputAccountingYear: "2019" | "2020" | "2021" | "2022" | "2023" | "2024" | "2025";
    inputTaxClass: number;
    inputTaxAllowance: number;
    inputChurchTax: number;
    inputState: string;
    inputYearOfBirth: number;
    inputChildTaxAllowance: number;
    inputPkvContribution: number;
    inputEmployerSubsidy: number;
    inputPensionInsurance: number;
    inputLevyOne: number;
    inputLevyTwo: number;
    inputActivateLevy: number;
    inputHealthInsurance: number;
    inputAdditionalContribution: number;
    inputGrossWage: number;
    inputPeriod: number;
    output?: "grossToNetCalc" | undefined;
    inputChildren?: number | undefined;
  }>;
  calculate: (input: {
    inputAccountingYear: number;
    inputTaxClass: number;
    inputTaxAllowance: number;
    inputChurchTax: number;
    inputState: string;
    inputYearOfBirth: number;
    inputChildren: number;
    inputChildTaxAllowance: number;
    inputPkvContribution: number;
    inputEmployerSubsidy: number;
    inputPensionInsurance: number;
    inputLevyOne: number;
    inputLevyTwo: number;
    inputActivateLevy: number;
    inputHealthInsurance: number;
    inputAdditionalContribution: number;
    inputGrossWage: number;
    inputPeriod: number;
    output?: "grossToNetCalc" | undefined;
  }) => {
    outputResGrossWageMonth: string;
    outputResGrossWageYear: string;
    outputResIncomeTaxMonth: string;
    outputResIncomeTaxYear: string;
    outputResSolidaritySurchargeMonth: string;
    outputResSolidaritySurchargeYear: string;
    outputResChurchTaxPercentage: string;
    outputResChurchTaxMonth: string;
    outputResChurchTaxYear: string;
    outputTotalTaxes: string;
    outputTotalTaxesYear: string;
    outputResHealthInsurancePercentage: string;
    outputResHealthInsuranceMonth: string;
    outputResHealthInsuranceYear: string;
    outputResPrivateHealthInsuranceEmployerMonth: string;
    outputResPrivateHealthInsuranceEmployerYear: string;
    outputDisableResCareInsurance: boolean;
    outputResCareInsurancePercentage: string;
    outputResCareInsuranceMonth: string;
    outputResCareInsuranceYear: string;
    outputResPensionInsurancePercentage: string;
    outputResPensionInsuranceMonth: string;
    outputResPensionInsuranceYear: string;
    outputResUnemploymentInsurancePercentage: string;
    outputResUnemploymentInsuranceMonth: string;
    outputResUnemploymentInsuranceYear: string;
    outputTotalInsurances: string;
    outputTotalInsurancesYear: string;
    outputResNetWageMonth: string;
    outputResNetWageYear: string;
    outputResEmployerHealthInsuranceMonth: string;
    outputResEmployerHealthInsuranceYear: string;
    outputResEmployerCareInsuranceMonth: string;
    outputResEmployerCareInsuranceYear: string;
    outputResEmployerPensionInsuranceMonth: string;
    outputResEmployerPensionInsuranceYear: string;
    outputResEmployerUnemploymentInsuranceMonth: string;
    outputResEmployerUnemploymentInsuranceYear: string;
    outputResEmployerHealthInsurancePercentage: string;
    outputResEmployerCareInsurancePercentage: string;
    outputResEmployerPensionInsurancePercentage: string;
    outputResEmployerUnemploymentInsurancePercentage: string;
    outputEmployerTotalInsurances: string;
    outputEmployerTotalInsurancesYear: string;
    outputResEmployerLevyOneMonth: string;
    outputResEmployerLevyOneYear: string;
    outputResEmployerLevyTwoMonth: string;
    outputResEmployerLevyTwoYear: string;
    outputResEmployerLevyThreeMonth: string;
    outputResEmployerLevyThreeYear: string;
    outputResEmployerLevyTotal: string;
    outputResEmployerLevyTotalYear: string;
    outputResEmployerGrossWageMonth: string;
    outputResEmployerGrossWageYear: string;
  };
};
declare function isNewFederalState(state: string): boolean;
//#endregion
//#region src/calculators/net-policy.d.ts
declare const netPolicy: {
  validateAndCalculate: (rawInput: unknown) => {
    tableData: {
      grossWorth: {
        policy: string;
        etf: string;
      };
      totalPayments: {
        policy: string;
        etf: string;
      };
      gain: {
        policy: string;
        etf: string;
      };
      gross: {
        policy: string;
        etf: string;
      };
      tax: {
        policy: string;
        etf: string;
      };
      netWorth: {
        policy: string;
        etf: string;
      };
    };
  };
  schema: z.ZodObject<{
    savingRate: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    duration: z.ZodEffects<z.ZodNumber, number, number>;
    taxAllowance: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    additionalIncome: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    capitalGainsTax: z.ZodEffects<z.ZodNumber, number, number>;
    placementCommission: z.ZodEffects<z.ZodNumber, Dinero.Dinero, number>;
    savingRateCosts: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>;
    balanceCosts: z.ZodEffects<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>, number, number | undefined>;
    fixedCosts: z.ZodEffects<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>, Dinero.Dinero, number | undefined>;
    minimumCosts: z.ZodEffects<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>, Dinero.Dinero, number | undefined>;
    ter: z.ZodEffects<z.ZodEffects<z.ZodNumber, number, number>, number, number>;
    expectedInterest: z.ZodEffects<z.ZodNumber, number, number>;
    partialExemption: z.ZodEffects<z.ZodEffects<z.ZodNumber, number, number>, number, number>;
    reallocationOccurrence: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>;
    reallocationRate: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodNumber>>, number, number | undefined>;
  }, z.UnknownKeysParam, z.ZodTypeAny, {
    savingRate: Dinero.Dinero;
    duration: number;
    taxAllowance: Dinero.Dinero;
    additionalIncome: Dinero.Dinero;
    capitalGainsTax: number;
    placementCommission: Dinero.Dinero;
    savingRateCosts: number;
    balanceCosts: number;
    fixedCosts: Dinero.Dinero;
    minimumCosts: Dinero.Dinero;
    ter: number;
    expectedInterest: number;
    partialExemption: number;
    reallocationOccurrence: number;
    reallocationRate: number;
  }, {
    savingRate: number;
    duration: number;
    taxAllowance: number;
    additionalIncome: number;
    capitalGainsTax: number;
    placementCommission: number;
    ter: number;
    expectedInterest: number;
    partialExemption: number;
    savingRateCosts?: number | undefined;
    balanceCosts?: number | undefined;
    fixedCosts?: number | undefined;
    minimumCosts?: number | undefined;
    reallocationOccurrence?: number | undefined;
    reallocationRate?: number | undefined;
  }>;
  calculate: (input: {
    savingRate: Dinero.Dinero;
    duration: number;
    taxAllowance: Dinero.Dinero;
    additionalIncome: Dinero.Dinero;
    capitalGainsTax: number;
    placementCommission: Dinero.Dinero;
    savingRateCosts: number;
    balanceCosts: number;
    fixedCosts: Dinero.Dinero;
    minimumCosts: Dinero.Dinero;
    ter: number;
    expectedInterest: number;
    partialExemption: number;
    reallocationOccurrence: number;
    reallocationRate: number;
  }) => {
    tableData: {
      grossWorth: {
        policy: string;
        etf: string;
      };
      totalPayments: {
        policy: string;
        etf: string;
      };
      gain: {
        policy: string;
        etf: string;
      };
      gross: {
        policy: string;
        etf: string;
      };
      tax: {
        policy: string;
        etf: string;
      };
      netWorth: {
        policy: string;
        etf: string;
      };
    };
  };
};
//#endregion
//#region src/utils/calculator.d.ts
declare function defineCalculator<Schema extends z.core.$ZodShape, Output>(config: {
  schema: z.ZodObject<Schema>;
  calculate: (input: z.output<z.ZodObject<Schema>>) => Output;
}): {
  validateAndCalculate: (rawInput: unknown) => Output;
  schema: z.ZodObject<Schema>;
  calculate: (input: z.output<z.ZodObject<Schema>>) => Output;
};
//#endregion
export { compoundInterest, defineCalculator, grossToNet, isNewFederalState, netPolicy };