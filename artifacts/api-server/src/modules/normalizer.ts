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
    "INFORMATION-TECHNOLOGY": ["software", "developer", "engineer", "coding", "database", "server", "api", "cloud", "devops", "backend", "frontend"],
    "FINANCE": ["finance", "accounting", "budget", "revenue", "cfa", "cpa", "audit", "tax", "investment", "portfolio", "valuation"],
    "HR": ["human resources", "hr", "recruiting", "talent", "payroll", "benefits", "onboarding", "hris", "compensation"],
    "BANKING": ["banking", "bank", "investment banking", "capital markets", "trading", "m&a", "merger", "acquisition", "hedge fund"],
    "SALES": ["sales", "revenue", "quota", "pipeline", "account executive", "business development", "crm", "salesforce"],
    "ENGINEERING": ["mechanical", "civil", "structural", "electrical", "manufacturing", "cad", "autocad", "revit", "construction"],
    "HEALTHCARE": ["nurse", "patient", "clinical", "medical", "hospital", "physician", "healthcare", "icu", "icu", "bsn"],
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
