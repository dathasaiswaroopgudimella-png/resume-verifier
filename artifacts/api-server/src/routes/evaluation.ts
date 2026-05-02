import { Router } from "express";
import type { Request, Response } from "express";
import humanValidationData from "../../../../datasets/human_validation.json" assert { type: "json" };
import failureCasesData from "../../../../datasets/failure_cases.json" assert { type: "json" };
import resumesData from "../../../../datasets/resumes.json" assert { type: "json" };
import jobsData from "../../../../datasets/jobs.json" assert { type: "json" };
import { scoreResumeAgainstJob } from "../modules/scorer.js";
import { makeDecision } from "../modules/decision.js";

const router = Router();

interface HumanValidation {
  resumeId: string;
  jobId: string;
  humanDecision: string;
  totalScore: number;
}

interface Resume {
  id: string;
  text: string;
  category: string;
  experienceYears: number | null;
  source: string;
}

interface Job {
  id: string;
  title: string;
  domain: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequired: number;
  seniority: string;
}

const humanValidation = humanValidationData as HumanValidation[];
const resumes = resumesData as Resume[];
const jobs = jobsData as Job[];

// GET /api/evaluation
router.get("/evaluation", (_req: Request, res: Response) => {
  const cases = [];
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  let agreementCount = 0;

  const systemRanks: number[] = [];
  const humanRanks: number[] = [];

  for (const hv of humanValidation) {
    const resume = resumes.find((r) => r.id === hv.resumeId);
    const job = jobs.find((j) => j.id === hv.jobId);
    if (!resume || !job) continue;

    const score = scoreResumeAgainstJob(
      resume.text,
      job.description,
      job.requiredSkills,
      job.preferredSkills,
      job.experienceRequired,
      job.domain
    );

    const systemDecision = makeDecision(score.finalScore, score.confidence);
    const humanDecision = hv.humanDecision;

    // Convert human score /15 to 0-100
    const humanScore = Math.round((hv.totalScore / 15) * 100);

    const systemPositive = systemDecision === "STRONG_FIT" || systemDecision === "GOOD_FIT";
    const humanPositive = humanDecision === "STRONG_FIT" || humanDecision === "GOOD_FIT";
    const agree = systemDecision === humanDecision;

    if (agree) agreementCount++;

    if (systemPositive && humanPositive) truePositives++;
    else if (systemPositive && !humanPositive) falsePositives++;
    else if (!systemPositive && humanPositive) falseNegatives++;
    else trueNegatives++;

    // Collect rank scores for correlation
    systemRanks.push(score.finalScore);
    humanRanks.push(humanScore);

    let failureMode: string | null = null;
    if (!agree) {
      if (systemDecision === "STRONG_FIT" || systemDecision === "GOOD_FIT") {
        failureMode = "semantic_overtrust";
      } else if (humanPositive && score.weightedSkillScore < 30) {
        failureMode = "skill_extraction_failure";
      } else if (humanPositive && score.experienceScore < 30) {
        failureMode = "experience_misread";
      } else {
        failureMode = "domain_confusion";
      }
    }

    cases.push({
      resumeId: hv.resumeId,
      jobId: hv.jobId,
      systemDecision,
      humanDecision,
      systemScore: score.finalScore,
      humanScore,
      agree,
      failureMode,
    });
  }

  const total = cases.length;
  const accuracy = total > 0 ? Math.round((agreementCount / total) * 100) / 100 : 0;
  const precision =
    truePositives + falsePositives > 0
      ? Math.round((truePositives / (truePositives + falsePositives)) * 100) / 100
      : 0;
  const recall =
    truePositives + falseNegatives > 0
      ? Math.round((truePositives / (truePositives + falseNegatives)) * 100) / 100
      : 0;

  // Spearman rank correlation (simplified)
  const rankCorrelation = computeRankCorrelation(systemRanks, humanRanks);
  const agreementScore = Math.round((agreementCount / total) * 100) / 100;

  res.json({
    accuracy,
    precision,
    recall,
    falsePositives,
    falseNegatives,
    totalCases: total,
    agreementScore,
    rankCorrelation,
    cases,
  });
});

// GET /api/reliability
router.get("/reliability", (_req: Request, res: Response) => {
  // Compute live reliability summary
  const evalCases = [];
  let agreementCount = 0;
  let truePositives = 0;
  let falsePositives = 0;

  for (const hv of humanValidation) {
    const resume = resumes.find((r) => r.id === hv.resumeId);
    const job = jobs.find((j) => j.id === hv.jobId);
    if (!resume || !job) continue;

    const score = scoreResumeAgainstJob(
      resume.text,
      job.description,
      job.requiredSkills,
      job.preferredSkills,
      job.experienceRequired,
      job.domain
    );

    const systemDecision = makeDecision(score.finalScore, score.confidence);
    const agree = systemDecision === hv.humanDecision;
    if (agree) agreementCount++;

    const systemPositive = systemDecision === "STRONG_FIT" || systemDecision === "GOOD_FIT";
    const humanPositive = hv.humanDecision === "STRONG_FIT" || hv.humanDecision === "GOOD_FIT";
    if (systemPositive && humanPositive) truePositives++;
    else if (systemPositive && !humanPositive) falsePositives++;

    evalCases.push({ systemDecision, humanDecision: hv.humanDecision, agree });
  }

  const total = evalCases.length || 1;
  const agreementScore = Math.round((agreementCount / total) * 100) / 100;
  const precision =
    truePositives + falsePositives > 0
      ? Math.round((truePositives / (truePositives + falsePositives)) * 100) / 100
      : 1;

  const failureCases = failureCasesData as Array<{ failureMode: string }>;
  const keyFailureModes = [...new Set(failureCases.map((f) => f.failureMode))];

  res.json({
    agreementScore,
    precision,
    rankingStability: agreementScore >= 0.7 ? "HIGH" : agreementScore >= 0.5 ? "MEDIUM" : "LOW",
    keyFailureModes,
    decisionPhilosophy:
      "The system prioritizes precision over recall to minimize false positives (bad hires). A candidate with a borderline score is classified as WEAK_FIT or REJECT rather than GOOD_FIT when confidence is low.",
    systemBoundaries: [
      "Creative roles (arts, design) — visual portfolios not parseable from text",
      "Sparse resumes (<50 words) — insufficient signal for reliable scoring",
      "Unconventional careers — non-linear career paths may confuse domain classifier",
      "Non-English resumes — tokenizer not optimized for other languages",
      "PDF format without text extraction — requires plain text input",
    ],
    costModel: {
      falsePositiveCost: "HIGH — bad hires waste significant time and resources",
      falseNegativeCost: "MEDIUM — missed candidates are recoverable, bad hires are not",
      prioritization: "System optimizes for precision to minimize false positives",
    },
  });
});

function computeRankCorrelation(systemScores: number[], humanScores: number[]): number {
  if (systemScores.length !== humanScores.length || systemScores.length === 0) return 0;

  const n = systemScores.length;
  const rank = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => b - a);
    return arr.map((v) => sorted.indexOf(v) + 1);
  };

  const sysRanks = rank(systemScores);
  const humRanks = rank(humanScores);

  const dSquaredSum = sysRanks.reduce((sum, r, i) => sum + Math.pow(r - humRanks[i], 2), 0);
  const spearman = 1 - (6 * dSquaredSum) / (n * (n * n - 1));

  return Math.round(spearman * 100) / 100;
}

export default router;
