import type { ConversionModelStatus } from '../../../app/types/conversion-model'
import type { RegardingType } from '../../../app/types/interaction'
import type { OpportunitySuggestion, SuggestionUrgency } from '../../../app/types/opportunity-suggestion'
import type { LogisticRegressionModel } from './logisticRegression'
import { predictProbability, trainLogisticRegression } from './logisticRegression'

const CONVERSION_MODEL_ID = 'conversion-v1'

/**
 * Below this many decided (won/lost) examples, a logistic regression's coefficients are unstable
 * and effectively overfit — better to suppress the win-probability signal entirely than serve a
 * number that looks authoritative but isn't.
 */
const MIN_TRAINING_EXAMPLES = 20

/** Days since last contact before a suggestion nudges "follow up" / "going cold". */
const STALE_FOLLOW_UP_DAYS = 14
const STALE_HIGH_RISK_DAYS = 30

const MAX_SOURCE_VOCAB = 8

interface StoredConversionModel {
  logisticRegression: LogisticRegressionModel
  sourceVocab: string[]
}

interface OpportunityRow {
  id: string
  kind: 'lead' | 'tender'
  source: string | null
  estimated_value: number | null
  created_at: string
  updated_at: string
  stage: string
}

function normalizeSource(source: string | null | undefined): string | null {
  const trimmed = source?.trim().toLowerCase()
  return trimmed || null
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  return Math.max(0, ms / (1000 * 60 * 60 * 24))
}

function buildFeatureVector(input: {
  isTender: boolean
  estimatedValue: number | null
  daysInPipeline: number
  daysSinceLastContact: number
  interactionCount: number
  source: string | null
}, sourceVocab: string[]): number[] {
  const normalizedSource = normalizeSource(input.source)
  return [
    input.isTender ? 1 : 0,
    Math.log1p(input.estimatedValue ?? 0),
    input.daysInPipeline,
    input.daysSinceLastContact,
    input.interactionCount,
    ...sourceVocab.map(candidate => (normalizedSource === candidate ? 1 : 0)),
  ]
}

async function loadInteractionStats(regardingType: RegardingType, regardingId: string, cutoffIso: string): Promise<{ count: number, lastOccurredAt: string | null }> {
  const db = useDatabase()
  const row = await db.prepare(`
    SELECT COUNT(*) AS count, MAX(occurred_at) AS last_occurred_at
    FROM interactions
    WHERE regarding_type = ? AND regarding_id = ? AND occurred_at <= ?
  `).get(regardingType, regardingId, cutoffIso) as { count: string | number, last_occurred_at: string | null }

  return { count: Number(row.count), lastOccurredAt: row.last_occurred_at }
}

async function loadDecidedOpportunities(): Promise<OpportunityRow[]> {
  const db = useDatabase()

  const leadRows = await db.prepare(`
    SELECT id, source, estimated_value, created_at, updated_at, stage
    FROM leads WHERE stage IN ('won', 'lost')
  `).all() as Omit<OpportunityRow, 'kind'>[]

  const tenderRows = await db.prepare(`
    SELECT id, source, estimated_value, created_at, updated_at, stage
    FROM tenders WHERE stage IN ('won', 'lost')
  `).all() as Omit<OpportunityRow, 'kind'>[]

  return [
    ...leadRows.map(row => ({ ...row, kind: 'lead' as const })),
    ...tenderRows.map(row => ({ ...row, kind: 'tender' as const })),
  ]
}

async function buildTrainingSet(): Promise<{ rows: number[][], labels: number[], sourceVocab: string[] }> {
  const opportunities = await loadDecidedOpportunities()

  const sourceCounts = new Map<string, number>()
  for (const opportunity of opportunities) {
    const normalized = normalizeSource(opportunity.source)
    if (normalized)
      sourceCounts.set(normalized, (sourceCounts.get(normalized) ?? 0) + 1)
  }
  const sourceVocab = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SOURCE_VOCAB)
    .map(([source]) => source)

  const rows: number[][] = []
  const labels: number[] = []

  for (const opportunity of opportunities) {
    // Cutoff is the record's own updated_at as a proxy for "when it was decided" — there's no
    // separate decided-at timestamp, and stage history isn't logged, so this is an approximation.
    const stats = await loadInteractionStats(opportunity.kind, opportunity.id, opportunity.updated_at)
    const daysInPipeline = daysBetween(opportunity.created_at, opportunity.updated_at)
    const daysSinceLastContact = stats.lastOccurredAt ? daysBetween(stats.lastOccurredAt, opportunity.updated_at) : daysInPipeline

    rows.push(buildFeatureVector({
      isTender: opportunity.kind === 'tender',
      estimatedValue: opportunity.estimated_value,
      daysInPipeline,
      daysSinceLastContact,
      interactionCount: stats.count,
      source: opportunity.source,
    }, sourceVocab))
    labels.push(opportunity.stage === 'won' ? 1 : 0)
  }

  return { rows, labels, sourceVocab }
}

