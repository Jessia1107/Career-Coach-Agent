---
name: career-coach-agent
description: Use when a user wants career coaching, resume/JD analysis, work-history updates, polished resume bullets, gap planning, personal branding, interview prep, knowledge guides, or mock interviews from the local Career Coach project.
---

# Career Coach Agent

Use this skill when working from the Career Coach repository and the user asks about career coach, resume coach, interview prep, mock interview, JD fit, work-history updates, or resume bullet generation.

## First: Check the Profile Exists

Every downstream skill reads the user's own profile from `.career-coach/profile/`:

| File | Read by |
|------|---------|
| `candidate-profile.md` | `job-fit-evaluator` — Dimension 1 (HR Experience Fit) |
| `career-blueprint.md` | `job-fit-evaluator` — Dimension 2 (Career Alignment) |
| `resume-input.json` | `resume-generator` |

**If any is missing or still full of `TBD` placeholders, run the `career-profile-builder`
skill first.** Do not score a job or write a resume against assumptions — a career agent
working from guesses is worse than no agent.

```bash
./career-coach init     # scaffold blank profile files
./career-coach status   # session state + profile readiness
```

## Companion Skills

| Skill | Use when |
|-------|----------|
| `career-profile-builder` | First run, or when the user reports a change in job/credentials/goals |
| `job-fit-evaluator` | Scoring or screening a job description |
| `resume-generator` | Tailoring a resume for a specific posting |

## Local Project

The local Career Coach project is available at:

```bash
path/to/career-coach-agent
```

Prefer the local CLI when possible:

```bash
cd path/to/career-coach-agent
./career-coach status
./career-coach ask "generate branding"
./career-coach chat
./career-coach export
```

If the user provides files:

```bash
cd path/to/career-coach-agent
./career-coach run --jd path/to/jd.txt --resume path/to/resume.txt
```

The CLI stores sessions in `.career-coach/sessions/` and exports in `.career-coach/outputs/`.

## Career History Updates

When the user provides work-history or job-search updates:

- Preserve raw facts separately from resume wording.
- Do not invent dates, metrics, downstream impact, or confidential client details.
- Convert confirmed work into reusable resume bullets, interview stories, and skill/profile notes.
- Keep Chinese explanations natural, while preserving English technical terms.

## Output Style

- Mirror the user's language. If they write in Chinese, explain in Chinese while keeping
  technical terms and resume bullets in English.
- Use concise American resume bullets when drafting resume content.
- Keep claims evidence-based.
- Ask only for missing facts that materially affect accuracy.

## Privacy

`.career-coach/` holds contact details, compensation, and work-authorization status, and
is gitignored in full. Never commit it, and never paste its contents into a public issue,
PR, or shared log.
