---
name: job-fit-evaluator
description: Evaluate whether a job description is a good fit for the user using a dual-dimension scoring system (HR Experience Fit + Career Alignment). Trigger whenever the user asks to evaluate, judge, rate, or screen a job posting, when the job discovery pipeline needs to classify scraped listings, or when the user says "evaluate this JD", "judge-job", "is this a good fit for me", "帮我看看这个岗位", "这个适合我吗".
---

# Job Fit Evaluator — Dual-Dimension Scoring System

## Purpose

Produce a structured, reproducible suitability rating for any job description against
the user's own profile. The evaluation uses **two independent dimensions** and a
**decision matrix** to output one of four standard ratings.

Two scores, not one, because "could I get this job?" and "should I take this job?" are
different questions and a single number hides the tradeoff.

## Required Reading

Before scoring anything, read both profile documents:

1. `.career-coach/profile/career-blueprint.md` — direction, personality, constraints, anti-patterns
2. `.career-coach/profile/candidate-profile.md` — education, credentials, work history, skills

**If either file is missing**, stop and run the `career-profile-builder` skill first.
Do not score a job against assumptions.

---

## Dimension 1: HR Experience Fit (Senior Hiring Manager Perspective)

Ask: *"If I were the hiring manager reading this resume against this JD, would I move this candidate to the next round?"*

### Scoring Factors (0–100)

| Factor | Weight | Source |
|--------|--------|--------|
| **Education match** — Does the degree level/field satisfy the JD? | 15% | `candidate-profile.md` §Education |
| **Years of experience** — Does total relevant experience meet the JD requirement? Count all roles including internships and practicum. | 20% | `candidate-profile.md` §Experience |
| **Hard skills coverage** — What fraction of the JD's required technical skills does the candidate demonstrably possess? | 30% | `candidate-profile.md` §Skills + §Experience bullets |
| **Domain relevance** — Prior experience in the JD's industry/domain? | 15% | `candidate-profile.md` §Experience |
| **Credential fit** — Required certifications or licenses held? | 10% | `candidate-profile.md` §Credentials |
| **Seniority calibration** — Is the role's level realistic for this career stage? | 10% | `candidate-profile.md` §Experience dates |

Score against what the profile *demonstrates*, not what it claims. A skill listed under
§Skills but never appearing in an experience bullet counts as partial coverage.

### Output

```json
{
  "hrScore": 72,
  "hrVerdict": "Strong technical match but a 1-year experience gap vs. the JD's '3+ years'. Certifications partially offset this.",
  "hardSkillsCoverage": ["Python ✅", "SQL ✅", "Spark ⚠️", "Tableau ❌"],
  "experienceGaps": ["No direct pricing experience"]
}
```

---

## Dimension 2: Career Alignment (Career Strategist Perspective)

Ask: *"Even if they could get this job, should they take it given their multi-year plan, personality, and hard constraints?"*

### Scoring Factors (0–100)

| Factor | Weight | Source |
|--------|--------|--------|
| **Tier classification** — Which tier does this role fall into? (Tier 1 high, Tier 3 low) | 25% | `career-blueprint.md` §Target Role Tiers |
| **Springboard value** — Does this create a clear path toward the stated long-term target? | 20% | `career-blueprint.md` §Long-Term Direction |
| **Working style fit** — Does the daily work match stated preferences? | 20% | `career-blueprint.md` §Working Style Preferences |
| **Anti-pattern check** — Does the role violate any declared anti-pattern? | 15% | `career-blueprint.md` §Anti-Patterns |
| **Constraint compatibility** — Work authorization, location, clearance, industry limits | 15% | `career-blueprint.md` §Hard Constraints |
| **Salary floor** — Is expected compensation at or above the stated floor? | 5% | `career-blueprint.md` §Compensation Strategy |

### Hard Veto Rules (instant `do_not_apply`)

Any ONE of these triggers an automatic `❌ Not Recommended`:

- The JD violates a declared hard constraint in `career-blueprint.md` §Hard Constraints
  (e.g. requires work authorization the candidate does not have, requires a security
  clearance they cannot obtain, is in an excluded location or industry).
- The role matches a declared anti-pattern marked **hard** in §Anti-Patterns.
- Stated compensation is below the declared floor with no negotiation room.

Vetoes are read from the profile, not hardcoded here. If the user's blueprint declares
no hard constraints, no veto fires.

### Output

```json
{
  "careerScore": 85,
  "careerVerdict": "Tier 1 role with a direct path to the stated long-term target. Low meeting load, system-building focus. No constraint conflicts.",
  "tierClassification": "Tier 1",
  "springboardPath": "Model Validation → Quant Risk Modeler",
  "antiPatternViolations": [],
  "constraintStatus": "compatible"
}
```

---

## Decision Matrix

| HR Score | Career Score | Rating | Tracker Decision |
|----------|-------------|--------|-----------------|
| ≥ 75 | ≥ 75 | `🌟 Perfect Match` | `apply_now` |
| ≥ 60 | ≥ 60 | `📈 Good Fit with Gaps` | `apply_now` |
| ≥ 60 | 40–59 | `⚠️ Reach / Challenging Match` | `future_target` |
| 40–59 | ≥ 60 | `⚠️ Reach / Challenging Match` | `future_target` |
| Any | Hard veto triggered | `❌ Not Recommended` | `do_not_apply` |
| < 40 | < 60 | `❌ Not Recommended` | `do_not_apply` |
| < 60 | < 40 | `❌ Not Recommended` | `do_not_apply` |

---

## Final Output Schema

Return this exact JSON structure:

```json
{
  "rating": "🌟 Perfect Match",
  "decision": "apply_now",
  "hrScore": 82,
  "hrVerdict": "...",
  "hardSkillsCoverage": ["Python ✅", "SQL ✅"],
  "experienceGaps": ["..."],
  "careerScore": 90,
  "careerVerdict": "...",
  "tierClassification": "Tier 1",
  "springboardPath": "...",
  "antiPatternViolations": [],
  "constraintStatus": "compatible",
  "reason": "Overall recommendation, under 200 words, in the user's preferred language",
  "skillTags": ["..."],
  "domainTags": ["..."],
  "seniority": "Intern|Junior|Associate|Senior"
}
```

---

## Post-Evaluation Actions

- `🌟` or `📈` → record as `apply_now` and tailor a resume via the `resume-generator` skill.
- `⚠️` → record in the tracker as `future_target`; no auto-resume.
- `❌` → record as `do_not_apply` with the veto reason.

Before recommending anything, read `.career-coach/jobs/job_tracker.json` and skip roles
already recorded as `applied`, `interviewing`, or `do_not_apply`.

---

## Calibration Notes

- Weights above are a starting point. If the user says the scores feel wrong, adjust the
  weights in this file rather than fudging individual evaluations — the point is reproducibility.
- Be honest about gaps. An evaluator that rates everything 85 is useless.
- When the JD is vague, say so in `hrVerdict` rather than guessing generously.