async function loadModelRow(): Promise<{ weights: string, trained_at: string, training_examples: number, metrics: string | null } | undefined> {
  const db = useDatabase()
  return await db.prepare('SELECT weights, trained_at, training_examples, metrics FROM ml_models WHERE id = ?').get(CONVERSION_MODEL_ID) as { weights: string, trained_at: string, training_examples: number, metrics: string | null } | undefined
}

function parseStoredModel(weightsJson: string): Partial<StoredConversionModel> {
  return JSON.parse(weightsJson) as Partial<StoredConversionModel>
}

export async function getConversionModelStatus(): Promise<ConversionModelStatus> {
  const row = await loadModelRow()

  if (!row) {
    return { trained: false, trainedAt: null, trainingExamples: 0, minTrainingExamples: MIN_TRAINING_EXAMPLES, accuracy: null }
  }

  const isTrained = !!parseStoredModel(row.weights).logisticRegression
  const metrics = row.metrics ? JSON.parse(row.metrics) as { accuracy: number | null } : { accuracy: null }
  return {
    trained: isTrained,
    trainedAt: isTrained ? row.trained_at : null,
    trainingExamples: row.training_examples,
    minTrainingExamples: MIN_TRAINING_EXAMPLES,
    accuracy: isTrained ? metrics.accuracy : null,
  }
}

export async function trainConversionModel(): Promise<ConversionModelStatus> {
  const { rows, labels, sourceVocab } = await buildTrainingSet()
  const now = new Date().toISOString()
  const db = useDatabase()

  if (rows.length < MIN_TRAINING_EXAMPLES) {
    // Still record the attempt (example count only) so the UI can show real progress toward the
    // threshold, without touching any previously trained weights that might still be in use.
    await db.prepare(`
      INSERT INTO ml_models (id, name, weights, trained_at, training_examples, metrics, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET training_examples = EXCLUDED.training_examples, updated_at = EXCLUDED.updated_at
    `).run(CONVERSION_MODEL_ID, 'Conversion Likelihood', JSON.stringify({}), now, rows.length, null, now, now)

    return { trained: false, trainedAt: null, trainingExamples: rows.length, minTrainingExamples: MIN_TRAINING_EXAMPLES, accuracy: null }
  }

  const examples = rows.map((row, i) => ({ row, label: labels[i]! }))
  for (let i = examples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[examples[i], examples[j]] = [examples[j]!, examples[i]!]
  }
  const splitIndex = Math.max(1, Math.floor(examples.length * 0.8))
  const trainSet = examples.slice(0, splitIndex)
  const testSet = examples.slice(splitIndex)

  const model = trainLogisticRegression(trainSet.map(e => e.row), trainSet.map(e => e.label))

  let correct = 0
  for (const example of testSet) {
    const predicted = predictProbability(example.row, model) >= 0.5 ? 1 : 0
    if (predicted === example.label)
      correct++
  }
  const accuracy = testSet.length ? correct / testSet.length : null

  const stored: StoredConversionModel = { logisticRegression: model, sourceVocab }

  await db.prepare(`
    INSERT INTO ml_models (id, name, weights, trained_at, training_examples, metrics, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      weights = EXCLUDED.weights,
      trained_at = EXCLUDED.trained_at,
      training_examples = EXCLUDED.training_examples,
      metrics = EXCLUDED.metrics,
      updated_at = EXCLUDED.updated_at
  `).run(CONVERSION_MODEL_ID, 'Conversion Likelihood', JSON.stringify(stored), now, rows.length, JSON.stringify({ accuracy }), now, now)

  return { trained: true, trainedAt: now, trainingExamples: rows.length, minTrainingExamples: MIN_TRAINING_EXAMPLES, accuracy }
}

