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
  // Low confidence override
  if (confidence < 0.3) {
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
