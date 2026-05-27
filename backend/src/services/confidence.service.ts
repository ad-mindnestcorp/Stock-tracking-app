/**
 * Confidence scoring for AI research sections.
 * Each section receives a 0-100 score based on verifiable factors.
 * Low scores flag LOW_CONFIDENCE to the consumer.
 */

import type { ValidationResult } from './validation.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfidenceFactors {
  /** 0-1 fraction of expected API fields that were non-null */
  dataCompleteness: number;
  /** Whether AI output passed all sanity/range/placeholder checks */
  validationPassed: boolean;
  /** Whether multiple sources agree on the key facts (0-1) */
  sourceAgreement: number;
  /** 0-1: 1 = data is from today, 0 = data is over 24h old */
  dataFreshness: number;
  /** True if no contradictions were detected */
  noContradictions: boolean;
  /** True if no placeholder values were detected */
  noPlaceholders: boolean;
}

export interface ConfidenceScore {
  score: number;          // 0-100
  label: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
  factors: ConfidenceFactors;
  issues: string[];
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  dataCompleteness: 30,   // 0–30 points
  validationPassed: 25,   // 0 or 25 points
  sourceAgreement: 20,    // 0–20 points
  dataFreshness: 15,      // 0–15 points
  noContradictions: 5,    // 0 or 5 points
  noPlaceholders: 5,      // 0 or 5 points
};

// ─── Scorer ───────────────────────────────────────────────────────────────────

/**
 * Calculate a confidence score from 0–100 and assign a label.
 */
export function calculateConfidenceScore(
  factors: ConfidenceFactors,
  validation: ValidationResult,
): ConfidenceScore {
  let score = 0;

  score += Math.round(factors.dataCompleteness * WEIGHTS.dataCompleteness);
  score += factors.validationPassed ? WEIGHTS.validationPassed : 0;
  score += Math.round(factors.sourceAgreement * WEIGHTS.sourceAgreement);
  score += Math.round(factors.dataFreshness * WEIGHTS.dataFreshness);
  score += factors.noContradictions ? WEIGHTS.noContradictions : 0;
  score += factors.noPlaceholders ? WEIGHTS.noPlaceholders : 0;

  score = Math.max(0, Math.min(100, score));

  let label: ConfidenceScore['label'];
  if (score >= 75) label = 'HIGH';
  else if (score >= 50) label = 'MEDIUM';
  else if (score > 0) label = 'LOW';
  else label = 'UNAVAILABLE';

  return {
    score,
    label,
    factors,
    issues: validation.issues,
  };
}

// ─── Section-Specific Builders ────────────────────────────────────────────────

/** Build confidence for data-driven sections where API data completeness is key. */
export function buildDataDrivenConfidence(
  dataCompleteness: number,
  validation: ValidationResult,
  dataAgeMs = 0,
): ConfidenceScore {
  const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  const dataFreshness = Math.max(0, 1 - dataAgeMs / maxAgeMs);

  const factors: ConfidenceFactors = {
    dataCompleteness,
    validationPassed: validation.valid,
    sourceAgreement: dataCompleteness >= 0.7 ? 1.0 : dataCompleteness,
    dataFreshness,
    noContradictions: !validation.hasContradictions,
    noPlaceholders: !validation.hasPlaceholders,
  };

  return calculateConfidenceScore(factors, validation);
}

/** Build confidence for qualitative/web-search sections where data is less verifiable. */
export function buildQualitativeConfidence(
  validation: ValidationResult,
): ConfidenceScore {
  const factors: ConfidenceFactors = {
    dataCompleteness: 0.5,   // Web search completeness is inherently uncertain
    validationPassed: validation.valid,
    sourceAgreement: 0.6,    // Web sources may conflict
    dataFreshness: 0.9,      // Web search retrieves recent content
    noContradictions: !validation.hasContradictions,
    noPlaceholders: !validation.hasPlaceholders,
  };

  return calculateConfidenceScore(factors, validation);
}

/** Build a zero-confidence score when data is unavailable. */
export function buildUnavailableConfidence(reason: string): ConfidenceScore {
  return {
    score: 0,
    label: 'UNAVAILABLE',
    factors: {
      dataCompleteness: 0,
      validationPassed: false,
      sourceAgreement: 0,
      dataFreshness: 0,
      noContradictions: true,
      noPlaceholders: true,
    },
    issues: [reason],
  };
}
