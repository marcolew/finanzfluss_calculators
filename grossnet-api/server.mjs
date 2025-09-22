import process from 'node:process'
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

      BenefitsInput: {
        type: 'object',
        properties: {
          inputBikeleasing: { type: 'number', example: 0 },
          inputGasolineCard: { type: 'number', example: 0 },
          inputECarLoadingCard: { type: 'number', example: 0 },
          inputCarsharingCard: { type: 'number', example: 0 },
          inputDeutschlandticket: { type: 'number', example: 0 },
          inputCarsharingSupplement: { type: 'number', example: 0 },
          inputindivisualMobility: { type: 'number', example: 0 },
          inputFoodBenefit: { type: 'number', example: 0 },
          inputTelephone: { type: 'number', example: 0 },
          inputInternet: { type: 'number', example: 0 },
          inputRecovery: { type: 'number', example: 0 },
        },
        additionalProperties: false,
      },

      BenefitsResult: {
        type: 'object',
        properties: {
          outputNetValue: { type: 'number', example: 0 },
          outputEmployerCosts: { type: 'number', example: 0 },
          outputEmployerTax: { type: 'number', example: 0 },
        },
        additionalProperties: false,
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

    '/benefits': {
      post: {
        summary: 'Calculate benefits aggregation',
        description:
          'Accepts benefit inputs (net values). Rules: (1) If sum of all benefits (excluding Deutschlandticket and any category exactly 50€ except telephone, internet, recovery) ≤ 50€, employer tax = 0. (2) If that sum > 50€, the full remaining amounts are taxable. (3) Deutschlandticket is tax-free. (4) Any single category that is exactly 50€ is tax-free, except telephone, internet, and recovery. (5) Employer tax rates: 30% for bikeleasing, gasoline/e-car loading card, carsharing card/supplement, individual mobility; 25% for food, telephone, internet, recovery.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BenefitsInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Aggregated benefits result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BenefitsResult' },
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
  },
}

const swaggerSpec = swaggerJSDoc({ definition: swaggerDefinition, apis: [] })
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

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

// Safeguarded Newton to solve f(gross) = net(gross) - target = 0
// Gibt immer ein Ergebnis zurück. Bei Nicht-Konvergenz: status = "best_effort".
async function solveGrossForNet({
  baseInput,
  targetNet,
  period, // 1=year, 2=month (muss zu baseInput.inputPeriod passen)
  x0, // initial guess
  maxIter = 900,
  tol = 0.01, // €-Toleranz
  bounds = [0, 1_000_000],
}) {
  const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x))

  // robuste f(x) mit Try/Catch
  const f = (x) => {
    try {
      const input = { ...baseInput, inputGrossWage: x }
      const r = grossToNet.validateAndCalculate(input)
      return getNetFromResult(r, period) - targetNet
    } catch {
      // „schlechter“ Wert, zwingt den Solver zum Wegbewegen
      return Number.NaN
    }
  }

  // Hilfsfunktion: sichere Auswertung + NaN-Handling
  const fSafe = (x) => {
    const y = f(x)
    if (!Number.isFinite(y)) return { ok: false, fx: Number.NaN }
    return { ok: true, fx: y }
  }

  // Startwert (Heuristik: ~25% Abzüge)
  let x = x0 ?? clamp(targetNet / 0.75, bounds)

  // Track bestes Ergebnis
  let best = { x, fx: Number.POSITIVE_INFINITY, iter: 0 }

  // Optional: Bracket versuchen (nützlich für Bisektion)
  let [lo, hi] = bounds
  let flo = f(lo)
  let fhi = f(hi)
  let haveBracket =
    Number.isFinite(flo) &&
    Number.isFinite(fhi) &&
    Math.sign(flo) !== Math.sign(fhi)

  // Hauptschleife: Safeguarded Newton + fallback
  for (let i = 0; i < maxIter; i++) {
    // 1) Prüfe aktuelle Güte
    const { ok, fx } = fSafe(x)
    if (ok) {
      const absFx = Math.abs(fx)
      if (absFx < Math.abs(best.fx)) best = { x, fx, iter: i }

      if (absFx <= tol) {
        const result = grossToNet.validateAndCalculate({
          ...baseInput,
          inputGrossWage: x,
        })
        return {
          gross: x,
          result,
          iterations: i,
          residual: fx,
          status: 'converged',
          method: 'newton',
        }
      }

      // 2) Versuche Schachtelung upzudaten (für Bisektion)
      if (haveBracket) {
        if (fx > 0) {
          hi = x
          fhi = fx
        } else {
          lo = x
          flo = fx
        }
        haveBracket = Math.sign(flo) !== Math.sign(fhi)
      } else {
        // wenn noch kein Bracket: versuche eins zu finden, indem wir die Bounds leicht ausnutzen
        if (
          Number.isFinite(flo) &&
          Number.isFinite(fx) &&
          Math.sign(flo) !== Math.sign(fx)
        ) {
          hi = x
          fhi = fx
          haveBracket = true
        } else if (
          Number.isFinite(fhi) &&
          Number.isFinite(fx) &&
          Math.sign(fhi) !== Math.sign(fx)
        ) {
          lo = x
          flo = fx
          haveBracket = true
        }
      }
    }

    // 3) Newton-Schritt (zentrale Differenz), wenn möglich
    let tookStep = false
    if (ok) {
      const h = Math.max(1, Math.abs(x) * 0.001)
      const fph = f(x + h)
      const fmh = f(x - h)
      const dfx = (fph - fmh) / (2 * h)

      if (Number.isFinite(dfx) && Math.abs(dfx) >= 1e-9) {
        let xNext = x - fx / dfx

        // in Bounds halten; bei Bounce dämpfen
        if (xNext < bounds[0] || xNext > bounds[1]) {
          xNext = clamp((x + clamp(xNext, bounds)) / 2, bounds)
        }

        // Mikroschritt? leicht vergrößern
        if (Math.abs(xNext - x) < 1e-6) {
          xNext = clamp(x + (fx > 0 ? -10 : 10), bounds)
        }

        // Wenn Bracket existiert und Newton rausspringt, nutze Sekante innerhalb [lo, hi]
        if (haveBracket && (xNext <= lo || xNext >= hi)) {
          // Sekante innerhalb des Brackets
          const denom = fhi - flo
          if (Number.isFinite(denom) && Math.abs(denom) > 0) {
            xNext = clamp(hi - (fhi * (hi - lo)) / denom, [lo, hi])
          } else {
            xNext = (lo + hi) / 2 // fallback Bisektion
          }
        }

        x = xNext
        tookStep = true
      }
    }

    // 4) Wenn Newton nicht möglich war: Hybrid-Fallback
    if (!tookStep) {
      if (haveBracket) {
        // Bevorzuge Sekante; wenn degeneriert, Bisection
        const denom = fhi - flo
        let xNext
        if (Number.isFinite(denom) && Math.abs(denom) > 0) {
          xNext = clamp(hi - (fhi * (hi - lo)) / denom, [lo, hi])
        } else {
          xNext = (lo + hi) / 2
        }
        x = xNext
      } else {
        // Kein Bracket: vorsichtig nudgen in Richtung abnehmender |f|
        const step = Number.isFinite(best.fx) && best.fx > 0 ? -100 : 100
        x = clamp(x + step, bounds)
      }
    }
  }

  // Nicht konvergiert: best effort zurückgeben
  const result = grossToNet.validateAndCalculate({
    ...baseInput,
    inputGrossWage: best.x,
  })
  return {
    gross: best.x,
    result,
    iterations: maxIter,
    residual: best.fx,
    status: 'best_effort',
    method: 'hybrid',
    note: 'Maximale Iterationen erreicht; bestes gefundenes Ergebnis zurückgegeben.',
  }
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

