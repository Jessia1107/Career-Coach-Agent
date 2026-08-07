# Career Fit Preferences & Execution Rules

> Global execution rules for this job search workflow. This file tells the agent
> **what to do**; the detailed profile data lives in `.career-coach/profile/`.
>
> Copy to the repository root as `AGENTS.md` and edit to taste.

---

## 1. Mandatory Skill References

When evaluating any job description, the agent **MUST** first read and apply:

- **`job-fit-evaluator`** — dual-dimension scoring methodology, plus:
  - `.career-coach/profile/career-blueprint.md` (direction, constraints, anti-patterns)
  - `.career-coach/profile/candidate-profile.md` (education, credentials, work history, skills)

When generating or tailoring a resume, the agent **MUST** also read and apply:

- **`resume-generator`** — content contract and one-page rendering rules.

If either profile file is missing, run **`career-profile-builder`** before doing anything else.

---

## 2. Rating Categories

| Rating | Tracker Decision | Action |
|--------|-----------------|--------|
| `🌟 Perfect Match` | `apply_now` | Auto-generate a tailored resume |
| `📈 Good Fit with Gaps` | `apply_now` | Auto-generate a tailored resume |
| `⚠️ Reach / Challenging Match` | `future_target` | Record only |
| `❌ Not Recommended` | `do_not_apply` | Record only, with the veto reason |

---

## 3. Rules for Daily Job Recommendations

1. **Deduplicate against the tracker.** Read `.career-coach/jobs/job_tracker.json` before
   producing any recommendation list. Never surface a role already recorded as `applied`,
   `interviewing`, or `do_not_apply`.
2. **Recency filter.** Daily searches target postings from the last 24 hours.
3. **Daily quota.** Aim for N actionable `apply_now` roles per day (default N = 10),
   `🌟` first, topped up with `📈`. `⚠️` roles are listed separately and do not count
   toward the quota. `❌` roles are omitted entirely.
4. **Deliver in chat as markdown.** Do not require the user to open a UI to read results.
5. **State exact file paths.** For every `apply_now` role, generate the tailored resume
   and print the absolute output path so it can be attached immediately.

---

## 4. Data Handling

- Everything under `.career-coach/` is local personal data and is gitignored.
- Never commit profile files, generated resumes, trackers, or scraped job data.
- Never paste profile contents into a public issue, PR, or shared log.

---

## 5. Tuning

Adjust rather than override: if recommendations feel consistently wrong, change the
weights in `job-fit-evaluator/SKILL.md` or the tiers in `career-blueprint.md`. Fudging
individual evaluations destroys reproducibility, which is the point of the scoring system.
