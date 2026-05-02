import { Router } from "express";
import type { Request, Response } from "express";
import {
  MatchResumeToJobBody,
  RankCandidatesBody,
  RunStabilityTestBody,
} from "@workspace/api-zod";
import { scoreResumeAgainstJob } from "../modules/scorer.js";
import { makeDecision } from "../modules/decision.js";
import { rankCandidates } from "../modules/ranker.js";
import resumesData from "../../../../datasets/resumes.json" assert { type: "json" };
import jobsData from "../../../../datasets/jobs.json" assert { type: "json" };

const router = Router();

interface Resume {
  id: string;
  text: string;
  category: string;
  experienceYears: number | null;
  source: string;
  syntheticType?: string;
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

const resumes = resumesData as Resume[];
const jobs = jobsData as Job[];

// POST /api/match
router.post("/match", async (req: Request, res: Response) => {
  const parsed = MatchResumeToJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { resumeText, jobText, jobId } = parsed.data;

  let requiredSkills: string[] = [];
  let preferredSkills: string[] = [];
  let experienceRequired = 0;
  let jobDomain = "";
  let jobTitle = "Unknown Job";

  if (jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      requiredSkills = job.requiredSkills;
      preferredSkills = job.preferredSkills;
      experienceRequired = job.experienceRequired;
      jobDomain = job.domain;
      jobTitle = job.title;
    }
  }

  try {
    const scoreResult = scoreResumeAgainstJob(
      resumeText,
      jobText,
      requiredSkills,
      preferredSkills,
      experienceRequired,
      jobDomain
    );

    const decision = makeDecision(scoreResult.finalScore, scoreResult.confidence);

    res.json({ ...scoreResult, decision });
  } catch (err) {
    req.log.error({ err }, "Error in match endpoint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rank
router.post("/rank", async (req: Request, res: Response) => {

  const parsed = RankCandidatesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { jobText, jobId, resumeIds, customResumes } = parsed.data;

  let requiredSkills: string[] = [];
  let preferredSkills: string[] = [];
  let experienceRequired = 0;
  let jobDomain = "";
  let jobTitle = "Job Ranking";

  if (jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      requiredSkills = job.requiredSkills;
      preferredSkills = job.preferredSkills;
      experienceRequired = job.experienceRequired;
      jobDomain = job.domain;
      jobTitle = job.title;
    }
  }

  try {
    let candidates: Array<{ id: string; label: string; text: string }> = [];

    if (customResumes && customResumes.length > 0) {
      candidates = customResumes.map((r) => ({
        id: r.id,
        label: r.label ?? r.id,
        text: r.text,
      }));
    } else if (resumeIds && resumeIds.length > 0) {
      const selectedResumes = resumes.filter((r) => resumeIds.includes(r.id));
      candidates = selectedResumes.map((r) => ({
        id: r.id,
        label: `${r.id} (${r.category})`,
        text: r.text,
      }));
    } else {
      // Default: use all dataset resumes
      candidates = resumes.map((r) => ({
        id: r.id,
        label: `${r.id} (${r.category}${r.syntheticType ? ` – ${r.syntheticType}` : ""})`,
        text: r.text,
      }));
    }

    if (candidates.length === 0) {
      res.status(400).json({ error: "No candidates to rank" });
      return;
    }

    const scoredCandidates = candidates.map((c) => ({
      id: c.id,
      label: c.label,
      score: scoreResumeAgainstJob(
        c.text,
        jobText,
        requiredSkills,
        preferredSkills,
        experienceRequired,
        jobDomain
      ),
    }));

    const rankResult = rankCandidates(scoredCandidates, jobTitle);

    res.json(rankResult);
  } catch (err) {
    req.log.error({ err }, "Error in rank endpoint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stability-test
router.post("/stability-test", async (req: Request, res: Response) => {
  const parsed = RunStabilityTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { jobText, jobId, resumeId } = parsed.data;
  let resumeText = parsed.data.resumeText ?? "";

  if (!resumeText && resumeId) {
    const found = resumes.find((r) => r.id === resumeId);
    if (found) resumeText = found.text;
  }

  if (!resumeText) {
    res.status(400).json({ error: "resumeText or valid resumeId required" });
    return;
  }

  let requiredSkills: string[] = [];
  let preferredSkills: string[] = [];
  let experienceRequired = 0;
  let jobDomain = "";

  if (jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      requiredSkills = job.requiredSkills;
      preferredSkills = job.preferredSkills;
      experienceRequired = job.experienceRequired;
      jobDomain = job.domain;
    }
  }

  try {
    const original = scoreResumeAgainstJob(resumeText, jobText, requiredSkills, preferredSkills, experienceRequired, jobDomain);
    const originalDecision = makeDecision(original.finalScore, original.confidence);

    // Apply slight modification: add a small neutral paragraph
    const modification = "Added neutral professional summary paragraph (minor text addition)";
    const modifiedText =
      resumeText +
      " Results-driven professional with strong communication and analytical skills. Committed to continuous improvement and delivering high-quality outcomes.";

    const modified = scoreResumeAgainstJob(modifiedText, jobText, requiredSkills, preferredSkills, experienceRequired, jobDomain);
    const modifiedDecision = makeDecision(modified.finalScore, modified.confidence);

    const scoreVariance = Math.abs(original.finalScore - modified.finalScore);

    // Determine rank shift (simplified: whether decision changed)
    const decisions = ["STRONG_FIT", "GOOD_FIT", "WEAK_FIT", "REJECT", "INSUFFICIENT_DATA"];
    const origIdx = decisions.indexOf(originalDecision);
    const modIdx = decisions.indexOf(modifiedDecision);
    const rankShift = Math.abs(origIdx - modIdx);

    let stability: "HIGH" | "MEDIUM" | "LOW";
    if (scoreVariance <= 3 && rankShift === 0) {
      stability = "HIGH";
    } else if (scoreVariance <= 8 && rankShift <= 1) {
      stability = "MEDIUM";
    } else {
      stability = "LOW";
    }

    const analysis = `Original score: ${original.finalScore} (${originalDecision}). After minor modification: ${modified.finalScore} (${modifiedDecision}). Score variance: ${scoreVariance} points. ${stability === "HIGH" ? "System is robust to minor text additions." : stability === "MEDIUM" ? "Small but acceptable score shift — system is moderately stable." : "Significant score change detected — system may be sensitive to text volume or vocabulary additions."}`;

    res.json({
      original: { ...original, decision: originalDecision },
      modified: { ...modified, decision: modifiedDecision },
      modification,
      scoreVariance,
      rankShift,
      stability,
      analysis,
    });
  } catch (err) {
    req.log.error({ err }, "Error in stability-test endpoint");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
