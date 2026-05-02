/**
 * Extraction Module
 * Extracts: skills, experience years, project signals
 */

import type { SkillEntry } from "./normalizer.js";

export interface ExtractionResult {
  explicitSkills: string[];
  impliedSkills: string[];
  experienceYears: number | null;
  projectSignals: string[];
  keywordFrequency: Record<string, number>;
}

// Extract years of experience from text
export function extractExperienceYears(text: string): number | null {
  const lower = text.toLowerCase();

  const patterns = [
    /(\d+)\s*\+\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /over\s+(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /more\s+than\s+(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s+years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*-\s*(\d+)\s*years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*years?\s+(?:in|working|as|with)/i,
  ];

  for (const pattern of patterns) {
    const m = lower.match(pattern);
    if (m) {
      return parseInt(m[1], 10);
    }
  }

  // Infer from date ranges (e.g., "2015 – 2023" or "2018 to present")
  const dateRanges: number[] = [];
  const rangePattern = /\b(20\d{2}|19\d{2})\s*[-–to]+\s*(20\d{2}|present|current|now)\b/gi;
  let match;
  while ((match = rangePattern.exec(text)) !== null) {
    const start = parseInt(match[1], 10);
    const end = match[2].match(/\d{4}/) ? parseInt(match[2], 10) : new Date().getFullYear();
    if (end > start && end - start < 50) {
      dateRanges.push(end - start);
    }
  }

  if (dateRanges.length > 0) {
    return Math.min(dateRanges.reduce((a, b) => a + b, 0), 30);
  }

  return null;
}

// Extract project signals
export function extractProjectSignals(text: string): string[] {
  const signals: string[] = [];
  const lower = text.toLowerCase();

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
    if (pattern.test(lower) || pattern.test(text)) {
      signals.push(signal);
    }
  }

  return [...new Set(signals)];
}

// Build keyword frequency map for adversarial detection
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

// Extract skills from text given skills taxonomy
export function extractSkills(
  text: string,
  skillsTaxonomy: SkillEntry[]
): { explicit: string[]; implied: string[] } {
  const lower = text.toLowerCase();
  const explicit: string[] = [];
  const implied: string[] = [];

  for (const skill of skillsTaxonomy) {
    // Check canonical name
    const canonLower = skill.canonical.toLowerCase();
    if (lower.includes(canonLower)) {
      explicit.push(skill.canonical);
      continue;
    }

    // Check synonyms
    let foundSynonym = false;
    for (const syn of skill.synonyms) {
      if (lower.includes(syn.toLowerCase())) {
        explicit.push(skill.canonical);
        foundSynonym = true;
        break;
      }
    }

    if (!foundSynonym) {
      // Check implicit phrases
      for (const phrase of skill.implicitPhrases) {
        if (lower.includes(phrase.toLowerCase())) {
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
