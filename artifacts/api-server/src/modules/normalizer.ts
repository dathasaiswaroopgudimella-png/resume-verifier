/**
 * Normalization Module
 * Handles synonym mapping, deduplication, case normalization
 */

import skillsData from "../../../../datasets/skills.json" assert { type: "json" };

export interface SkillEntry {
  canonical: string;
  synonyms: string[];
  implicitPhrases: string[];
  domain: string;
  weight: number;
}

export const skillsTaxonomy: SkillEntry[] = skillsData as SkillEntry[];

// Build a flat lookup: lowercase term → canonical
const synonymMap = new Map<string, string>();
for (const skill of skillsTaxonomy) {
  synonymMap.set(skill.canonical.toLowerCase(), skill.canonical);
  for (const syn of skill.synonyms) {
    synonymMap.set(syn.toLowerCase(), skill.canonical);
  }
}

export function normalizeSkill(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return synonymMap.get(lower) ?? raw;
}

export function deduplicateSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of skills) {
    const normalized = normalizeSkill(s);
    if (!seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      result.push(normalized);
    }
  }
  return result;
}

export function getSkillWeight(skillName: string): number {
  const canonical = normalizeSkill(skillName);
  const entry = skillsTaxonomy.find(
    (s) => s.canonical.toLowerCase() === canonical.toLowerCase()
  );
  return entry?.weight ?? 0.5;
}

export function getDomainForSkill(skillName: string): string | null {
  const canonical = normalizeSkill(skillName);
  const entry = skillsTaxonomy.find(
    (s) => s.canonical.toLowerCase() === canonical.toLowerCase()
  );
  return entry?.domain ?? null;
}

// Soft domain classification based on skill distribution
export const KNOWN_DOMAINS = [
  "INFORMATION-TECHNOLOGY",
  "FINANCE",
  "HR",
  "BANKING",
  "SALES",
  "ENGINEERING",
  "HEALTHCARE",
] as const;

export type Domain = (typeof KNOWN_DOMAINS)[number];

export function classifyDomain(
  skills: string[],
  text: string
): { distribution: Record<string, number>; topDomain: string } {
  const domainScores: Record<string, number> = {};
  for (const d of KNOWN_DOMAINS) {
    domainScores[d] = 0;
  }

  // Score from skills
  for (const skill of skills) {
    const domain = getDomainForSkill(skill);
    if (domain && domain in domainScores) {
      const weight = getSkillWeight(skill);
      domainScores[domain] += weight;
    }
  }

  // Score from text keywords
  const lower = text.toLowerCase();
  const domainKeywords: Record<string, string[]> = {
    // "computer", "information", "technology", "systems", "technical" added so that
    // IT-adjacent resumes (instructors, managers, analysts) correctly classify as IT
    // even when they don't use specific engineering vocabulary like "backend" or "devops".
    // "information" and "systems" removed — too generic (appear in HR, finance, etc.)
    // "it" as standalone added cautiously (matches "IT Instructor", "IT Manager" etc.)
    "INFORMATION-TECHNOLOGY": [
      "software", "developer", "engineer", "coding", "database", "server", "api",
      "cloud", "devops", "backend", "frontend", "computer", "technical",
      "network", "programming", "infrastructure", "cybersecurity", "linux",
    ],
    "FINANCE": ["finance", "accounting", "budget", "revenue", "cfa", "cpa", "audit", "tax", "investment", "portfolio", "valuation", "financial", "controller", "treasurer"],
    "HR": ["human resources", "hr", "recruiting", "talent", "payroll", "benefits", "onboarding", "hris", "compensation", "employee", "workforce", "staffing"],
    "BANKING": ["banking", "bank", "investment banking", "capital markets", "trading", "merger", "acquisition", "hedge fund", "equity", "fixed income"],
    "SALES": ["sales", "quota", "pipeline", "account executive", "business development", "crm", "salesforce", "revenue growth", "prospecting"],
    "ENGINEERING": ["mechanical", "civil", "structural", "electrical", "manufacturing", "cad", "autocad", "revit", "construction", "engineering", "machining"],
    "HEALTHCARE": ["nurse", "patient", "clinical", "medical", "hospital", "physician", "healthcare", "icu", "bsn", "nursing", "care"],
  };

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        domainScores[domain] = (domainScores[domain] || 0) + 0.3;
      }
    }
  }

  // Normalize to probability distribution
  const total = Object.values(domainScores).reduce((a, b) => a + b, 0);
  const distribution: Record<string, number> = {};
  for (const [domain, score] of Object.entries(domainScores)) {
    distribution[domain] = total > 0 ? Math.round((score / total) * 100) / 100 : 0;
  }

  const topDomain = Object.entries(domainScores).sort((a, b) => b[1] - a[1])[0][0];

  return { distribution, topDomain };
}
