/**
 * rubricScorer.ts — Deterministic Rubric-Based Scoring Engine
 *
 * Implements Section 5.9:
 * - The language model extracts facts (e.g. experience = 4, ctc = 18, notice = 15).
 * - Code deterministically computes the overall score (0 to 100) and stores contributing criteria.
 * - Prevents model-hallucinated or inconsistent scores: every point traces to an audited rule.
 */

import { ReportBlueprint, BlueprintRubricItem } from '../config/reportBlueprints';

export interface RubricEvaluationBreakdown {
  criterion: string;
  weight: number;
  scoreAwarded: number;
  fulfillmentRatio: number;
}

export interface RubricScoreResult {
  totalScore: number; // 0 to 100
  criteriaBreakdown: RubricEvaluationBreakdown[];
}

/**
 * Computes deterministic score based on extracted fields and blueprint rubric.
 */
export function calculateRubricScore(
  blueprint: ReportBlueprint | undefined,
  extractedFields: Record<string, any>
): RubricScoreResult | null {
  if (!blueprint || !blueprint.rubric || blueprint.rubric.length === 0) {
    return null;
  }

  const breakdown: RubricEvaluationBreakdown[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  for (const item of blueprint.rubric) {
    totalWeight += item.weight;
    let ratio = 0;
    try {
      ratio = Math.max(0, Math.min(1.0, item.evaluator(extractedFields)));
    } catch {
      ratio = 0;
    }

    const awarded = Math.round(ratio * item.weight);
    totalScore += awarded;

    breakdown.push({
      criterion: item.criterion,
      weight: item.weight,
      scoreAwarded: awarded,
      fulfillmentRatio: ratio,
    });
  }

  // Normalize to 100 scale if weights don't sum to exactly 100
  if (totalWeight > 0 && totalWeight !== 100) {
    totalScore = Math.round((totalScore / totalWeight) * 100);
  }

  return {
    totalScore: Math.max(0, Math.min(100, totalScore)),
    criteriaBreakdown: breakdown,
  };
}
