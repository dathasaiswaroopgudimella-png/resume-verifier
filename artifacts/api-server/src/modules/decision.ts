/**
 * Decision Engine
 * Translates finalScore + confidence → hiring decision
 */

export type Decision =
  | "STRONG_FIT"
  | "GOOD_FIT"
  | "WEAK_FIT"
  | "REJECT"
  | "INSUFFICIENT_DATA";

export function makeDecision(finalScore: number, confidence: number): Decision {
  // INSUFFICIENT_DATA only for genuinely sparse resumes with near-zero confidence.
  // HIGH VARIANCE (contradictory signals: e.g. lots of experience but wrong skills)
  // is valid information — the system should still return REJECT/WEAK_FIT, not refuse.
  // Threshold 0.1 catches truly empty resumes (< ~30 words), not contradictory ones.
  if (confidence < 0.1) {
    return "INSUFFICIENT_DATA";
  }

  if (finalScore >= 80) return "STRONG_FIT";
  if (finalScore >= 60) return "GOOD_FIT";
  if (finalScore >= 40) return "WEAK_FIT";
  return "REJECT";
}

export function getDecisionLabel(decision: Decision): string {
  switch (decision) {
    case "STRONG_FIT":
      return "Strong Fit — Recommended for interview";
    case "GOOD_FIT":
      return "Good Fit — Worth considering";
    case "WEAK_FIT":
      return "Weak Fit — Significant gaps";
    case "REJECT":
      return "Reject — Does not meet requirements";
    case "INSUFFICIENT_DATA":
      return "Insufficient Data — Cannot make a reliable decision";
  }
}