// --------- ROUTE: BENEFITS AGGREGATION -----------
app.post('/benefits', (req, res) => {
  try {
    const {
      inputBikeleasing,
      inputGasolineCard,
      inputECarLoadingCard,
      inputCarsharingCard,
      inputDeutschlandticket,
      inputCarsharingSupplement,
      inputindivisualMobility,
      inputFoodBenefit,
      inputTelephone,
      inputInternet,
      inputRecovery,
    } = req.body || {}

    const parsed = {
      bikeleasing: parseEuroMaybe(inputBikeleasing) || 0,
      gasolineCard: parseEuroMaybe(inputGasolineCard) || 0,
      eCarLoadingCard: parseEuroMaybe(inputECarLoadingCard) || 0,
      carsharingCard: parseEuroMaybe(inputCarsharingCard) || 0,
      deutschlandticket: parseEuroMaybe(inputDeutschlandticket) || 0,
      carsharingSupplement: parseEuroMaybe(inputCarsharingSupplement) || 0,
      indivisualMobility: parseEuroMaybe(inputindivisualMobility) || 0,
      foodBenefit: parseEuroMaybe(inputFoodBenefit) || 0,
      telephone: parseEuroMaybe(inputTelephone) || 0,
      internet: parseEuroMaybe(inputInternet) || 0,
      recovery: parseEuroMaybe(inputRecovery) || 0,
    }

    const values = Object.values(parsed)
    if (values.some((n) => !Number.isFinite(n) || n < 0)) {
      return res
        .status(400)
        .json({ message: 'All inputs must be non-negative numbers.' })
    }

    const totalNet = values.reduce((a, b) => a + b, 0)

    const isFifty = (n) => Math.abs(n - 50) < 1e-9

    const adjustedForThreshold =
      parsed.bikeleasing +
      parsed.gasolineCard +
      parsed.eCarLoadingCard +
      parsed.carsharingCard +
      parsed.carsharingSupplement +
      parsed.indivisualMobility +
      (isFifty(parsed.foodBenefit) ? 0 : parsed.foodBenefit) +
      parsed.telephone +
      parsed.internet +
      parsed.recovery

    const thresholdApplies = adjustedForThreshold <= 50

    let employerTax = 0
    if (!thresholdApplies) {
      const rate30 =
        parsed.bikeleasing +
        parsed.gasolineCard +
        parsed.eCarLoadingCard +
        parsed.carsharingCard +
        parsed.carsharingSupplement +
        parsed.indivisualMobility

      const base25 =
        (isFifty(parsed.foodBenefit) ? 0 : parsed.foodBenefit) +
        parsed.telephone +
        parsed.internet +
        parsed.recovery

      const tax30 = rate30 * 0.3
      const tax25 = base25 * 0.25
      employerTax = tax30 + tax25
    }

    const outputEmployerTax =
      Math.round((employerTax + Number.EPSILON) * 100) / 100
    const outputNetValue = Math.round((totalNet + Number.EPSILON) * 100) / 100
    const outputEmployerCosts =
      Math.round((totalNet + outputEmployerTax + Number.EPSILON) * 100) / 100

    return res.json({ outputNetValue, outputEmployerCosts, outputEmployerTax })
  } catch (err) {
    const message = err?.message || 'Failed to calculate benefits.'
    return res.status(400).json({ message })
  }
})

// Basic health check
app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.warn(`Gross→Net API listening on http://localhost:${PORT}`)
  console.warn(`Swagger UI: http://localhost:${PORT}/docs`)
})
