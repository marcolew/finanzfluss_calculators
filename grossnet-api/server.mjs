import { grossToNet } from '@finanzfluss/calculators'
import cors from 'cors'
import express from 'express'
import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const app = express()
app.use(cors())
app.use(express.json())

// ---- OpenAPI (Swagger) ----
const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Gross→Net Calculator API',
    version: '1.0.0',
    description:
      'REST wrapper around @finanzfluss/calculators `grossToNet.validateAndCalculate`.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    schemas: {
      GrossToNetInput: {
        type: 'object',
        required: [
          'inputAccountingYear',
          'inputTaxClass',
          'inputTaxAllowance',
          'inputChurchTax',
          'inputState',
          'inputYearOfBirth',
          'inputChildren',
          'inputChildTaxAllowance',
          'inputPkvContribution',
          'inputEmployerSubsidy',
          'inputPensionInsurance',
          'inputLevyOne',
          'inputLevyTwo',
          'inputActivateLevy',
          'inputHealthInsurance',
          'inputAdditionalContribution',
          'inputGrossWage',
          'inputPeriod',
        ],
        properties: {
          inputAccountingYear: { type: 'string', example: '2025' },
          inputTaxClass: {
            type: 'integer',
            minimum: 1,
            maximum: 6,
            example: 1,
          },
          inputTaxAllowance: { type: 'number', example: 0 },
          inputChurchTax: {
            type: 'number',
            description: '0=no, 8=8%, 9=9%',
            example: 0,
          },
          inputState: { type: 'string', example: 'Hamburg' },
          inputYearOfBirth: { type: 'integer', example: 1990 },
          inputChildren: { type: 'integer', example: 0 },
          inputChildTaxAllowance: { type: 'number', example: 0 },
          inputPkvContribution: { type: 'number', example: 0 },
          inputEmployerSubsidy: { type: 'number', example: 0 },
          inputPensionInsurance: { type: 'number', example: 0 },
          inputLevyOne: { type: 'number', example: 0 },
          inputLevyTwo: { type: 'number', example: 0 },
          inputActivateLevy: { type: 'number', enum: [0, 1], example: 0 },
          inputHealthInsurance: { type: 'number', example: 0 },
          inputAdditionalContribution: { type: 'number', example: 1.7 },
          inputGrossWage: { type: 'number', example: 5000 },
          inputPeriod: {
            type: 'integer',
            enum: [1, 2],
            description: '1=yearly, 2=monthly',
            example: 2,
          },
        },
        additionalProperties: false,
      },
      GrossToNetResult: {
        type: 'object',
        properties: {
          outputResNetWageMonth: { type: 'number', example: 3200.55 },
          outputResNetWageYear: { type: 'number', example: 38406.6 },
        },
        additionalProperties: true,
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
      NetToGrossInput: {
        type: 'object',
        required: [
          'targetNet',
          'inputAccountingYear',
          'inputTaxClass',
          'inputTaxAllowance',
          'inputChurchTax',
          'inputState',
          'inputYearOfBirth',
          'inputChildren',
          'inputChildTaxAllowance',
          'inputPkvContribution',
          'inputEmployerSubsidy',
          'inputPensionInsurance',
          'inputLevyOne',
          'inputLevyTwo',
          'inputActivateLevy',
          'inputHealthInsurance',
          'inputAdditionalContribution',
        ],
        properties: {
          targetNet: {
            type: 'number',
            example: 3124.84,
            description: 'Ziel-Netto in EUR',
          },
          inputPeriod: {
            type: 'integer',
            enum: [1, 2],
            example: 2,
            description: '1=jährlich, 2=monatlich (bezieht sich auf targetNet)',
          },

          // Optionales Tuning für den Solver
          initialGuess: {
            type: 'number',
            example: 4200,
            description: 'Optionaler Startwert für Newton',
          },
          lowerBound: {
            type: 'number',
            example: 0,
            description: 'Untere Klammergrenze',
          },
          upperBound: {
            type: 'number',
            example: 100000,
            description: 'Obere Klammergrenze',
          },

          // Alle restlichen Eingaben (ohne inputGrossWage)
          inputAccountingYear: { type: 'string', example: '2025' },
          inputTaxClass: {
            type: 'integer',
            minimum: 1,
            maximum: 6,
            example: 1,
          },
          inputTaxAllowance: { type: 'number', example: 0 },
          inputChurchTax: {
            type: 'number',
            description: '0=no, 8=8%, 9=9%',
            example: 0,
          },
          inputState: { type: 'string', example: 'Hamburg' },
          inputYearOfBirth: { type: 'integer', example: 1990 },
          inputChildren: { type: 'integer', example: 0 },
          inputChildTaxAllowance: { type: 'number', example: 0 },
          inputPkvContribution: { type: 'number', example: 0 },
          inputEmployerSubsidy: { type: 'number', example: 0 },
          inputPensionInsurance: { type: 'number', example: 0 },
          inputLevyOne: { type: 'number', example: 0 },
          inputLevyTwo: { type: 'number', example: 0 },
          inputActivateLevy: { type: 'number', enum: [0, 1], example: 0 },
          inputHealthInsurance: { type: 'number', example: 0 },
          inputAdditionalContribution: { type: 'number', example: 1.7 },
        },
        additionalProperties: false,
      },

      NetToGrossResult: {
        type: 'object',
        description: 'Gefundenes Brutto + volles Ergebnisobjekt (Top-Level).',
        properties: {
          inputGrossWage: {
            type: 'number',
            example: 5000,
            description:
              'gefundenes Bruttogehalt (Periodenbezug siehe inputPeriod)',
          },
          iterations: { type: 'integer', example: 6 },
          residual: {
            type: 'number',
            example: 0.003,
            description: 'Abweichung in EUR vom Ziel-Netto bei Lösung',
          },
          // plus: alle Felder aus GrossToNetResult werden top-level hinzugefügt (keine extra Definition nötig dank ...result)
        },
        additionalProperties: true,
      },
    },
  },
  paths: {
    '/gross-to-net': {
      post: {
        summary: 'Calculate net wage from gross salary',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GrossToNetInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Successful calculation',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GrossToNetResult' },
              },
            },
          },
          400: {
            description: 'Validation / input error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/net-to-gross': {
      post: {
        summary: 'Invertiere Netto → Brutto via Newton-Verfahren',
        description:
          'Gibt das Bruttogehalt zurück, das zu einem Ziel-Netto führt (monatlich oder jährlich) und liefert zusätzlich das vollständige Ergebnisobjekt des Rechners.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NetToGrossInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Erfolgreich inversiert',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NetToGrossResult' },
              },
            },
          },
          400: {
            description: 'Validierungsfehler oder keine Konvergenz',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
}

