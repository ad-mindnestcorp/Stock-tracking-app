/**
 * Deterministic validation layer for AI-generated financial analysis.
 * Runs after every GPT call to detect hallucinations, stale data, and impossible values.
 */

import { normalizePercent, DATA_NOT_AVAILABLE } from '../utils/normalize-percent';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Input Validation (Pre-GPT) ────────────────────────────────────────────────

export interface InputValidationResult {
  valid: boolean;
  sanitizedValue: number | null;
  warning?: string;
}

const INPUT_RANGES: Record<string, { min: number; max: number }> = {
  implied_volatility: { min: 0, max: 500 },
  gross_margin: { min: -1, max: 1 },
  net_margin: { min: -1, max: 1 },
  revenue_growth: { min: -1, max: 10 },
  roe: { min: -5, max: 5 },
  ebitda_margin: { min: -1, max: 1 },
  ps_ratio: { min: 0, max: 200 },          // Updated: 0-200
  pe_ratio: { min: -2000, max: 10000 },
  ev_ebitda: { min: -100, max: 500 },      // Updated: -100 to 500
  debt_equity: { min: 0, max: 20 },        // Updated: 0-20
  rule_of_40: { min: -200, max: 1000 },
};

export function validateInputValue(
  fieldKey: string,
  value: number | null | undefined,
): InputValidationResult {
  if (value === null || value === undefined || !isFinite(value)) {
    return { valid: false, sanitizedValue: null, warning: `${fieldKey}: value is null or invalid` };
  }

  const range = INPUT_RANGES[fieldKey];
  if (!range) {
    return { valid: true, sanitizedValue: value };
  }

  if (value < range.min || value > range.max) {
    console.warn(`[validation:input] ${fieldKey}=${value} outside valid range [${range.min}, ${range.max}] — returning DATA_NOT_AVAILABLE`);
    return {
      valid: false,
      sanitizedValue: null,
      warning: `${fieldKey}=${value} is outside valid range [${range.min}, ${range.max}]`,
    };
  }

  return { valid: true, sanitizedValue: value };
}

export function validateFinancialInputs(metrics: {
  roeTTM?: number | null;
  grossMarginTTM?: number | null;
  netProfitMarginTTM?: number | null;
  revenueGrowthTTMYoy?: number | null;
  psTTM?: number | null;
  peRatioTTM?: number | null;
}): { sanitized: typeof metrics; warnings: string[] } {
  const warnings: string[] = [];
  const sanitized = { ...metrics };

  const checks: Array<{ key: keyof typeof metrics; rangeKey: string }> = [
    { key: 'roeTTM', rangeKey: 'roe' },
    { key: 'grossMarginTTM', rangeKey: 'gross_margin' },
    { key: 'netProfitMarginTTM', rangeKey: 'net_margin' },
    { key: 'revenueGrowthTTMYoy', rangeKey: 'revenue_growth' },
    { key: 'psTTM', rangeKey: 'ps_ratio' },
    { key: 'peRatioTTM', rangeKey: 'pe_ratio' },
  ];

  for (const { key, rangeKey } of checks) {
    const result = validateInputValue(rangeKey, metrics[key]);
    if (!result.valid) {
      sanitized[key] = null;
      if (result.warning) warnings.push(result.warning);
    }
  }

  return { sanitized, warnings };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  hasPlaceholders: boolean;
  hasStaleFiscalData: boolean;
  hasImpossibleValues: boolean;
  hasContradictions: boolean;
}

// ─── Sanity Range Rules ───────────────────────────────────────────────────────

