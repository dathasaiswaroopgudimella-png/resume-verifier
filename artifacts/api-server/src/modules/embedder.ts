/**
 * Embedding Module
 * TF-IDF based vector embeddings and cosine similarity
 * Caches computed document vectors for performance
 */

const embeddingCache = new Map<string, Map<string, number>>();

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "was", "are", "were", "be", "been", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "this", "that", "these", "those",
  "i", "we", "you", "he", "she", "it", "they", "my", "our", "your",
  "his", "her", "its", "their", "as", "from", "into", "through", "during",
  "before", "after", "above", "below", "up", "down", "out", "off", "over",
  "under", "again", "further", "then", "once", "more", "also", "if",
  "very", "just", "so", "about", "when", "which", "who", "whom", "what",
  "where", "how", "all", "both", "each", "few", "other", "such", "own",
  "same", "than", "too", "not", "no", "nor", "only", "any", "well",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function computeTF(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [term, count] of freq) {
    tf.set(term, count / total);
  }
  return tf;
}

// Simple IDF approximation using presence in both docs
function computeTFIDF(text: string, otherText: string): Map<string, number> {
  const tokens = tokenize(text);
  const otherTokens = new Set(tokenize(otherText));
  const tf = computeTF(tokens);
  const tfidf = new Map<string, number>();

  for (const [term, tfVal] of tf) {
    // IDF: log(2 / (1 + df)) where df = 1 if in other doc, 0 if not
    const df = otherTokens.has(term) ? 1 : 0;
    const idf = Math.log(2 / (1 + df));
    // If the term only appears in this doc, idf = log(2/1) ≈ 0.693
    // If appears in both, idf = log(2/2) = 0 — shared vocab naturally upweights unique discriminative terms
    // But we want shared terms to contribute too, so use smoothed IDF
    const smoothedIdf = Math.log(1 + (df === 0 ? 2 : 1));
    tfidf.set(term, tfVal * smoothedIdf);
  }

  return tfidf;
}

function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vecA) {
    const valB = vecB.get(term) ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
  }

  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Apply adversarial diminishing returns to keyword-stuffed terms
function adversarialDiminishingReturns(
  vec: Map<string, number>,
  freq: Record<string, number>
): Map<string, number> {
  const adjusted = new Map<string, number>();
  for (const [term, val] of vec) {
    const count = freq[term] ?? 1;
    // Diminishing returns: score *= 1 / log(1 + frequency)
    const damping = count > 3 ? 1 / Math.log(1 + count) : 1;
    adjusted.set(term, val * damping);
  }
  return adjusted;
}

export interface EmbeddingResult {
  semanticScore: number;
  adversarialFlags: string[];
}

export function computeSemanticSimilarity(
  resumeText: string,
  jobText: string,
  resumeFreq: Record<string, number>
): EmbeddingResult {
  const cacheKey = `${resumeText.slice(0, 100)}_${jobText.slice(0, 100)}`;

  let resumeVec: Map<string, number>;
  if (embeddingCache.has(cacheKey)) {
    resumeVec = embeddingCache.get(cacheKey)!;
  } else {
    resumeVec = computeTFIDF(resumeText, jobText);
    embeddingCache.set(cacheKey, resumeVec);
    if (embeddingCache.size > 500) {
      // Evict oldest entry
      embeddingCache.delete(embeddingCache.keys().next().value!);
    }
  }

  const jobVec = computeTFIDF(jobText, resumeText);

  // Detect adversarial keyword stuffing
  const adversarialFlags: string[] = [];
  const highFreqTerms = Object.entries(resumeFreq).filter(([, count]) => count > 5);
  if (highFreqTerms.length > 5) {
    adversarialFlags.push(
      `Keyword repetition detected: ${highFreqTerms
        .slice(0, 3)
        .map(([t, c]) => `"${t}" (×${c})`)
        .join(", ")}`
    );
  }

  // Apply adversarial damping to resume vector
  const adjustedResumeVec = adversarialDiminishingReturns(resumeVec, resumeFreq);

  const raw = cosineSimilarity(adjustedResumeVec, jobVec);
  // Scale cosine similarity (typically 0–0.4 range) to 0–100
  const semanticScore = Math.min(100, Math.round(raw * 280));

  return { semanticScore, adversarialFlags };
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}
