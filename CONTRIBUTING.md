# Contributing to Resume Verifier

Thank you for contributing!

## Development Setup

1. Install `pnpm` globally:
   ```bash
   npm install -g pnpm
   ```

2. Clone repository and install monorepo workspace dependencies:
   ```bash
   git clone https://github.com/dathasaiswaroopgudimella-png/resume-verifier.git
   cd resume-verifier
   pnpm install
   ```

3. Generate OpenAPI client and Zod schemas:
   ```bash
   pnpm --filter api-spec run build
   ```
