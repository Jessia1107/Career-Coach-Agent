# Onboarding — Build Your Own Career Coach

Career Coach Agent ships with **no personal data**. The skills describe *how* to evaluate
jobs and write resumes; they read *who you are* from three files you generate on first run.

This is deliberate. A career agent that scores jobs against someone else's visa status,
salary floor, and anti-patterns is worse than no agent at all.

---

## The three files

Everything the agent knows about you lives in `.career-coach/profile/`:

| File | What it holds | Who reads it |
|------|--------------|--------------|
| `candidate-profile.md` | Education, credentials, work history, skills, projects | `job-fit-evaluator` — Dimension 1 (can you get this job?) |
| `career-blueprint.md` | Direction, tiers, constraints, anti-patterns, comp floor | `job-fit-evaluator` — Dimension 2 (should you take it?) |
| `resume-input.json` | Structured master resume | `resume-generator` |

`.career-coach/` is gitignored. Your profile never leaves your machine.

---

## Setup

### 1. Scaffold

```bash
cd career-coach-agent
./career-coach init
```

This copies the blank templates from `setup/templates/` into `.career-coach/profile/`
and refuses to overwrite anything that already exists.

### 2. Let the agent interview you

Open the repository in your AI coding assistant and say:

```
Use the career-profile-builder skill to build my career profile.
```

The `career-profile-builder` skill runs a structured intake — about 5–7 turns, batched
questions, no 40-question form. It covers:

1. Identity and contact
2. Education and credentials
3. Work history, converted into `Action + method + quantified result` bullets
4. Skills and projects
5. Career direction — next title, 5-year target, salary floor, timeline
6. **Hard constraints** — work authorization, location, clearance, excluded industries
7. **Anti-patterns** — the roles you want auto-rejected, at least three
8. Confirmation, then it writes all three files

Two rules it holds to: it never invents a date, metric, or salary, and it lets you skip
any section — skipped items land in that file's `## Open Items` list.

### 3. Verify

```bash
./career-coach status
```

Then test the scoring on a real posting:

```bash
./career-coach judge-job \
  --company "Some Company" \
  --role "Some Role" \
  --jd-file path/to/jd.txt
```

If the rating feels wrong, that is a calibration signal — see *Tuning* below.

### 4. Optional — global rules

Copy `setup/templates/AGENTS.template.md` to `AGENTS.md` in the repository root to set
daily-recommendation quotas, deduplication rules, and output conventions.

---

## Doing it manually

If you would rather not be interviewed, copy the templates and fill them in by hand:

```bash
mkdir -p .career-coach/profile
cp setup/templates/candidate-profile.template.md .career-coach/profile/candidate-profile.md
cp setup/templates/career-blueprint.template.md  .career-coach/profile/career-blueprint.md
cp setup/templates/resume-input.example.json     .career-coach/profile/resume-input.json
```

**Keep the section headings exactly as written.** `job-fit-evaluator` references them by
name (`candidate-profile.md §Education`), so renaming a heading silently breaks scoring
rather than erroring.

---

## Keeping it current

Do not re-run the full interview. Just tell the agent what changed:

> I passed Exam FM in December. Update my profile.

> I'm raising my salary floor to $110k and I no longer want client-facing roles.

The skill edits the relevant section, bumps `Last updated`, and clears resolved open items.

Suggested cadence:

- `candidate-profile.md` — whenever work, credentials, or skills change
- `career-blueprint.md` — after any real shift in goals, authorization, or compensation

---

## Tuning

The evaluator is meant to be reproducible, so fix systematic problems in the config, not
in individual evaluations:

| Symptom | Fix |
|---------|-----|
| Everything scores 80+ | Your skills list claims more than your experience bullets demonstrate. Tighten `candidate-profile.md`. |
| Good roles get vetoed | A hard constraint in `career-blueprint.md` §Hard Constraints is over-broad. |
| Wrong roles rank first | Re-sort `career-blueprint.md` §Target Role Tiers. Tier is 25% of the career score. |
| Scores ignore what you care about | Edit the weight tables in `agents-skill/job-fit-evaluator/SKILL.md`. |

---

## Privacy checklist

- [ ] `.career-coach/` is in `.gitignore` (it is, by default)
- [ ] Generated resumes are written outside the repo, or to an ignored path
- [ ] No profile contents pasted into public issues, PRs, or shared logs
- [ ] `git status` is clean of personal files before every push