function buildSuggestionText(input: { urgency: SuggestionUrgency, winProbability: number | null, daysSinceLastContact: number, isDecided: boolean }): { headline: string, actionLabel: string } {
  if (input.isDecided)
    return { headline: 'This deal is already decided.', actionLabel: 'No action needed' }

  const roundedDays = Math.round(input.daysSinceLastContact)

  if (input.urgency === 'stalled') {
    return {
      headline: `No contact in ${roundedDays} days — this is going cold.`,
      actionLabel: input.winProbability !== null ? `${Math.round(input.winProbability * 100)}% predicted win probability — reach out today` : 'Reach out today',
    }
  }
  if (input.urgency === 'follow_up') {
    return {
      headline: `No contact in ${roundedDays} days.`,
      actionLabel: 'Recommend a follow-up this week',
    }
  }
  if (input.winProbability !== null) {
    const pct = Math.round(input.winProbability * 100)
    const actionLabel = pct >= 70 ? 'High likelihood — prioritize closing' : pct >= 40 ? 'Keep nurturing' : 'Lower likelihood — consider re-qualifying'
    return { headline: `${pct}% predicted win probability.`, actionLabel }
  }
  return { headline: 'Recently in contact.', actionLabel: 'No action needed right now' }
}

export async function getOpportunitySuggestion(regardingType: RegardingType, regardingId: string): Promise<OpportunitySuggestion> {
  const db = useDatabase()

  let source: string | null = null
  let estimatedValue: number | null = null
  let createdAt: string
  let isDecided = false

  if (regardingType === 'lead') {
    const row = await db.prepare('SELECT source, estimated_value, created_at, stage FROM leads WHERE id = ?').get(regardingId) as { source: string | null, estimated_value: number | null, created_at: string, stage: string } | undefined
    if (!row)
      throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
    source = row.source
    estimatedValue = row.estimated_value
    createdAt = row.created_at
    isDecided = row.stage === 'won' || row.stage === 'lost'
  }
  else if (regardingType === 'tender') {
    const row = await db.prepare('SELECT source, estimated_value, created_at, stage FROM tenders WHERE id = ?').get(regardingId) as { source: string | null, estimated_value: number | null, created_at: string, stage: string } | undefined
    if (!row)
      throw createError({ statusCode: 404, statusMessage: 'Tender not found' })
    source = row.source
    estimatedValue = row.estimated_value
    createdAt = row.created_at
    isDecided = row.stage === 'won' || row.stage === 'lost'
  }
  else {
    const row = await db.prepare('SELECT created_at FROM clients WHERE id = ?').get(regardingId) as { created_at: string } | undefined
    if (!row)
      throw createError({ statusCode: 404, statusMessage: 'Client not found' })
    createdAt = row.created_at
  }

  const now = new Date().toISOString()
  const stats = await loadInteractionStats(regardingType, regardingId, now)
  const daysInPipeline = daysBetween(createdAt, now)
  const daysSinceLastContact = stats.lastOccurredAt ? daysBetween(stats.lastOccurredAt, now) : daysInPipeline

  let winProbability: number | null = null
  let modelTrainedAt: string | null = null
  let trainingExamples = 0

  if (regardingType === 'lead' || regardingType === 'tender') {
    const modelRow = await loadModelRow()
    trainingExamples = modelRow?.training_examples ?? 0

    if (!isDecided && modelRow) {
      const stored = parseStoredModel(modelRow.weights)
      if (stored.logisticRegression && stored.sourceVocab) {
        const features = buildFeatureVector({
          isTender: regardingType === 'tender',
          estimatedValue,
          daysInPipeline,
          daysSinceLastContact,
          interactionCount: stats.count,
          source,
        }, stored.sourceVocab)
        winProbability = predictProbability(features, stored.logisticRegression)
        modelTrainedAt = modelRow.trained_at
      }
    }
  }

  const urgency: SuggestionUrgency = isDecided
    ? 'none'
    : daysSinceLastContact >= STALE_HIGH_RISK_DAYS ? 'stalled' : daysSinceLastContact >= STALE_FOLLOW_UP_DAYS ? 'follow_up' : 'none'

  const { headline, actionLabel } = buildSuggestionText({ urgency, winProbability, daysSinceLastContact, isDecided })

  return {
    regardingType,
    regardingId,
    winProbability,
    daysSinceLastContact: isDecided ? null : Math.round(daysSinceLastContact),
    urgency,
    headline,
    actionLabel,
    modelTrainedAt,
    trainingExamples,
    minTrainingExamples: MIN_TRAINING_EXAMPLES,
  }
}
