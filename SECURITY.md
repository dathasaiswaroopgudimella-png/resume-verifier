# Security Policy

## Scope & Guidelines
`resume-verifier` evaluates applicant resume data against job specifications.
- **Data Confidentiality**: Do not commit real personal identifiable information (PII) or unredacted resume files to git history.
- **Type Safety**: Strictly validate all API request contracts against Zod schemas (`lib/api-zod`).
