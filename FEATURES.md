# Features

Career Coach Agent is organized around a local career operating system rather than a browser dashboard.

## Career profile and goals

The Agent keeps two concepts separate:

- Profile: work history, education, skills, projects, resume bullets, and reusable STAR stories.
- Career Goal: target industries, target roles, preferred work style, constraints, and long-term direction.

This separation lets the same profile support different career decisions without mixing current facts with future ambitions.

## Job decision workflow

`judge-job` compares a saved career goal with an original job description and returns one of three decisions:

- `apply_now`: the opportunity has no clear hard red flag and is reasonably aligned.
- `do_not_apply`: the job contains an explicit hard conflict, such as an incompatible requirement or a clear role mismatch.
- `future_target`: the role strongly matches the long-term goal but requires experience that cannot honestly be presented today.

Missing sponsorship or location information is not treated as an automatic rejection. Exact duplicate job descriptions are detected before a new provider call. Similar roles can reuse an existing resume when the role and job-description overlap are high enough.

## Resume and experience workflows

- Transform raw work history into action-oriented resume bullets.
- Organize examples with STAR and measurable-result structures when the source facts support them.
- Generate a personal brand narrative and reusable interview stories.
- Evaluate resume fit against a target JD when the workflow requires it.

The standalone CLI accepts UTF-8 text input. PDF and DOCX extraction is expected to be handled by the host agent or a future document adapter.

## Interview workflow

`interview-start` loads the tracked job context automatically:

- Original job description.
- Resume version or reuse metadata.
- Career goal.
- Interviewer notes or profile information.
- Existing evaluation and preparation artifacts.

It can generate:

- Interviewer persona.
- Senior Hiring Manager Evaluation.
- Key concerns and likely follow-up areas.
- Stories to emphasize.
- Targeted preparation questions.

`interview-review` accepts a transcript and produces:

- Performance summary.
- Strong and weak answers.
- Missed opportunities.
- Red flags exposed during the interview.
- Next preparation actions.
- Reusable lessons for future interviews.

## Job tracker

The machine-readable source of truth is stored locally at:

```text
.career-coach/jobs/job_tracker.json
```

A human-readable view is written to:

```text
.career-coach/jobs/job_tracker.md
```

Supported statuses:

```text
applied
do_not_apply
future_target
interviewing
interviewed
offer
rejected_after_interview
withdrawn
archived
```

The Agent does not claim to submit applications to external websites. `applied` represents the local workflow state after an application is prepared or recorded.

## Cleanup policy

- Cleanup runs at most once every 30 days unless forced.
- Records older than 90 days can be archived when they have not reached an interview stage.
- Interviewing, interviewed, offer, and post-interview rejection records retain their detailed artifacts.
- Archived records retain enough metadata to prevent accidental duplicate analysis.

## Provider model

The core Agent is independent of a specific model vendor. It uses a provider command configured through:

```text
CAREER_COACH_PROVIDER_COMMAND
CAREER_COACH_PROVIDER_ARGS
```

Any trusted CLI or local wrapper that accepts a prompt on stdin and returns text on stdout can be used. This includes Codex-based commands, Cloud Code workflows, Ollama, and custom provider scripts. The repository does not contain provider API keys and does not require direct browser automation.

## Public repository boundary

The public repository contains reusable Agent code, tests, documentation, and the provider interface. Runtime state and user-specific career artifacts remain local and are excluded through `.gitignore`.
