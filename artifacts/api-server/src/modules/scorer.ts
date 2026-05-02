/**
 * Scoring Engine
 * Computes baseScore, applies penalty system, outputs finalScore
 */

import { skillsTaxonomy, classifyDomain, getSkillWeight } from "./normalizer.js";
import { extractExperienceYears, extractProjectSignals, buildKeywordFrequency, extractSkills } from "./extractor.js";
import { computeSemanticSimilarity } from "./embedder.js";
import { parseText } from "./parser.js";

export interface PenaltyBreakdown {
  domainMismatch: number;
  lowCoreSkillMatch: number;
  experienceGap: number;
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

function normalizedVariance(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  return Math.sqrt(variance) / 100; // Normalize to 0–1
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
  const allJobSkills = [...jobRequiredSkills, ...jobPreferredSkills];
  const coreJobSkills = jobRequiredSkills;

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of allJobSkills) {
    const inExplicit = explicitSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    const inImplied = impliedSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    if (inExplicit || inImplied) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Weighted skill score: required skills weight 1.0, preferred 0.5
  let skillNumerator = 0;
  let skillDenominator = 0;

  for (const skill of coreJobSkills) {
    const w = getSkillWeight(skill);
    skillDenominator += w * 1.0;
    if (matchedSkills.includes(skill)) {
      skillNumerator += w * 1.0;
    } else if (impliedSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      skillNumerator += w * 0.5; // Implied skills half weight
    }
  }

  for (const skill of jobPreferredSkills) {
    const w = getSkillWeight(skill);
    skillDenominator += w * 0.5;
    if (matchedSkills.includes(skill)) {
      skillNumerator += w * 0.5;
    }
  }

  const rawSkillScore = skillDenominator > 0 ? skillNumerator / skillDenominator : 0;
  const weightedSkillScore = clamp(Math.round(rawSkillScore * 100), 0, 100);

  // --- Experience Score ---
  let experienceScore = 50; // Default when unknown
  if (experienceYears !== null && jobExperienceRequired > 0) {
    if (experienceYears >= jobExperienceRequired) {
      // Over-qualified still gets high score (small diminishing return)
      const overQualRatio = experienceYears / jobExperienceRequired;
      experienceScore = clamp(Math.round(80 + Math.min(20, (overQualRatio - 1) * 10)), 0, 100);
    } else {
      // Under-qualified — proportional penalty
      const ratio = experienceYears / jobExperienceRequired;
      experienceScore = clamp(Math.round(ratio * 80), 0, 100);
    }
  } else if (experienceYears === null) {
    experienceScore = 40; // Unknown experience → lower
  }

  // Project signals bonus
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

  const alignmentScore =
    resumeDomain.topDomain === jobDomainEffective
      ? resumeDomain.distribution[jobDomainEffective] ?? 0
      : resumeDomain.distribution[jobDomainEffective] ?? 0;

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

  let totalPenalty =
    penalties.domainMismatch + penalties.lowCoreSkillMatch + penalties.experienceGap;

  // Damping
  if (totalPenalty > 40) {
    totalPenalty = Math.round(totalPenalty * 0.7);
    penalties.damped = true;
  }

  // Clamp max penalty
  totalPenalty = Math.min(60, totalPenalty);
  penalties.total = totalPenalty;

  const finalScore = clamp(baseScore - totalPenalty, 0, 100);

  // --- Confidence ---
  const variance = normalizedVariance([semanticScore, weightedSkillScore, experienceScore]);
  const rawConfidence = 1 - Math.min(1, variance * 3);
  // Lower confidence if sparse input
  const wordCountFactor = parsed.wordCount < 50 ? 0.7 : parsed.wordCount < 100 ? 0.85 : 1;
  const confidence = Math.round(rawConfidence * wordCountFactor * 100) / 100;

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
      message: `Adversarial signal detected: ${adversarialFlags[0]}. Scores adjusted with diminishing returns.`,
    });
  }

  if (confidence < 0.4) {
    warnings.push({
      type: "LOW_CONFIDENCE",
      message: `Low confidence score (${confidence}). Results may be unreliable due to sparse or inconsistent signals.`,
    });
  }

  // Parser warnings as LOW_CONFIDENCE
  for (const w of parserWarnings) {
    warnings.push({ type: "LOW_CONFIDENCE", message: w });
  }

  // --- Explanation ---
  const explanation = generateExplanation({
    finalScore,
    semanticScore,
    weightedSkillScore,
    experienceScore,
    matchedSkills,
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
  matchedSkills: string[];
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
    matchedSkills,
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

  if (matchedSkills.length > 0) {
    parts.push(`Matched ${matchedSkills.length} required/preferred skills: ${matchedSkills.slice(0, 5).join(", ")}${matchedSkills.length > 5 ? ` +${matchedSkills.length - 5} more` : ""}. `);
  }

  if (missingSkills.length > 0) {
    parts.push(`Missing ${missingSkills.length} skills: ${missingSkills.slice(0, 5).join(", ")}. `);
  }

  if (domainAlignment.detectedDomain !== domainAlignment.jobDomain) {
    parts.push(
      `Domain mismatch: resume appears to be from ${domainAlignment.detectedDomain} domain, job requires ${domainAlignment.jobDomain}. `
    );
  }

  if (penalties.total > 0) {
    const penaltyParts: string[] = [];
    if (penalties.domainMismatch > 0) penaltyParts.push(`domain mismatch (-${penalties.domainMismatch})`);
    if (penalties.lowCoreSkillMatch > 0) penaltyParts.push(`low core skill match (-${penalties.lowCoreSkillMatch})`);
    if (penalties.experienceGap > 0) penaltyParts.push(`experience gap (-${penalties.experienceGap})`);
    parts.push(`Penalties applied: ${penaltyParts.join(", ")}${penalties.damped ? " (damped)" : ""}. `);
  }

  if (projectSignals.length > 0) {
    parts.push(`Positive signals: ${projectSignals.join(", ")}. `);
  }

  return parts.join("").trim();
}

function emptyResult(warnings: string[]): ScoreResult {
  return {
    finalScore: 0,
    semanticScore: 0,
    weightedSkillScore: 0,
    experienceScore: 0,
    baseScore: 0,
    penalties: { domainMismatch: 0, lowCoreSkillMatch: 0, experienceGap: 0, total: 0, damped: false },
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