const NUMERIC_RANGES: Record<string, { min: number; max: number; description: string }> = {
  implied_volatility_pct: { min: 0, max: 500, description: 'Implied volatility %' },
  historical_volatility_pct: { min: 0, max: 500, description: 'Historical volatility %' },
  gross_margin_pct: { min: -100, max: 100, description: 'Gross margin %' },
  net_margin_pct: { min: -100, max: 100, description: 'Net margin %' },
  revenue_growth_pct: { min: -100, max: 1000, description: 'Revenue growth %' },
  ebitda_margin_pct: { min: -100, max: 100, description: 'EBITDA margin %' },
  roe_pct: { min: -500, max: 500, description: 'Return on equity %' },
  current_ratio: { min: 0, max: 100, description: 'Current ratio' },
  short_interest_pct: { min: 0, max: 100, description: 'Short interest %' },
  pe_ratio: { min: -2000, max: 10000, description: 'P/E ratio' },
  ps_ratio: { min: 0, max: 200, description: 'P/S ratio' },              // Updated: 0-200
  ev_ebitda: { min: -100, max: 500, description: 'EV/EBITDA' },          // Updated: -100 to 500
  debt_equity: { min: 0, max: 20, description: 'Debt/Equity ratio' },    // Updated: 0-20
  rule_of_40_score: { min: -200, max: 1000, description: 'Rule of 40 score' },
  days_to_cover: { min: 0, max: 365, description: 'Short interest days to cover' },
  insider_pct: { min: 0, max: 100, description: 'Insider ownership %' },
  sentiment_score: { min: 0, max: 100, description: 'Sentiment score' },
};

// ─── Placeholder Detection ────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\bXX%\b/i,
  /\bX\.X\b/i,
  /\b\d+\.\d*X\b/i,
  /\bXX\b/i,
  /\b\[.*?\]\b/,
  /placeholder/i,
  /\$XX\b/i,
];

/**
 * Recursively scan a value for placeholder patterns that indicate GPT
 * invented or guessed a value instead of stating DATA_NOT_AVAILABLE.
 */
export function detectPlaceholders(value: unknown): boolean {
  if (typeof value === 'string') {
    return PLACEHOLDER_PATTERNS.some(p => p.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(v => detectPlaceholders(v));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v => detectPlaceholders(v));
  }
  return false;
}

// ─── Stale Data Detection ─────────────────────────────────────────────────────

/**
 * Detect references to fiscal years that are more than 2 years stale.
 * Current year is dynamic so this catches FY2022 references in 2026.
 */
export function detectStaleData(value: unknown): boolean {
  const staleYearThreshold = CURRENT_YEAR - 2;
  const stalePattern = new RegExp(`FY(20(0[0-9]|1[0-9]|2[0-${staleYearThreshold % 10}]))|20${Math.floor(staleYearThreshold / 10) % 10}[0-${staleYearThreshold % 10}]`, 'i');

  const checkString = (s: string): boolean => {
    // Look for years more than 2 years old referenced in fiscal year context
    const yearMatches = s.match(/\b(20\d{2})\b/g) ?? [];
    return yearMatches.some(y => parseInt(y) < staleYearThreshold);
  };

  if (typeof value === 'string') return checkString(value);
  if (Array.isArray(value)) return value.some(v => detectStaleData(v));
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v => detectStaleData(v));
  }
  return false;
}

// ─── Numeric Value Extraction ─────────────────────────────────────────────────

