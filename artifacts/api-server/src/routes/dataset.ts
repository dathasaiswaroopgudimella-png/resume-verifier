import { Router } from "express";
import type { Request, Response } from "express";
import resumesData from "../../../../datasets/resumes.json" assert { type: "json" };
import jobsData from "../../../../datasets/jobs.json" assert { type: "json" };
import skillsData from "../../../../datasets/skills.json" assert { type: "json" };

const router = Router();

interface ResumeRaw {
  id: string;
  category: string;
  experienceYears: number | null;
  source: string;
  syntheticType?: string;
  text: string;
}

// GET /api/jobs
router.get("/jobs", (_req: Request, res: Response) => {
  res.json(jobsData);
});

// GET /api/resumes
router.get("/resumes", (_req: Request, res: Response) => {
  const resumes = resumesData as ResumeRaw[];
  const sanitized = resumes.map((r) => ({
    id: r.id,
    category: r.category,
    experienceYears: r.experienceYears ?? null,
    source: r.source,
    syntheticType: r.syntheticType ?? null,
    preview: r.text.slice(0, 500),
  }));
  res.json(sanitized);
});

// GET /api/skills
router.get("/skills", (_req: Request, res: Response) => {
  res.json(skillsData);
});

export default router;
