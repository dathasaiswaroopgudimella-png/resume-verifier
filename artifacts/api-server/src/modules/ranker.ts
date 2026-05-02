/**
 * Ranking Engine
 * Ranks multiple candidates against a single job
 */

import type { ScoreResult } from "./scorer.js";
import { makeDecision } from "./decision.js";

export interface RankedCandidate {
  rank: number;
  resumeId: string;
  label: string;
  matchResult: ScoreResult & { decision: string };
}

export interface PairwiseComparison {
  candidateA: string;
  candidateB: string;
  winner: string;
  scoreDiff: number;
  keyDifferentiator: string;
}

export interface RankResult {
  jobSummary: string;
  ranked: RankedCandidate[];
  top3: RankedCandidate[];
  pairwiseComparisons: PairwiseComparison[];
}

export function rankCandidates(
  candidates: Array<{ id: string; label: string; score: ScoreResult }>,
  jobTitle: string
): RankResult {
  // Sort by finalScore descending
  const sorted = [...candidates].sort(
    (a, b) => b.score.finalScore - a.score.finalScore
  );

  const ranked: RankedCandidate[] = sorted.map((c, idx) => ({
    rank: idx + 1,
    resumeId: c.id,
    label: c.label,
    matchResult: {
      ...c.score,
      decision: makeDecision(c.score.finalScore, c.score.confidence),
    },
  }));

  const top3 = ranked.slice(0, 3);

  // Pairwise comparisons for top 3
  const pairwiseComparisons: PairwiseComparison[] = [];
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    for (let j = i + 1; j < Math.min(4, ranked.length); j++) {
      const a = ranked[i];
      const b = ranked[j];
      const diff = a.matchResult.finalScore - b.matchResult.finalScore;

      let differentiator = "overall score";
      const semDiff = Math.abs(a.matchResult.semanticScore - b.matchResult.semanticScore);
      const skillDiff = Math.abs(a.matchResult.weightedSkillScore - b.matchResult.weightedSkillScore);
      const expDiff = Math.abs(a.matchResult.experienceScore - b.matchResult.experienceScore);

      if (skillDiff >= semDiff && skillDiff >= expDiff) {
        differentiator = `skill match (${a.matchResult.weightedSkillScore} vs ${b.matchResult.weightedSkillScore})`;
      } else if (semDiff >= skillDiff && semDiff >= expDiff) {
        differentiator = `semantic alignment (${a.matchResult.semanticScore} vs ${b.matchResult.semanticScore})`;
      } else {
        differentiator = `experience relevance (${a.matchResult.experienceScore} vs ${b.matchResult.experienceScore})`;
      }

      pairwiseComparisons.push({
        candidateA: a.resumeId,
        candidateB: b.resumeId,
        winner: a.resumeId,
        scoreDiff: Math.round(diff * 10) / 10,
        keyDifferentiator: differentiator,
      });
    }
  }

  return {
    jobSummary: jobTitle,
    ranked,
    top3,
    pairwiseComparisons,
  };
}
