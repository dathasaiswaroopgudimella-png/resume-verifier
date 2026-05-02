/**
 * Scoring Engine
 * Computes baseScore, applies penalty system, outputs finalScore
 *
 * Key fix over v1:
 *   Implied skills dead code — previously, implied skills were added to
 *   matchedSkills[] immediately, so the scorer always took the "explicit"
 *   branch (full weight 1.0). The intended 0.5 half-weight branch was
 *   unreachable dead code. Fixed by tracking explicit and implied separately.
 */

import { skillsTaxonomy, classifyDomain, getSkillWeight } from "./normalizer.js";
import { extractExperienceYears, extractProjectSignals, buildKeywordFrequency, extractSkills } from "./extractor.js";
import { computeSemanticSimilarity } from "./embedder.js";
import { parseText } from "./parser.js";

export interface PenaltyBreakdown {
  domainMismatch: number;
  lowCoreSkillMatch: number;
  experienceGap: number;
  adversarialStuffing: number;
  total: number;
  damped: boolean;
}

export interface Warning {
  type:
    | "SEMANTIC_SKILL_CONTRADICTION"
    | "SKILL_SEMANTIC_CONTRADICTION"
    | "EXPERIENCE_SKILL_CONTRADICTION"
    | "ADVERSARIAL_KEYWORD_STUFFING"
    | "LOW_CONFIDENCE";
  message: string;
}

export interface DomainAlignment {
  detectedDomain: string;
  jobDomain: string;
  alignmentScore: number;
  distribution: Record<string, number>;
}

