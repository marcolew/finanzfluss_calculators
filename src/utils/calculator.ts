import type { z } from 'zod'

export function defineCalculator<
  Schema extends z.core.$ZodShape,
  Output,
>(config: {
  schema: z.ZodObject<Schema>
  calculate: (input: z.output<z.ZodObject<Schema>>) => Output
}) {
  return {
    ...config,
    validateAndCalculate: (rawInput: unknown): Output => {
      const parsed = config.schema.parse(rawInput)
      return config.calculate(parsed)
    },
  }
}
