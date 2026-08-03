# Local CLI Career Agent Design

## Goal

Build a local CLI-first Career Coach Agent that can run inside Codex, Antigravity, Colab, or a normal terminal. The web app remains available, but it is no longer the required entry point.

## First Version Scope

- Add `./career-coach` as the local command entry.
- Persist local sessions under `.career-coach/sessions/`.
- Export generated artifacts under `.career-coach/outputs/`.
- Support a provider abstraction so the project is not tied to one model vendor or API.
- Support a local CLI provider configured by environment variables.
- Provide deterministic fallback responses when no provider is configured.
- Route user intent to core career tasks:
  - resume bullet transformation
  - resume/JD evaluation
  - gap planning
  - interview preparation
  - knowledge guide
  - personal branding
  - mock interview
  - export

## Non-Goals

- Remove or rewrite the existing web app.
- Fully migrate every browser-only affordance in one change, such as microphone recording or browser PDF parsing.
- Add a database or use the unused `backend/` Express/Prisma stack.
- Require a cloud API key for first use.

## Architecture

The CLI agent owns a small local state machine. It stores the target JD, resume text, work experiences, conversation history, and generated artifacts in a JSON session file. Task tools build structured prompts from that state. A provider adapter generates model output when a local model or logged-in CLI is available; otherwise the agent returns a clear setup hint and deterministic scaffold output.

Provider order:

1. `CAREER_COACH_PROVIDER_COMMAND` local CLI command, with optional `CAREER_COACH_PROVIDER_ARGS`.
2. Future Ollama adapter.
3. Legacy browser integrations are outside the scope of this Agent release.

## CLI Commands

```bash
./career-coach chat
./career-coach run --jd jd.txt --resume resume.txt
./career-coach ask "generate my branding"
./career-coach status
./career-coach export
```

## Session Files

```text
.career-coach/
  sessions/
    default.json
  outputs/
    default.md
```

## Verification

- Node unit tests cover state persistence, JSON extraction, provider command invocation, task routing, and export.
- CLI smoke tests cover `status`, `ask`, and `export`.
