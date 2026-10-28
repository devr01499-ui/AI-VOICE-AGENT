/**
 * metricsCalculator.ts — Authoritative Evaluation Metrics & Confusion Matrix Calculator
 *
 * Implements Section 6 Metrics:
 * - Label Accuracy
 * - Macro-F1 across all blueprint outcome classes
 * - Confusion Matrix
 * - Per-field Exact Match (after normalization)
 * - Null / Abstention Rate
 * - Evidence Validity Rate (verbatim substring checks)
 * - Hallucinated-Field Rate (predicted non-null when ground truth is null/not stated)
 * - Confidence Calibration (accuracy partitioned by confidence bands)
 */

export interface EvaluationRecord {
  callId: string;
  templateId: string;
  expectedLabel: string;
  predictedLabel: string;
  expectedFields: Record<string, any>;
  predictedFields: Record<string, any>;
  confidence: number;
  evidenceValidityRate: number;
  latencyMs: number;
}

export interface MetricSummary {
  totalCalls: number;
  labelAccuracy: number;
  macroF1: number;
  confusionMatrix: Record<string, Record<string, number>>;
  perFieldExactMatch: Record<string, number>;
  abstentionRate: number;
  hallucinatedFieldRate: number;
  overallEvidenceValidityRate: number;
  calibration: Record<string, { total: number; correct: number; accuracy: number }>;
  avgLatencyMs: number;
}

export function computeEvaluationMetrics(records: EvaluationRecord[]): MetricSummary {
  if (records.length === 0) {
    return {
      totalCalls: 0,
      labelAccuracy: 0,
      macroF1: 0,
      confusionMatrix: {},
      perFieldExactMatch: {},
      abstentionRate: 0,
      hallucinatedFieldRate: 0,
      overallEvidenceValidityRate: 1.0,
      calibration: {},
      avgLatencyMs: 0,
    };
  }

  let correctLabels = 0;
  const confusionMatrix: Record<string, Record<string, number>> = {};
  const allLabels = new Set<string>();

  // Confidence bands: [0.9-1.0], [0.8-0.9), [0.7-0.8), [<0.7]
  const calibration: Record<string, { total: number; correct: number; accuracy: number }> = {
    '0.9 - 1.0': { total: 0, correct: 0, accuracy: 0 },
    '0.8 - 0.9': { total: 0, correct: 0, accuracy: 0 },
    '0.7 - 0.8': { total: 0, correct: 0, accuracy: 0 },
    '< 0.7': { total: 0, correct: 0, accuracy: 0 },
  };

  let totalFieldsChecked = 0;
  let totalFieldMatches = 0;
  const fieldCounts: Record<string, { total: number; matches: number }> = {};
  let totalNullExpected = 0;
  let hallucinatedCount = 0;
  let totalNullPredicted = 0;
  let totalEvidenceValiditySum = 0;
  let totalLatency = 0;

  for (const r of records) {
    const exp = r.expectedLabel;
    const pred = r.predictedLabel;
    allLabels.add(exp);
    allLabels.add(pred);

    // Confusion Matrix & Accuracy
    if (!confusionMatrix[exp]) confusionMatrix[exp] = {};
    confusionMatrix[exp][pred] = (confusionMatrix[exp][pred] || 0) + 1;

    const isCorrect = exp.toLowerCase() === pred.toLowerCase();
    if (isCorrect) correctLabels++;

    // Calibration bands
    let band = '< 0.7';
    if (r.confidence >= 0.9) band = '0.9 - 1.0';
    else if (r.confidence >= 0.8) band = '0.8 - 0.9';
    else if (r.confidence >= 0.7) band = '0.7 - 0.8';

    calibration[band].total++;
    if (isCorrect) calibration[band].correct++;

    // Per-field checks
    const allFieldKeys = new Set([...Object.keys(r.expectedFields), ...Object.keys(r.predictedFields)]);
    for (const f of allFieldKeys) {
      if (!fieldCounts[f]) fieldCounts[f] = { total: 0, matches: 0 };
      fieldCounts[f].total++;
      totalFieldsChecked++;

      const expVal = r.expectedFields[f] ?? null;
      const predVal = r.predictedFields[f] ?? null;

      if (expVal === null) {
        totalNullExpected++;
        if (predVal !== null && predVal !== undefined) {
          hallucinatedCount++;
        }
      }

      if (predVal === null) {
        totalNullPredicted++;
      }

      if (String(expVal) === String(predVal)) {
        fieldCounts[f].matches++;
        totalFieldMatches++;
      }
    }

    totalEvidenceValiditySum += r.evidenceValidityRate;
    totalLatency += r.latencyMs;
  }

  // Calculate Calibration Accuracies
  for (const band of Object.keys(calibration)) {
    const item = calibration[band];
    item.accuracy = item.total === 0 ? 0 : Math.round((item.correct / item.total) * 100);
  }

  // Macro-F1 Calculation
  let sumF1 = 0;
  let classCount = 0;
  for (const label of allLabels) {
    let tp = confusionMatrix[label]?.[label] || 0;
    let fp = 0;
    let fn = 0;

    for (const other of allLabels) {
      if (other !== label) {
        fp += confusionMatrix[other]?.[label] || 0;
        fn += confusionMatrix[label]?.[other] || 0;
      }
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    sumF1 += f1;
    classCount++;
  }

  const macroF1 = classCount === 0 ? 0 : sumF1 / classCount;
  const labelAccuracy = correctLabels / records.length;
  const perFieldExactMatch: Record<string, number> = {};
  for (const f of Object.keys(fieldCounts)) {
    perFieldExactMatch[f] = Math.round((fieldCounts[f].matches / fieldCounts[f].total) * 100);
  }

  return {
    totalCalls: records.length,
    labelAccuracy: Math.round(labelAccuracy * 1000) / 10,
    macroF1: Math.round(macroF1 * 100) / 100,
    confusionMatrix,
    perFieldExactMatch,
    abstentionRate: totalFieldsChecked === 0 ? 0 : Math.round((totalNullPredicted / totalFieldsChecked) * 100),
    hallucinatedFieldRate: totalNullExpected === 0 ? 0 : Math.round((hallucinatedCount / totalNullExpected) * 1000) / 10,
    overallEvidenceValidityRate: Math.round((totalEvidenceValiditySum / records.length) * 100),
    calibration,
    avgLatencyMs: Math.round(totalLatency / records.length),
  };
}