const swaggerSpec = swaggerJSDoc({ definition: swaggerDefinition, apis: [] })
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ---- Routes ----
app.post('/gross-to-net', (req, res) => {
  try {
    // Let the library validate and compute
    const result = grossToNet.validateAndCalculate(req.body)

    return res.json(result)

    // You can return the whole result, or just selected fields:
    //return res.json({
    //  outputResNetWageMonth: result.outputResNetWageMonth,
    //  outputResNetWageYear: result.outputResNetWageYear,
    // expose full payload as needed:
    //  result,
    //})
  } catch (err) {
    // The library tends to throw on validation errors; normalize response
    const message = err?.message || 'Validation or calculation error'
    const details = Array.isArray(err?.errors) ? err.errors : undefined
    return res.status(400).json({ message, details })
  }
})

function parseEuroMaybe(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN
  const clean = value
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '') // remove thousand dots
    .replace(/,/g, '.') // convert decimal comma
  const n = Number(clean)
  return Number.isFinite(n) ? n : Number.NaN
}

function getNetFromResult(result, period /* 1=year, 2=month */) {
  const v =
    period === 1 ? result.outputResNetWageYear : result.outputResNetWageMonth
  const n = parseEuroMaybe(v)
  if (!Number.isFinite(n)) {
    throw new TypeError('Could not parse net wage from calculator result.')
  }
  return n
}