/** Extract the first numeric value from a string like "25.3%" or "$15.2B" or "2.5x". */
function extractNumber(s: string): number | null {
  const match = s.replace(/[$B%x]/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// ─── Section-Specific Range Validation ───────────────────────────────────────

interface RangeCheckInput {
  fieldName: string;
  rawValue: string | null | undefined;
  ruleKey: string;
}

function checkRange(input: RangeCheckInput): string | null {
  if (!input.rawValue) return null;
  const num = extractNumber(input.rawValue);
  if (num === null) return null;
  const rule = NUMERIC_RANGES[input.ruleKey];
  if (!rule) return null;
  if (num < rule.min || num > rule.max) {
    return `${input.fieldName} value ${num} is outside valid range [${rule.min}, ${rule.max}] for ${rule.description}`;
  }
  return null;
}

/**
 * Run range validation for fields in an AI section output.
 * Returns array of issue strings (empty = all valid).
 */
export function validateNumericRanges(sectionKey: string, data: Record<string, unknown>): string[] {
  const issues: string[] = [];

  const check = (fieldName: string, ruleKey: string) => {
    const raw = data[fieldName];
    if (typeof raw !== 'string') return;
    const issue = checkRange({ fieldName, rawValue: raw, ruleKey });
    if (issue) issues.push(issue);
  };

  switch (sectionKey) {
    case 'implied_volatility':
      check('current_iv', 'implied_volatility_pct');
      check('historical_iv', 'historical_volatility_pct');
      break;

    case 'short_interest':
      check('short_interest_pct', 'short_interest_pct');
      check('days_to_cover', 'days_to_cover');
      break;

    case 'insider_ownership':
      check('insider_ownership_pct', 'insider_pct');
      check('industry_avg', 'insider_pct');
      break;

    case 'rule_of_40':
      check('current_score', 'rule_of_40_score');
      if (Array.isArray(data.quarterly_data)) {
        (data.quarterly_data as Array<Record<string, string>>).forEach((q, i) => {
          const rg = checkRange({ fieldName: `quarterly_data[${i}].revenue_growth`, rawValue: q.revenue_growth, ruleKey: 'revenue_growth_pct' });
          const em = checkRange({ fieldName: `quarterly_data[${i}].ebitda_margin`, rawValue: q.ebitda_margin, ruleKey: 'ebitda_margin_pct' });
          if (rg) issues.push(rg);
          if (em) issues.push(em);
        });
      }
      break;

    case 'peer_comparison':
      if (Array.isArray(data.comparison_table)) {
        (data.comparison_table as Array<Record<string, string>>).forEach((row, i) => {
          const ps = checkRange({ fieldName: `comparison_table[${i}].ps_ttm`, rawValue: row.ps_ttm, ruleKey: 'ps_ratio' });
          const gm = checkRange({ fieldName: `comparison_table[${i}].gross_margin`, rawValue: row.gross_margin, ruleKey: 'gross_margin_pct' });
          const rg = checkRange({ fieldName: `comparison_table[${i}].revenue_growth`, rawValue: row.revenue_growth, ruleKey: 'revenue_growth_pct' });
          if (ps) issues.push(ps);
          if (gm) issues.push(gm);
          if (rg) issues.push(rg);
        });
      }
      break;

    case 'retail_sentiment':
      check('sentiment_score', 'sentiment_score');
      break;

    case 'valuation':
      if (Array.isArray(data.metrics)) {
        (data.metrics as Array<{ label: string; value: string }>).forEach(m => {
          if (m.label === 'Gross Margin') {
            const issue = checkRange({ fieldName: 'metrics.Gross Margin', rawValue: m.value, ruleKey: 'gross_margin_pct' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'P/E Ratio') {
            const issue = checkRange({ fieldName: 'metrics.P/E Ratio', rawValue: m.value, ruleKey: 'pe_ratio' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'Revenue Growth') {
            const issue = checkRange({ fieldName: 'metrics.Revenue Growth', rawValue: m.value, ruleKey: 'revenue_growth_pct' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'Current Ratio') {
            const issue = checkRange({ fieldName: 'metrics.Current Ratio', rawValue: m.value, ruleKey: 'current_ratio' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'ROE') {
            const issue = checkRange({ fieldName: 'metrics.ROE', rawValue: m.value, ruleKey: 'roe_pct' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'Net Margin' || m.label === 'Net Profit Margin') {
            const issue = checkRange({ fieldName: 'metrics.Net Margin', rawValue: m.value, ruleKey: 'net_margin_pct' });
            if (issue) issues.push(issue);
          }
          if (m.label === 'EV/EBITDA') {
            const issue = checkRange({ fieldName: 'metrics.EV/EBITDA', rawValue: m.value, ruleKey: 'ev_ebitda' });
            if (issue) issues.push(issue);
          }
        });
      }
      break;

    case 'historical_ps':
      check('current_ps', 'ps_ratio');
      check('min_3y', 'ps_ratio');
      check('max_3y', 'ps_ratio');
      check('avg_3y', 'ps_ratio');
      break;

    case 'forward_ps':
      check('ttm_ps', 'ps_ratio');
      check('forward_ps', 'ps_ratio');
      break;
  }

  return issues;
}

// ─── Contradiction Detection ──────────────────────────────────────────────────

const BULLISH_KEYWORDS = ['growth', 'strong', 'increasing', 'positive', 'outperform', 'beat', 'accelerat'];
const BEARISH_KEYWORDS = ['declining', 'weak', 'falling', 'negative', 'miss', 'shrink', 'loss'];

/**
 * Detect if a bullish verdict contradicts clearly bearish language in the content
 * or vice versa. Returns issue string if contradiction detected, null otherwise.
 */
export function detectContradictions(data: Record<string, unknown>): string | null {
  const verdict = (typeof data.verdict === 'string' ? data.verdict : '').toLowerCase();
  if (!verdict) return null;

  const isBullishVerdict = BULLISH_KEYWORDS.some(k => verdict.includes(k)) ||
    verdict.includes('strong') || verdict.includes('attractive') ||
    verdict.includes('bullish') || verdict.includes('low risk');

  const isBearishVerdict = BEARISH_KEYWORDS.some(k => verdict.includes(k)) ||
    verdict.includes('weak') || verdict.includes('expensive') ||
    verdict.includes('bearish') || verdict.includes('high risk');

  // Flatten all string arrays in the output into a single text corpus
  const allText = JSON.stringify(data).toLowerCase();

  const bearSignalCount = BEARISH_KEYWORDS.filter(k => allText.includes(k)).length;
  const bullSignalCount = BULLISH_KEYWORDS.filter(k => allText.includes(k)).length;

  if (isBullishVerdict && bearSignalCount >= 4 && bearSignalCount > bullSignalCount * 2) {
    return `Verdict "${data.verdict}" may contradict predominantly bearish content signals`;
  }
  if (isBearishVerdict && bullSignalCount >= 4 && bullSignalCount > bearSignalCount * 2) {
    return `Verdict "${data.verdict}" may contradict predominantly bullish content signals`;
  }

  return null;
}

// ─── Combined Output Validator ────────────────────────────────────────────────

/**
 * Full validation of a GPT section output.
 * Returns structured ValidationResult with all issues.
 */
export function validateAIOutput(sectionKey: string, data: unknown): ValidationResult {
  const issues: string[] = [];

  const hasPlaceholders = detectPlaceholders(data);
  if (hasPlaceholders) {
    issues.push('Response contains placeholder values (XX%, X.X, etc.) — hallucination risk HIGH');
  }

  const hasStaleFiscalData = detectStaleData(data);
  if (hasStaleFiscalData) {
    issues.push(`Response may reference stale fiscal year data (pre-${CURRENT_YEAR - 2})`);
  }

  let hasImpossibleValues = false;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const rangeIssues = validateNumericRanges(sectionKey, data as Record<string, unknown>);
    if (rangeIssues.length > 0) {
      hasImpossibleValues = true;
      issues.push(...rangeIssues);
    }
  }

  let hasContradictions = false;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const contradiction = detectContradictions(data as Record<string, unknown>);
    if (contradiction) {
      hasContradictions = true;
      issues.push(contradiction);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    hasPlaceholders,
    hasStaleFiscalData,
    hasImpossibleValues,
    hasContradictions,
  };
}

// ─── Post-Processing: Sanitize AI Output ───────────────────────────────────────

export interface SanitizedOutput<T> {
  data: T;
  validation_warnings: string[];
  confidence_degraded: boolean;
}

export function sanitizeAIOutput<T extends Record<string, unknown>>(
  sectionKey: string,
  data: T,
): SanitizedOutput<T> {
  const validation = validateAIOutput(sectionKey, data);
  const warnings = [...validation.issues];
  let confidenceDegraded = false;

  const sanitized = { ...data };

  if (validation.hasPlaceholders) {
    confidenceDegraded = true;
    sanitizePlaceholderFields(sanitized);
  }

  if (validation.hasImpossibleValues) {
    confidenceDegraded = true;
    sanitizeImpossibleValues(sectionKey, sanitized, warnings);
  }

  if (validation.hasContradictions) {
    confidenceDegraded = true;
  }

  return {
    data: sanitized as T,
    validation_warnings: warnings,
    confidence_degraded: confidenceDegraded,
  };
}

function sanitizePlaceholderFields(data: Record<string, unknown>): void {
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === 'string' && detectPlaceholders(value)) {
      data[key] = 'DATA_NOT_AVAILABLE';
    } else if (Array.isArray(value)) {
      data[key] = value.map(v =>
        typeof v === 'string' && detectPlaceholders(v) ? 'DATA_NOT_AVAILABLE' : v
      );
    }
  }
}

function sanitizeImpossibleValues(
  sectionKey: string,
  data: Record<string, unknown>,
  warnings: string[],
): void {
  const extractAndValidate = (raw: string, ruleKey: string): string => {
    const match = raw.replace(/[$B%x]/g, '').match(/-?\d+(\.\d+)?/);
    if (!match) return raw;
    const num = parseFloat(match[0]);
    const range = NUMERIC_RANGES[ruleKey];
    if (range && (num < range.min || num > range.max)) {
      return DATA_NOT_AVAILABLE;
    }
    return raw;
  };

  if (sectionKey === 'historical_ps') {
    for (const field of ['current_ps', 'min_3y', 'max_3y', 'avg_3y']) {
      if (typeof data[field] === 'string' && data[field] !== DATA_NOT_AVAILABLE) {
        data[field] = extractAndValidate(data[field] as string, 'ps_ratio');
      }
    }
  }
}

// ─── Global Post-Validation ────────────────────────────────────────────────────

/** Patterns indicating unsupported/fabricated claims */
const UNSUPPORTED_CLAIM_PATTERNS = [
  /\b(SEC|securities and exchange)\s+(is investigating|has launched|confirmed|found|determined)\b/i,
  /\bclass action\s+(lawsuit|suit)\s+(filed|confirmed|won|settled)\b/i,
  /\banalyst(s)?\s+(price target|consensus|rating)\s+(of|at|is)\s+\$?\d/i,
  /\b(guaranteed|will definitely|certain to|must)\s+(grow|increase|rise|fall|decline)\b/i,
  /\bconfirmed\s+(fraud|manipulation|misconduct)\b/i,
];

/** Patterns indicating speculative language presented as fact */
const SPECULATIVE_AS_FACT_PATTERNS = [
  /\bwill\s+(grow|increase|decline|fall|rise)\s+by\s+\d+%?\b/i,
  /\bexpected\s+to\s+reach\s+\$\d/i,
  /\bthe\s+stock\s+will\s+(hit|reach|fall to)\s+\$/i,
  /\bguaranteed\s+(returns?|growth|profit)\b/i,
];

export interface GlobalValidationResult {
  valid: boolean;
  issues: string[];
  sanitizedData: Record<string, unknown> | null;
  confidencePenalty: number;  // 0-1 penalty to apply to confidence score
}

/**
 * Global post-validation that runs on all AI outputs.
 * Rejects impossible percentages, contradictory conclusions, unsupported claims.
 */
export function globalPostValidation(
  sectionKey: string,
  data: unknown,
): GlobalValidationResult {
  const issues: string[] = [];
  let confidencePenalty = 0;

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, issues: ['Invalid data structure'], sanitizedData: null, confidencePenalty: 1 };
  }

  const record = data as Record<string, unknown>;
  const sanitized = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;

  // 1. Validate all percentage values using centralized normalizePercent
  const percentFields = findPercentageFields(sanitized);
  for (const { path, value } of percentFields) {
    const result = normalizePercent(value, path);
    if (!result.valid && result.warning) {
      issues.push(`Invalid percentage: ${result.warning}`);
      setNestedValue(sanitized, path, DATA_NOT_AVAILABLE);
      confidencePenalty += 0.1;
    }
  }

  // 2. Detect unsupported/fabricated claims
  const textContent = JSON.stringify(sanitized);
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(textContent)) {
      issues.push(`Potential unsupported claim detected: ${pattern.source.substring(0, 50)}...`);
      confidencePenalty += 0.15;
    }
  }

  // 3. Detect speculative language presented as fact
  for (const pattern of SPECULATIVE_AS_FACT_PATTERNS) {
    if (pattern.test(textContent)) {
      issues.push(`Speculative claim presented as fact: ${pattern.source.substring(0, 50)}...`);
      confidencePenalty += 0.1;
    }
  }

  // 4. Validate verdict consistency
  const verdict = record.verdict;
  if (typeof verdict === 'string') {
    const verdictIssue = validateVerdictConsistency(sectionKey, verdict, sanitized);
    if (verdictIssue) {
      issues.push(verdictIssue);
      confidencePenalty += 0.2;
    }
  }

  // 5. Check for DATA_NOT_AVAILABLE overuse (indicates low-quality response)
  const dataNotAvailableCount = (textContent.match(/DATA_NOT_AVAILABLE/g) ?? []).length;
  if (dataNotAvailableCount > 5) {
    issues.push(`Response contains ${dataNotAvailableCount} DATA_NOT_AVAILABLE fields — may indicate insufficient data`);
    confidencePenalty += 0.1;
  }

  // Cap penalty at 1.0
  confidencePenalty = Math.min(1, confidencePenalty);

  return {
    valid: issues.length === 0,
    issues,
    sanitizedData: sanitized,
    confidencePenalty,
  };
}

/**
 * Find all fields that appear to contain percentage values.
 */
function findPercentageFields(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ path: string; value: number }> {
  const results: Array<{ path: string; value: number }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'number') {
      // Check if field name suggests percentage
      const isPctField = /(%|pct|percent|margin|growth|roe|ratio)/i.test(key);
      if (isPctField) {
        results.push({ path, value });
      }
    } else if (typeof value === 'string') {
      // Extract numeric value from string like "25.5%"
      const match = value.match(/^(-?\d+\.?\d*)%?$/);
      if (match) {
        results.push({ path, value: parseFloat(match[1]) });
      }
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      results.push(...findPercentageFields(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          results.push(...findPercentageFields(item as Record<string, unknown>, `${path}[${i}]`));
        }
      });
    }
  }

  return results;
}

/**
 * Set a nested value in an object by dot-notation path.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) return;
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Validate that verdict is consistent with the section data.
 */
function validateVerdictConsistency(
  sectionKey: string,
  verdict: string,
  data: Record<string, unknown>,
): string | null {
  const vl = verdict.toLowerCase();
  const textContent = JSON.stringify(data).toLowerCase();

  // Count positive vs negative signals
  const positiveSignals = ['strong', 'bullish', 'growth', 'positive', 'attractive', 'outperform', 'beat'];
  const negativeSignals = ['weak', 'bearish', 'decline', 'negative', 'expensive', 'underperform', 'miss', 'risk'];

  const positiveCount = positiveSignals.filter(s => textContent.includes(s)).length;
  const negativeCount = negativeSignals.filter(s => textContent.includes(s)).length;

  // Check for extreme inconsistency
  if (vl.includes('bullish') || vl.includes('strong') || vl.includes('positive')) {
    if (negativeCount > positiveCount * 3 && negativeCount >= 4) {
      return `Verdict "${verdict}" contradicts predominantly negative content (${negativeCount} negative vs ${positiveCount} positive signals)`;
    }
  }

  if (vl.includes('bearish') || vl.includes('weak') || vl.includes('negative')) {
    if (positiveCount > negativeCount * 3 && positiveCount >= 4) {
      return `Verdict "${verdict}" contradicts predominantly positive content (${positiveCount} positive vs ${negativeCount} negative signals)`;
    }
  }

  return null;
}

// ─── Verdict Pre-Synthesis Filtering ───────────────────────────────────────────

/** Patterns for unverified claims that should be filtered from verdict synthesis */
const UNVERIFIED_CLAIM_PATTERNS = [
  // Unverified customer concentration
  /\b(\d+)%\s*(of\s+)?revenue\s*(from|comes?\s+from|derived\s+from)\s+(?:top\s+)?\d+\s*customers?/i,
  /customer\s+(?:X|A|B|C)\s+(?:accounts?\s+for|represents?)\s+(\d+)%/i,
  /top\s+(?:customer|client)\s+(?:represents?|accounts?\s+for)\s+(\d+)%/i,
  
  // Estimated/fabricated percentages
  /estimated\s+(?:at\s+)?(\d+)%/i,
  /approximately\s+(\d+)%\s+(?:of\s+)?(?:revenue|sales|income)/i,
  /\b(likely|probably|expected)\s+(?:around\s+)?(\d+)%/i,
  
  // Unsupported legal claims
  /SEC\s+(?:is\s+)?(?:investigating|probing|looking\s+into)/i,
  /class\s+action\s+(?:lawsuit|suit|litigation)\s+(?:filed|pending)/i,
  /(?:fraud|manipulation|misconduct)\s+(?:allegations?|charges?|claims?)/i,
  /regulatory\s+(?:action|investigation|probe)\s+(?:initiated|launched|ongoing)/i,
  
  // Hallucinated risk factors
  /(?:confirmed|verified|reported)\s+(?:accounting\s+)?irregularities?/i,
  /whistleblower\s+(?:complaint|report|allegation)/i,
  /management\s+(?:fraud|malfeasance|misconduct)\s+(?:confirmed|found)/i,
];

/** Filter patterns for specific unreliable content by section */
const SECTION_FILTER_PATTERNS: Record<string, RegExp[]> = {
  customer_concentration: [
    /customer\s+(?:X|A|B|C|#?\d)\s+(?:accounts?\s+for|represents?)\s+\d+%/i,
    /\b\d+%\s+(?:concentration|dependency)/i,
    /(?:top|largest)\s+\d+\s+customers?\s+(?:account|represent)\s+\d+%/i,
  ],
  risk_red_teaming: [
    /SEC\s+(?:is\s+)?(?:investigating|probing)/i,
    /(?:fraud|manipulation)\s+(?:confirmed|found|detected)/i,
    /class\s+action\s+(?:lawsuit|suit)\s+(?:filed|won)/i,
  ],
};

export interface FilteredVerdictInput {
  sectionKey: string;
  bullPoints: string[];
  bearPoints: string[];
  verdict: string;
  score: number;
  confidence: number;
}

export interface FilterResult {
  filtered: FilteredVerdictInput;
  removedClaims: string[];
  wasModified: boolean;
}

/**
 * Filter unverified claims from module output before verdict synthesis.
 * Removes:
 * - Unverified customer concentration percentages
 * - Estimated/fabricated percentages
 * - Unsupported legal claims
 * - Hallucinated risk factors
 */
export function filterClaimsForVerdict(input: FilteredVerdictInput): FilterResult {
  const removedClaims: string[] = [];
  
  // Get section-specific patterns, if any
  const sectionPatterns = SECTION_FILTER_PATTERNS[input.sectionKey] ?? [];
  const allPatterns = [...UNVERIFIED_CLAIM_PATTERNS, ...sectionPatterns];

  // Filter bull points
  const filteredBullPoints = input.bullPoints.filter(point => {
    for (const pattern of allPatterns) {
      if (pattern.test(point)) {
        removedClaims.push(`[BULL] ${point.substring(0, 50)}...`);
        return false;
      }
    }
    return true;
  });

  // Filter bear points
  const filteredBearPoints = input.bearPoints.filter(point => {
    for (const pattern of allPatterns) {
      if (pattern.test(point)) {
        removedClaims.push(`[BEAR] ${point.substring(0, 50)}...`);
        return false;
      }
    }
    return true;
  });

  const wasModified = removedClaims.length > 0;

  // Log filtered claims for debugging
  if (wasModified) {
    console.warn(`[validation:filter_claims] ${input.sectionKey} — removed ${removedClaims.length} unverified claims`);
  }

  return {
    filtered: {
      ...input,
      bullPoints: filteredBullPoints,
      bearPoints: filteredBearPoints,
    },
    removedClaims,
    wasModified,
  };
}

/**
 * Filter all module outputs before final verdict synthesis.
 * Returns cleaned modules and list of all removed claims.
 */
export function filterAllModulesForVerdict(
  modules: Record<string, FilteredVerdictInput>,
): { filtered: Record<string, FilteredVerdictInput>; allRemovedClaims: string[] } {
  const filtered: Record<string, FilteredVerdictInput> = {};
  const allRemovedClaims: string[] = [];

  for (const [key, module] of Object.entries(modules)) {
    const result = filterClaimsForVerdict({ ...module, sectionKey: key });
    filtered[key] = result.filtered;
    allRemovedClaims.push(...result.removedClaims);
  }

  if (allRemovedClaims.length > 0) {
    console.warn(`[validation:filter_all_modules] Total claims filtered before verdict: ${allRemovedClaims.length}`);
  }

  return { filtered, allRemovedClaims };
}
