/**
 * Extraction Module
 * Extracts: skills, experience years, project signals, keyword frequency
 *
 * Key fixes over v1:
 *   1. Word-boundary skill matching — "SQL" no longer matches "NoSQL",
 *      "node" no longer matches "knowledge", etc.
 *   2. Date-range overlap correction — overlapping job tenures are merged
 *      before summing, preventing inflation (e.g., 2015–2018 + 2017–2021
 *      = 6 years, not 3+4=7).
 */

import type { SkillEntry } from "./normalizer.js";

export interface ExtractionResult {
  explicitSkills: string[];
  impliedSkills: string[];
  experienceYears: number | null;
  projectSignals: string[];
  keywordFrequency: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Skill matching helpers
// ---------------------------------------------------------------------------

/**
 * Escape special regex characters so skill names like "C++", "ASP.NET",
 * "scikit-learn" can be used safely in a RegExp pattern.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Test whether a skill term appears in text as a standalone word/phrase.
 *
 * Uses negative lookbehind/lookahead (?<![a-zA-Z0-9]) instead of \b so that
 * skills ending with non-word chars (e.g. "C++") are handled correctly.
 *
 * Examples:
 *   "SQL"  vs "NoSQL"         → no match  (fixed false positive)
 *   "node" vs "knowledge"     → no match  (fixed false positive)
 *   "C++"  vs "C++ developer" → match     ✓
 *   "R"    vs "recruiter"     → no match  ✓
 */
function skillMatchesText(skillTerm: string, text: string): boolean {
  try {
    const escaped = escapeRegex(skillTerm);
    const pattern = new RegExp(
      `(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`,
      "i"
    );
    return pattern.test(text);
  } catch {
    // Fallback for any edge-case regex error
    return text.toLowerCase().includes(skillTerm.toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// Experience year extraction
// ---------------------------------------------------------------------------

/**
 * Merge overlapping or adjacent [start, end] intervals and return total span.
 *
 * Example: [[2015,2018], [2017,2021], [2021,2023]] → [[2015,2023]] → 8 years.
 * Without merging, the old code would sum: 3+4+2=9 (inflation by 1 year here,
 * up to 5+ years for candidates with many concurrent roles).
 */
function mergeIntervalsAndSum(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [[...intervals[0]]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    if (intervals[i][0] <= last[1]) {
      // Overlapping or adjacent — extend the current interval
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      merged.push([...intervals[i]]);
    }
  }

  return merged.reduce((sum, [s, e]) => sum + (e - s), 0);
}

/**
 * Map written-out English number words to their numeric values.
 * Handles the common case of "Seventeen years experience" → 17.
 */
const WRITTEN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty-one": 21, "twenty-two": 22, "twenty-three": 23, "twenty-four": 24,
  "twenty-five": 25, "twenty-six": 26, "twenty-seven": 27, "twenty-eight": 28,
  "twenty-nine": 29, thirty: 30,
};

export function extractExperienceYears(text: string): number | null {
  const lower = text.toLowerCase();

  // --- Digit patterns — highest priority ---
  const explicitPatterns = [
    /(\d+)\s*\+\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /over\s+(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /more\s+than\s+(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s+years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*-\s*(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*years?\s+(?:in|working|as|with)/i,
  ];

  for (const pattern of explicitPatterns) {
    const m = lower.match(pattern);
    if (m) {
      return parseInt(m[1], 10);
    }
  }

  // --- Written-number patterns (e.g. "Seventeen years experience") ---
  const writtenPattern = new RegExp(
    `\\b(${Object.keys(WRITTEN_NUMBERS).join("|")})\\s+years?\\s+(?:of\\s+)?(?:experience|exp|in|working)`,
    "i"
  );
  const wm = lower.match(writtenPattern);
  if (wm) {
    return WRITTEN_NUMBERS[wm[1].toLowerCase()] ?? null;
  }

  // Infer from date ranges — collect and MERGE before summing
  const intervals: [number, number][] = [];
  const rangePattern =
    /\b(20\d{2}|19\d{2})\s*[-–to]+\s*(20\d{2}|present|current|now)\b/gi;
  let match;

  while ((match = rangePattern.exec(text)) !== null) {
    const start = parseInt(match[1], 10);
    const end = match[2].match(/\d{4}/)
      ? parseInt(match[2], 10)
      : new Date().getFullYear();
    if (end > start && end - start < 50) {
      intervals.push([start, end]);
    }
  }

  if (intervals.length > 0) {
    return Math.min(mergeIntervalsAndSum(intervals), 30);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Project signal extraction (unchanged — working correctly)
// ---------------------------------------------------------------------------

export function extractProjectSignals(text: string): string[] {
  const signals: string[] = [];

  const projectPatterns = [
    { pattern: /\bled\s+(?:a\s+)?(?:team|project|initiative)/i, signal: "team_lead" },
    { pattern: /\bmanaged\s+(?:a\s+)?(?:team|project|engineers|developers)/i, signal: "management" },
    { pattern: /\b(?:designed|architected)\s+(?:and\s+)?(?:implemented|built)/i, signal: "system_design" },
    { pattern: /\b(?:reduced|improved|increased|optimized|saved)\s+[\w\s]+(?:by\s+\d+%|\$[\d,]+)/i, signal: "measurable_impact" },
    { pattern: /\b(?:shipped|launched|deployed|released)\s+(?:to\s+)?(?:production|users|customers)/i, signal: "shipped_product" },
    { pattern: /\bmillion\s+(?:users|requests|records|customers)/i, signal: "scale_experience" },
    { pattern: /\bopen[- ]source/i, signal: "open_source" },
    { pattern: /\bpatent/i, signal: "patent" },
    { pattern: /\bpublish(?:ed)?\s+(?:paper|research|article)/i, signal: "research_publication" },
  ];

  for (const { pattern, signal } of projectPatterns) {
    if (pattern.test(text)) {
      signals.push(signal);
    }
  }

  return [...new Set(signals)];
}

// ---------------------------------------------------------------------------
// Keyword frequency (used by adversarial detection in embedder)
// ---------------------------------------------------------------------------

export function buildKeywordFrequency(text: string): Record<string, number> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "was", "are", "were", "be", "been", "have",
    "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "shall", "can", "this", "that", "these", "those",
    "i", "we", "you", "he", "she", "it", "they", "my", "our", "your",
    "his", "her", "its", "their", "as", "from", "into", "through", "during",
    "before", "after", "above", "below", "up", "down", "out", "off", "over",
    "under", "again", "further", "then", "once", "more", "also", "if",
  ]);

  const freq: Record<string, number> = {};
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }

  return freq;
}

// ---------------------------------------------------------------------------
// Skill extraction — uses word-boundary matching (see skillMatchesText above)
// ---------------------------------------------------------------------------

export function extractSkills(
  text: string,
  skillsTaxonomy: SkillEntry[]
): { explicit: string[]; implied: string[] } {
  const explicit: string[] = [];
  const implied: string[] = [];

  for (const skill of skillsTaxonomy) {
    // Check canonical name with word boundaries
    if (skillMatchesText(skill.canonical, text)) {
      explicit.push(skill.canonical);
      continue;
    }

    // Check synonyms with word boundaries
    let foundSynonym = false;
    for (const syn of skill.synonyms) {
      if (skillMatchesText(syn, text)) {
        explicit.push(skill.canonical);
        foundSynonym = true;
        break;
      }
    }

    if (!foundSynonym) {
      // Implicit phrases are multi-word contextual signals — substring is acceptable
      // (these are long phrases like "built restful endpoints", not single tokens)
      for (const phrase of skill.implicitPhrases) {
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          implied.push(skill.canonical);
          break;
        }
      }
    }
  }

  return {
    explicit: [...new Set(explicit)],
    implied: [...new Set(implied)],
  };
}