export interface ScoreResult {
  finalScore: number;
  semanticScore: number;
  weightedSkillScore: number;
  experienceScore: number;
  baseScore: number;
  penalties: PenaltyBreakdown;
  confidence: number;
  matchedSkills: string[];
  missingSkills: string[];
  impliedSkills: string[];
  warnings: Warning[];
  explanation: string;
  domainAlignment: DomainAlignment;
  adversarialFlags: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute normalized variance of a set of scores (kept for backward compat;
 * no longer used for confidence — see computeConfidence).
 */
function normalizedVariance(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  return Math.sqrt(variance) / 100;
}

/**
 * Confidence reflects DATA RICHNESS, not signal agreement.
 *
 * Contradictory signals (high experience + zero skills) are INFORMATIVE —
 * they correctly produce a REJECT decision. Penalizing confidence for variance
 * causes INSUFFICIENT_DATA to fire when the system actually has plenty of data.
 *
 * Formula:
 *   - Word count drives 70% of confidence (do we have enough text to analyze?)
 *   - Number of non-default signals drives 30% (semantic/skill/experience each count)
 *   - Result is clamped to [0, 1]
 *
 * Threshold in makeDecision is 0.1 — only truly empty / extremely sparse
 * resumes (< ~20 words, no signals at all) trigger INSUFFICIENT_DATA.
 */
function computeConfidence(
  wordCount: number,
  semanticScore: number,
  weightedSkillScore: number,
  experienceScore: number
): number {
  // Word count: saturates at 200 words (typical resume has 300–500)
  const wordCountConfidence = clamp((wordCount - 20) / 200, 0, 1);

  // Signal count: each non-default score counts as an active signal
  // experienceScore defaults to 50 when experience is unknown → only credit >55 or <45
  const signals = [
    semanticScore > 5,
    weightedSkillScore > 0,
    experienceScore !== 50 && experienceScore > 0,
  ].filter(Boolean).length;
  const signalConfidence = signals / 3;

  return Math.round(clamp(wordCountConfidence * 0.7 + signalConfidence * 0.3, 0, 1) * 100) / 100;
}

export function scoreResumeAgainstJob(
  resumeText: string,
  jobText: string,
  jobRequiredSkills: string[] = [],
  jobPreferredSkills: string[] = [],
  jobExperienceRequired: number = 0,
  jobDomain: string = ""
): ScoreResult {
  const parsed = parseText(resumeText);
  const parserWarnings = parsed.warnings;

  if (parsed.isEmpty) {
    return emptyResult(parserWarnings);
  }

  const cleanResume = parsed.text;

  // --- Extract ---
  const resumeFreq = buildKeywordFrequency(cleanResume);
  const { explicit: explicitSkills, implied: impliedSkills } = extractSkills(cleanResume, skillsTaxonomy);
  const experienceYears = extractExperienceYears(cleanResume);
  const projectSignals = extractProjectSignals(cleanResume);

  // --- Semantic Score ---
  const { semanticScore, adversarialFlags } = computeSemanticSimilarity(cleanResume, jobText, resumeFreq);

  // --- Skill Score ---
  // FIX: Track explicit and implied matches separately so implied skills
  // correctly receive half weight (0.5) instead of full weight (1.0).
  const allJobSkills = [...jobRequiredSkills, ...jobPreferredSkills];
  const coreJobSkills = jobRequiredSkills;

  const matchedSkillsExplicit: string[] = [];
  const matchedSkillsImplied: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of allJobSkills) {
    const inExplicit = explicitSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    const inImplied = impliedSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    if (inExplicit) {
      matchedSkillsExplicit.push(skill);
    } else if (inImplied) {
      // Implied: candidate likely has the skill but didn't state it explicitly.
      matchedSkillsImplied.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Combined matched skills for display output
  const matchedSkills = [...matchedSkillsExplicit, ...matchedSkillsImplied];

  // Weighted skill score: required × 1.0 (explicit) or × 0.5 (implied); preferred × 0.5
  let skillNumerator = 0;
  let skillDenominator = 0;

  for (const skill of coreJobSkills) {
    const w = getSkillWeight(skill);
    skillDenominator += w * 1.0;

    if (matchedSkillsExplicit.includes(skill)) {
      skillNumerator += w * 1.0; // Explicitly stated — full credit
    } else if (matchedSkillsImplied.includes(skill)) {
      skillNumerator += w * 0.5; // Inferred from context — half credit (now executes correctly)
    }
    // Missing: 0 contribution
  }

  for (const skill of jobPreferredSkills) {
    const w = getSkillWeight(skill);
    skillDenominator += w * 0.5;
    if (matchedSkillsExplicit.includes(skill) || matchedSkillsImplied.includes(skill)) {
      skillNumerator += w * 0.5;
    }
  }

  const rawSkillScore = skillDenominator > 0 ? skillNumerator / skillDenominator : 0;
  const weightedSkillScore = clamp(Math.round(rawSkillScore * 100), 0, 100);

  // --- Experience Score ---
  let experienceScore = 50; // Default when unknown
  if (experienceYears !== null && jobExperienceRequired > 0) {
    if (experienceYears >= jobExperienceRequired) {
      const overQualRatio = experienceYears / jobExperienceRequired;
      experienceScore = clamp(Math.round(80 + Math.min(20, (overQualRatio - 1) * 10)), 0, 100);
    } else {
      const ratio = experienceYears / jobExperienceRequired;
      experienceScore = clamp(Math.round(ratio * 80), 0, 100);
    }
  } else if (experienceYears === null) {
    experienceScore = 40;
  }

  if (projectSignals.includes("measurable_impact") || projectSignals.includes("scale_experience")) {
    experienceScore = clamp(experienceScore + 10, 0, 100);
  }

  // --- Base Score ---
  const baseScore = clamp(
    Math.round(
      0.5 * semanticScore +
      0.3 * weightedSkillScore +
      0.2 * experienceScore
    ),
    0,
    100
  );

  // --- Domain Alignment ---
  const allExtracted = [...explicitSkills, ...impliedSkills];
  const resumeDomain = classifyDomain(allExtracted, cleanResume);
  const jobDomainEffective = jobDomain || classifyDomain([], jobText).topDomain;

  const alignmentScore = resumeDomain.distribution[jobDomainEffective] ?? 0;

  const domainAlignment: DomainAlignment = {
    detectedDomain: resumeDomain.topDomain,
    jobDomain: jobDomainEffective,
    alignmentScore: Math.round(alignmentScore * 100) / 100,
    distribution: resumeDomain.distribution,
  };

  // --- Penalties ---
  const penalties: PenaltyBreakdown = {
    domainMismatch: 0,
    lowCoreSkillMatch: 0,
    experienceGap: 0,
    adversarialStuffing: 0,
    total: 0,
    damped: false,
  };

  // Domain mismatch penalty
  if (resumeDomain.topDomain !== jobDomainEffective) {
    const domainProbability = resumeDomain.distribution[jobDomainEffective] ?? 0;
    penalties.domainMismatch = Math.round((1 - domainProbability) * 20);
  }

  // Low core skill match penalty
  const coreSkillMatchRate =
    coreJobSkills.length > 0
      ? matchedSkills.filter((s) => coreJobSkills.includes(s)).length / coreJobSkills.length
      : 1;

  if (coreSkillMatchRate < 0.5) {
    penalties.lowCoreSkillMatch = Math.round((0.5 - coreSkillMatchRate) * 50);
  }

  // Experience gap penalty
  if (experienceYears !== null && jobExperienceRequired > 0) {
    const gap = jobExperienceRequired - experienceYears;
    if (gap > 0) {
      penalties.experienceGap = Math.min(15, Math.round(gap * 3));
    }
  }

  // Adversarial stuffing penalty: credibility deduction when stuffing is detected.
  // BM25 already limits the semantic score gain; this adds an explicit fairness signal.
  if (adversarialFlags.length > 0) {
    penalties.adversarialStuffing = 10;
  }

  let totalPenalty =
    penalties.domainMismatch +
    penalties.lowCoreSkillMatch +
    penalties.experienceGap +
    penalties.adversarialStuffing;

  // Damping: stacking penalties shouldn't compound unfairly for poor-fit resumes
  if (totalPenalty > 40) {
    totalPenalty = Math.round(totalPenalty * 0.7);
    penalties.damped = true;
  }

  totalPenalty = Math.min(60, totalPenalty);
  penalties.total = totalPenalty;

  const finalScore = clamp(baseScore - totalPenalty, 0, 100);

  // --- Confidence (data richness, not signal agreement — see computeConfidence) ---
  const confidence = computeConfidence(
    parsed.wordCount,
    semanticScore,
    weightedSkillScore,
    experienceScore
  );

  // --- Contradiction Warnings ---
  const warnings: Warning[] = [];

  if (semanticScore > 70 && weightedSkillScore < 30) {
    warnings.push({
      type: "SEMANTIC_SKILL_CONTRADICTION",
      message: `High semantic similarity (${semanticScore}) but low skill match (${weightedSkillScore}). May indicate general vocabulary overlap without technical depth.`,
    });
  }

  if (weightedSkillScore > 70 && semanticScore < 30) {
    warnings.push({
      type: "SKILL_SEMANTIC_CONTRADICTION",
      message: `High skill match (${weightedSkillScore}) but low semantic similarity (${semanticScore}). Candidate may have the skills but different domain framing.`,
    });
  }

  if (experienceScore > 70 && weightedSkillScore < 30) {
    warnings.push({
      type: "EXPERIENCE_SKILL_CONTRADICTION",
      message: `High experience score (${experienceScore}) but low skill match (${weightedSkillScore}). Long tenure may be in a different domain.`,
    });
  }

  if (adversarialFlags.length > 0) {
    warnings.push({
      type: "ADVERSARIAL_KEYWORD_STUFFING",
      message: `Adversarial signal detected: ${adversarialFlags[0]}. BM25 saturation applied; credibility penalty (-${penalties.adversarialStuffing}) added.`,
    });
  }

  if (confidence < 0.4) {
    warnings.push({
      type: "LOW_CONFIDENCE",
      message: `Low confidence score (${confidence}). Results may be unreliable due to sparse or inconsistent signals.`,
    });
  }

  for (const w of parserWarnings) {
    warnings.push({ type: "LOW_CONFIDENCE", message: w });
  }

  // --- Explanation ---
  const explanation = generateExplanation({
    finalScore,
    semanticScore,
    weightedSkillScore,
    experienceScore,
    matchedSkillsExplicit,
    matchedSkillsImplied,
    missingSkills,
    penalties,
    warnings,
    domainAlignment,
    projectSignals,
  });

  return {
    finalScore,
    semanticScore,
    weightedSkillScore,
    experienceScore,
    baseScore,
    penalties,
    confidence,
    matchedSkills,
    missingSkills,
    impliedSkills,
    warnings,
    explanation,
    domainAlignment,
    adversarialFlags,
  };
}

function generateExplanation(params: {
  finalScore: number;
  semanticScore: number;
  weightedSkillScore: number;
  experienceScore: number;
  matchedSkillsExplicit: string[];
  matchedSkillsImplied: string[];
  missingSkills: string[];
  penalties: PenaltyBreakdown;
  warnings: Warning[];
  domainAlignment: DomainAlignment;
  projectSignals: string[];
}): string {
  const {
    finalScore,
    semanticScore,
    weightedSkillScore,
    experienceScore,
    matchedSkillsExplicit,
    matchedSkillsImplied,
    missingSkills,
    penalties,
    domainAlignment,
    projectSignals,
  } = params;

  const parts: string[] = [];

  parts.push(
    `Final score: ${finalScore}/100. ` +
    `Semantic alignment: ${semanticScore}/100 — ` +
    `${semanticScore >= 60 ? "strong" : semanticScore >= 40 ? "moderate" : "weak"} overall thematic match. `
  );

  if (matchedSkillsExplicit.length > 0) {
    parts.push(
      `Explicitly matched ${matchedSkillsExplicit.length} skills: ${matchedSkillsExplicit.slice(0, 5).join(", ")}` +
      `${matchedSkillsExplicit.length > 5 ? ` +${matchedSkillsExplicit.length - 5} more` : ""}. `
    );
  }

  if (matchedSkillsImplied.length > 0) {
    parts.push(
      `Implied (half-credit) ${matchedSkillsImplied.length} skills: ${matchedSkillsImplied.slice(0, 3).join(", ")}. `
    );
  }

  if (missingSkills.length > 0) {
    parts.push(`Missing ${missingSkills.length} skills: ${missingSkills.slice(0, 5).join(", ")}. `);
  }

  if (domainAlignment.detectedDomain !== domainAlignment.jobDomain) {
    parts.push(
      `Domain mismatch: resume appears to be from ${domainAlignment.detectedDomain}, job requires ${domainAlignment.jobDomain}. `
    );
  }

  if (penalties.total > 0) {
    const penaltyParts: string[] = [];
    if (penalties.domainMismatch > 0) penaltyParts.push(`domain mismatch (-${penalties.domainMismatch})`);
    if (penalties.lowCoreSkillMatch > 0) penaltyParts.push(`low core skill match (-${penalties.lowCoreSkillMatch})`);
    if (penalties.experienceGap > 0) penaltyParts.push(`experience gap (-${penalties.experienceGap})`);
    if (penalties.adversarialStuffing > 0) penaltyParts.push(`adversarial stuffing credibility (-${penalties.adversarialStuffing})`);
    parts.push(`Penalties applied: ${penaltyParts.join(", ")}${penalties.damped ? " (damped)" : ""}. `);
  }

  if (projectSignals.length > 0) {
    parts.push(`Positive signals: ${projectSignals.join(", ")}. `);
  }

  const skillBreakdown = `Skill score: ${weightedSkillScore}/100; Experience score: ${experienceScore}/100.`;
  parts.push(skillBreakdown);

  return parts.join("").trim();
}

function emptyResult(warnings: string[]): ScoreResult {
  return {
    finalScore: 0,
    semanticScore: 0,
    weightedSkillScore: 0,
    experienceScore: 0,
    baseScore: 0,
    penalties: {
      domainMismatch: 0,
      lowCoreSkillMatch: 0,
      experienceGap: 0,
      adversarialStuffing: 0,
      total: 0,
      damped: false,
    },
    confidence: 0,
    matchedSkills: [],
    missingSkills: [],
    impliedSkills: [],
    warnings: warnings.map((m) => ({ type: "LOW_CONFIDENCE" as const, message: m })),
    explanation: "Could not score resume — input is empty or invalid.",
    domainAlignment: { detectedDomain: "UNKNOWN", jobDomain: "UNKNOWN", alignmentScore: 0, distribution: {} },
    adversarialFlags: [],
  };
}