// Newton-Raphson to solve f(gross) = net(gross) - target = 0
async function solveGrossForNet({
  baseInput, // all fields except inputGrossWage
  targetNet, // numeric net target
  period, // 1=year, 2=month (must match baseInput.inputPeriod)
  x0, // initial guess for gross
  maxIter = 900,
  tol = 0.01, // € tolerance
  bounds = [0, 1_000_000],
}) {
  // clamp helper
  const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x))

  // function f(x) = net(x) - target
  const f = (x) => {
    const input = { ...baseInput, inputGrossWage: x }
    const r = grossToNet.validateAndCalculate(input)
    return getNetFromResult(r, period) - targetNet
  }

  // pick a sensible default initial guess if not provided
  let x = x0 ?? clamp(targetNet / 0.75, bounds) // heuristics: ~25% deductions

  // small step for numerical derivative
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x)
    if (Math.abs(fx) <= tol) {
      const result = grossToNet.validateAndCalculate({
        ...baseInput,
        inputGrossWage: x,
      })
      return { gross: x, result, iterations: i, residual: fx }
    }

    // central difference slope
    const h = Math.max(1, Math.abs(x) * 0.001)
    const fph = f(x + h)
    const fmh = f(x - h)
    const dfx = (fph - fmh) / (2 * h)

    // if derivative is tiny or NaN, nudge x
    if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-9) {
      x = clamp(x + Math.sign(fx) * 100, bounds)
      continue
    }

    // Newton step
    let xNext = x - fx / dfx

    // keep inside bounds; if bounce occurs, dampen
    if (xNext < bounds[0] || xNext > bounds[1]) {
      xNext = clamp((x + clamp(xNext, bounds)) / 2, bounds)
    }

    // if step is too tiny but not converged, enlarge slightly
    if (Math.abs(xNext - x) < 1e-6) {
      xNext = x + (fx > 0 ? -10 : 10)
    }

    x = xNext
  }

  // if we reach here, did not converge within maxIter
  throw new Error('Newton solver did not converge to desired tolerance.')
}

// --------- ROUTE: NET -> GROSS -----------
/**
 * Body schema: NetToGrossInput (see Swagger below)
 * - Provide all the same inputs as for /gross-to-net EXCEPT inputGrossWage.
 * - Provide targetNet and (optionally) inputPeriod (1=year, 2=month).
 *   If inputPeriod omitted, we default to 2 (monthly), consistent with your example.
 */
app.post('/net-to-gross', async (req, res) => {
  try {
    const {
      // target
      targetNet,
      // either provide inputPeriod or inherit from request, default monthly
      inputPeriod = 2,
      // optional: initialGuess and bounds for solver
      initialGuess,
      lowerBound,
      upperBound,
      // the rest mirrors GrossToNetInput EXCEPT inputGrossWage
      inputAccountingYear,
      inputTaxClass,
      inputTaxAllowance,
      inputChurchTax,
      inputState,
      inputYearOfBirth,
      inputChildren,
      inputChildTaxAllowance,
      inputPkvContribution,
      inputEmployerSubsidy,
      inputPensionInsurance,
      inputLevyOne,
      inputLevyTwo,
      inputActivateLevy,
      inputHealthInsurance,
      inputAdditionalContribution,
    } = req.body || {}

    if (!Number.isFinite(targetNet) || targetNet <= 0) {
      return res.status(400).json({
        message: 'targetNet must be a positive number (EUR).',
      })
    }

    const baseInput = {
      inputAccountingYear,
      inputTaxClass,
      inputTaxAllowance,
      inputChurchTax,
      inputState,
      inputYearOfBirth,
      inputChildren,
      inputChildTaxAllowance,
      inputPkvContribution,
      inputEmployerSubsidy,
      inputPensionInsurance,
      inputLevyOne,
      inputLevyTwo,
      inputActivateLevy,
      inputHealthInsurance,
      inputAdditionalContribution,
      inputPeriod, // 1=yearly, 2=monthly
    }

    // Let the library validate base inputs first with a placeholder gross
    grossToNet.validateAndCalculate({ ...baseInput, inputGrossWage: 1000 })

    const bounds = [
      Number.isFinite(lowerBound) ? Math.max(0, lowerBound) : 0,
      Number.isFinite(upperBound) ? Math.max(10_000, upperBound) : 1_000_000,
    ]

    const { gross, result, iterations, residual } = await solveGrossForNet({
      baseInput,
      targetNet,
      period: inputPeriod,
      x0: Number.isFinite(initialGuess) ? initialGuess : undefined,
      bounds,
    })

    res.json({
      inputGrossWage: gross,
      iterations,
      residual,
      // full calculator output at the found gross (top-level, as gewünscht)
      ...result,
    })
  } catch (err) {
    const message = err?.message || 'Failed to invert net→gross.'
    const details = Array.isArray(err?.errors) ? err.errors : undefined
    return res.status(400).json({ message, details })
  }
})

// Basic health check
app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Gross→Net API listening on http://localhost:${PORT}`)
  console.log(`Swagger UI: http://localhost:${PORT}/docs`)
})
