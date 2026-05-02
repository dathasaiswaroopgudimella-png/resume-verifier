# Resume–Job Matching System

## Overview

A production-quality, defensible Resume–Job Matching System built as a portfolio-level engineering project. Not a simple keyword matcher — it is a structured hiring decision engine with semantic scoring, adversarial defense, contradiction detection, human validation, reliability analysis, and a rich analytics dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (artifacts/api-server)
- **Frontend**: React + Vite + Tailwind + shadcn/ui (artifacts/resume-matcher)
- **Validation**: Zod (`zod/v4`), Drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Charts**: Recharts
- **Build**: esbuild (CJS bundle for API)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Dataset

Located in `datasets/`:
- `resumes.json` — 18 curated resumes (14 from CSV + 4 synthetic edge cases)
- `jobs.json` — 10 hand-crafted job descriptions across domains
- `skills.json` — 35 skills with synonyms and implicit phrase mappings
- `human_validation.json` — 10 human-validated resume-job pairs with rubric scores
- `failure_cases.json` — 4 documented adversarial failure modes
- `evaluation.json` — metadata

Source dataset: Kaggle Resume Dataset (2,484 resumes across 24 job categories)

## System Architecture

### Backend Modules (`artifacts/api-server/src/modules/`)

1. **parser.ts** — Cleans and validates raw text input. Handles HTML, unicode, truncation.
2. **extractor.ts** — Extracts explicit skills, implied skills via phrase matching, experience years via regex + date range inference, project signals, keyword frequency map.
3. **normalizer.ts** — Skills taxonomy with synonyms. Domain classification (soft probability distribution). Deduplication.
4. **embedder.ts** — BM25 job-relevance scoring (K1=1.5, B=0.75, AVG_RESUME_TOKENS=190). FNV1a cache keys. Job-relative adversarial stuffing detection (excludes generic resume words; flags terms repeated >6× vs job frequency). Saturation prevents score inflation from repetition.
5. **scorer.ts** — Full scoring pipeline: semantic (0.5) + skill (0.3) + experience (0.2) → baseScore. Penalty system (domain mismatch, low core skill match, experience gap, adversarial stuffing, damping at >40, cap at 60). Confidence from word count + signal richness (not variance). Contradiction warnings. Explanation generation.
6. **decision.ts** — Maps finalScore + confidence → STRONG_FIT / GOOD_FIT / WEAK_FIT / REJECT / INSUFFICIENT_DATA.
7. **ranker.ts** — Sorts multiple candidates by finalScore. Top 3 extraction. Pairwise comparison with key differentiator identification.

### API Routes (`artifacts/api-server/src/routes/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthz | Health check |
| POST | /api/match | Single resume vs job → MatchResult |
| POST | /api/rank | Multiple resumes vs job → RankResult |
| POST | /api/stability-test | Score variance under minor text modification |
| GET | /api/jobs | Dataset job descriptions |
| GET | /api/resumes | Dataset resumes (sanitized) |
| GET | /api/skills | Skills taxonomy |
| GET | /api/evaluation | Live metrics vs human validation |
| GET | /api/reliability | Reliability summary, failure modes, cost model |

### Frontend Pages (`artifacts/resume-matcher/src/pages/`)

1. **Match** (`/`) — Resume + job input with sample loaders. Full result: radial score gauge, decision badge, semantic/skill/experience bars, penalty breakdown, skill chips (matched/missing/implied), warnings, explanation.
2. **Ranking** (`/rank`) — Select job + candidates. Sorted table with scores, decision badges. Pairwise comparisons.
3. **Evaluate** (`/evaluate`) — Accuracy, precision, recall, false positives/negatives. Human vs system agreement table.
4. **Reliability** (`/reliability`) — Agreement score, precision, ranking stability, failure modes, system boundaries, cost model.
5. **Stability Test** (`/stability`) — Minor perturbation test. Score variance + stability label (HIGH/MEDIUM/LOW).
6. **Dataset** (`/dataset`) — Browse resumes and skills taxonomy. Synthetic resume type badges.

## Scoring Formula

```
baseScore = 0.5 * semanticScore + 0.3 * weightedSkillScore + 0.2 * experienceScore

Penalties:
  - Domain mismatch (proportional to domain distribution difference)
  - Low core skill match (<50% required skills matched → penalty up to 25)
  - Experience gap (years below requirement → up to 15)
  - Adversarial stuffing (job-relative over-repetition of non-generic terms → 10)
  - Damping: if totalPenalty > 40 → totalPenalty *= 0.7
  - Cap: max penalty = 60

finalScore = clamp(baseScore - totalPenalty, 0, 100)

Confidence = wordCountFactor * 0.7 + signalRichnessFactor * 0.3
  (reflects DATA RICHNESS, not signal agreement — high variance is informative, not uncertain)
```

## Decision Thresholds

| Score | Decision |
|-------|----------|
| 80–100 | STRONG_FIT |
| 60–79 | GOOD_FIT |
| 40–59 | WEAK_FIT |
| <40 | REJECT |
| any + confidence <0.1 | INSUFFICIENT_DATA (truly empty resume only) |

## Known System Limits

- Creative roles (arts, design) — visual portfolios not parseable from text
- Sparse resumes (<50 words) — insufficient signal
- Unconventional careers — non-linear paths confuse domain classifier
- Non-English resumes — tokenizer not optimized
- PDF format — requires plain text input
- Hidden skills resumes — narrative language under-scores vs. keyword-explicit resumes
