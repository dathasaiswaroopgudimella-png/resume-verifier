/**
 * Parser Module
 * Input: raw text (resume or job description)
 * Output: cleaned, normalized text
 */

export interface ParseResult {
  text: string;
  wordCount: number;
  isEmpty: boolean;
  warnings: string[];
}

export function parseText(raw: string): ParseResult {
  const warnings: string[] = [];

  if (!raw || typeof raw !== "string") {
    return { text: "", wordCount: 0, isEmpty: true, warnings: ["Input is empty or invalid"] };
  }

  // Remove HTML tags
  let text = raw.replace(/<[^>]+>/g, " ");

  // Normalize unicode quotes and dashes
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");

  // Remove non-ASCII (keep common punctuation)
  text = text.replace(/[^\x00-\x7F]/g, " ");

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (text.length < 50) {
    warnings.push("Very short input — may produce unreliable results");
  }

  if (text.length > 20000) {
    text = text.slice(0, 20000);
    warnings.push("Input truncated to 20,000 characters for safety");
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 20) {
    warnings.push("Input has fewer than 20 words — sparse resume detected");
  }

  return {
    text,
    wordCount,
    isEmpty: wordCount === 0,
    warnings,
  };
}
