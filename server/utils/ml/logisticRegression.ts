export interface LogisticRegressionModel {
  weights: number[]
  bias: number
  featureMeans: number[]
  featureStdDevs: number[]
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], avg: number): number {
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance) || 1
}

function standardizeRow(row: number[], means: number[], stdDevs: number[]): number[] {
  return row.map((value, i) => (value - means[i]!) / stdDevs[i]!)
}

/**
 * Batch gradient descent logistic regression with L2 regularization. Deliberately dependency-free
 * (no ML library) and small (a handful of features, a few hundred rows at most) so it trains in
 * milliseconds and serializes to a tiny JSON blob — no model file to host, just a weight vector.
 */
export function trainLogisticRegression(
  rows: number[][],
  labels: number[],
  options: { epochs?: number, learningRate?: number, l2?: number } = {},
): LogisticRegressionModel {
  const epochs = options.epochs ?? 500
  const learningRate = options.learningRate ?? 0.1
  const l2 = options.l2 ?? 0.01

  const featureCount = rows[0]?.length ?? 0
  const featureMeans: number[] = []
  const featureStdDevs: number[] = []
  for (let j = 0; j < featureCount; j++) {
    const column = rows.map(row => row[j]!)
    const avg = mean(column)
    featureMeans.push(avg)
    featureStdDevs.push(standardDeviation(column, avg))
  }

  const standardizedRows = rows.map(row => standardizeRow(row, featureMeans, featureStdDevs))

  let weights: number[] = Array.from({ length: featureCount }, () => 0)
  let bias = 0

  for (let epoch = 0; epoch < epochs; epoch++) {
    const weightGradients: number[] = Array.from({ length: featureCount }, () => 0)
    let biasGradient = 0

    for (let i = 0; i < standardizedRows.length; i++) {
      const row = standardizedRows[i]!
      const label = labels[i]!
      const z = row.reduce((sum, value, j) => sum + value * weights[j]!, bias)
      const prediction = sigmoid(z)
      const error = prediction - label

      row.forEach((value, j) => {
        weightGradients[j] = weightGradients[j]! + error * value
      })
      biasGradient += error
    }

    weights = weights.map((weight, j) => weight - learningRate * (weightGradients[j]! / standardizedRows.length + l2 * weight))
    bias -= learningRate * (biasGradient / standardizedRows.length)
  }

  return { weights, bias, featureMeans, featureStdDevs }
}

export function predictProbability(features: number[], model: LogisticRegressionModel): number {
  const standardized = standardizeRow(features, model.featureMeans, model.featureStdDevs)
  const z = standardized.reduce((sum, value, j) => sum + value * model.weights[j]!, model.bias)
  return sigmoid(z)
}
