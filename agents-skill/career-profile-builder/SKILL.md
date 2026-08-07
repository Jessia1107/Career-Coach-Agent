---
name: career-profile-builder
description: Interview a new user and generate their personal career profile files (candidate-profile.md, career-blueprint.md, resume input JSON) so the Career Coach Agent can evaluate jobs and tailor resumes for them. Use when a user first installs Career Coach Agent, says "set up my profile", "build my career profile", "onboard me", "帮我建立档案", "初始化", or when job-fit-evaluator reports that profile files are missing or stale.
---

# Career Profile Builder

## Purpose

Career Coach Agent is profile-driven: every downstream skill (`job-fit-evaluator`,
`resume-generator`) reads two markdown files and one JSON file that describe **one
specific person**. This skill builds those files from scratch by interviewing the user,
so anyone who clones the repository ends up with the same structure, populated with
their own facts.

You are not filling in a form. You are conducting a career intake interview, and then
writing three artifacts.

## Artifacts You Will Produce

| File | Written to | Purpose |
|------|-----------|---------|
| `candidate-profile.md` | `.career-coach/profile/candidate-profile.md` | Hard credentials: education, exams/certs, work history, skills, projects |
| `career-blueprint.md` | `.career-coach/profile/career-blueprint.md` | Direction, personality, constraints, anti-patterns, compensation |
| `resume-input.json` | `.career-coach/profile/resume-input.json` | Master structured resume, tailored per application |
| `AGENTS.md` | repository root (optional) | Global execution rules for the agent |

Blank templates live in `setup/templates/`. Run `./career-coach init` first to copy
them into `.career-coach/profile/`, then fill them in through this interview.

## Interview Protocol

### Rules

1. **Ask in batches, not one at a time.** Group 3–6 related questions per turn. A full
   intake should take 5–7 turns, not 40.
2. **Never invent facts.** Dates, GPAs, metrics, employer names, salary numbers, and
   visa status must come from the user verbatim. If the user does not know a number,
   write `TBD` rather than an estimate.
3. **Let the user skip.** Any section can be answered with "skip" and gets a `TBD`
   placeholder plus a note in the file's `## Open Items` list.
4. **Mirror the user's language.** If they answer in Chinese, write the prose in
   Chinese but keep resume bullets and technical terms in English.
5. **Confirm before writing.** Show a compact summary and get a yes before creating files.

### Stage 1 — Identity and contact

Ask:
- Full name as it should appear on a resume, email, phone, LinkedIn (or portfolio/GitHub).
- Current city and whether they are open to relocation.
- What stage are they at: student, new grad, 1–3 years, mid-career, senior, career changer?

### Stage 2 — Education and credentials

Ask:
- Each degree: institution, location, degree title, dates, GPA (optional), key coursework, honors.
- Professional exams or certifications: which ones, passed vs. scheduled, dates.
  (e.g. SOA/CAS exams, CFA, FRM, PMP, AWS, cloud certs — whatever applies to their field.)
- Any licenses that gate the roles they want.

### Stage 3 — Work history

For each role, in reverse-chronological order, ask:
- Organization, location, title, dates, full-time vs. intern vs. contract.
- What they actually built or owned — push for the system, dataset, model, or process.
- Scale and outcome: how many records/users/dollars, how much time saved, what decision it drove.

Then convert each into 2–4 resume bullets in `Action + method + quantified result` form.
If the user gives you no number, ask once: "Any number you can attach to this — volume,
frequency, time saved, error rate?" If still none, write the bullet without a fabricated metric.

### Stage 4 — Skills and projects

Ask:
- Programming languages, and honestly: daily-use vs. familiar vs. exposure only.
- Domain tooling (databases, BI, cloud, modeling frameworks, statistical software).
- Spoken languages.
- Personal or academic projects worth listing, with the same bullet treatment.

Group skills into 2–4 named buckets that match their field, for example
`Programming`, `Modeling & Analytics`, `Data & BI`, `Languages`.

### Stage 5 — Career direction (this is what makes the agent opinionated)

Ask:
- Current role and salary, if they are willing to share; if not, ask only for a floor.
- Target: what job title do they want *next*, and what do they want in 5 years?
- Salary floor — the number below which they would decline.
- Timeline — when do they want to have moved?
- What kind of work energizes them, and what drains them? (deep focus vs. coordination,
  building systems vs. client-facing, meeting load, travel tolerance)
- Company size and stage preference.

### Stage 6 — Hard constraints and anti-patterns

This section drives instant vetoes, so be precise. Ask:
- Work authorization: citizen / permanent resident / visa holder / needs sponsorship.
  If sponsorship is needed: current status, expiry dates, what the employer must do.
- Any location, security-clearance, or industry restrictions.
- Anti-patterns: which specific roles or responsibilities should the agent auto-reject?
  Ask for at least three. Examples to prompt with: heavy travel, on-call rotations,
  pure project coordination, commission-based sales, litigation/adversarial work,
  night shifts, specific industries they refuse.

### Stage 7 — Role tiers

Have the user sort their target titles into three tiers:
- **Tier 1** — ideal, directly on the 5-year path.
- **Tier 2** — acceptable springboard; take it if the pay and brand are right.
- **Tier 3** — only if desperate; the agent should flag these as low priority.

Write these into `career-blueprint.md` §Target Role Tiers. `job-fit-evaluator` weights
tier classification at 25% of the career-alignment score, so this section matters.

### Stage 8 — Confirm and write

1. Print a ~20-line summary: name, target titles, salary floor, timeline, work
   authorization, top 3 anti-patterns, number of roles captured.
2. Ask for corrections.
3. Write all files. Report the exact paths.
4. Tell the user what to run next:

```bash
./career-coach status
./career-coach judge-job --company "Some Company" --role "Some Role" --jd-file jd.txt
```

## Writing the Files

Follow `setup/templates/candidate-profile.template.md` and
`setup/templates/career-blueprint.template.md` section-for-section. Keep the headings
exactly as templated — `job-fit-evaluator` references them by section name
(e.g. `candidate-profile.md §Education`), and renaming a heading silently breaks scoring.

Every file gets a `**Last updated**: YYYY-MM-DD` line and an `## Open Items` list of
anything left as `TBD`.

## Update Mode

When the user returns with news ("I passed an exam", "I started a new job", "I want to
raise my salary floor"), do **not** re-run the full interview:

1. Read the existing file.
2. Ask only the questions needed to place the new fact.
3. Edit that section, bump `Last updated`, and remove any resolved `Open Items`.

Recommended cadence: `candidate-profile.md` whenever work/exams/skills change;
`career-blueprint.md` after any real change in goals, authorization, or compensation.

## Privacy

These files contain personal contact details, salary, and immigration status.
`.career-coach/` is gitignored by default. Never commit generated profile files,
never paste them into a public issue, and warn the user if they ask you to.
