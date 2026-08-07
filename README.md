# Career Coach Agent

Career Coach Agent is a local, provider-agnostic career workflow tool for making better job decisions, preparing targeted applications, and learning from interviews.

It combines a lightweight Node.js CLI, persistent local state, structured prompts, and a pluggable model provider. Your profile, career goals, job history, and interview artifacts stay on the local machine.

## What it does

- Maintains a separate career profile and career goal.
- Turns raw work history into concise resume bullets and STAR stories.
- Evaluates a job description as a career-fit decision.
- Classifies opportunities as `apply_now`, `do_not_apply`, or `future_target`.
- Detects duplicate job descriptions before spending another model call.
- Reuses a prior resume when a new role is highly similar.
- Stores the original job description so expired job links do not lose context.
- Starts interview preparation from the saved job, resume, career goal, and interviewer context.
- Runs Hiring Manager Evaluation and interview preparation after an interview is scheduled.
- Reviews interview transcripts and stores reusable lessons.
- Tracks application states such as `applied`, `interviewing`, `offer`, and `rejected_after_interview`.
- Archives stale non-interview applications while preserving interview-related records.

## Requirements

- Node.js 18 or newer.
- A model provider is optional for local scaffolding and required for full AI-generated analysis.

## Quick start

This repository ships with **no personal data**. The skills describe *how* to evaluate jobs and write resumes; they read *who you are* from three profile files you generate on first run.

```bash
cd career-coach-agent
./career-coach init
```

`init` scaffolds `.career-coach/profile/` from the blank templates in `setup/templates/`. Then let the agent fill them in — open the repository in your AI coding assistant and say:

```
Use the career-profile-builder skill to build my career profile.
```

That runs a short structured interview (about 5–7 turns of batched questions) covering education, work history, career direction, salary floor, work authorization, and the roles you want auto-rejected. It writes:

| File | What it holds | Who reads it |
|------|--------------|--------------|
| `.career-coach/profile/candidate-profile.md` | Education, credentials, work history, skills | `job-fit-evaluator` — *can you get this job?* |
| `.career-coach/profile/career-blueprint.md` | Direction, role tiers, constraints, anti-patterns | `job-fit-evaluator` — *should you take it?* |
| `.career-coach/profile/resume-input.json` | Structured master resume | `resume-generator` |

Verify and go:

```bash
./career-coach status
./career-coach ask "Turn this work history into resume bullets"
./career-coach export
```

Prefer to fill the templates in by hand, or want to tune the scoring weights? See [`setup/ONBOARDING.md`](setup/ONBOARDING.md).

The CLI stores runtime state under `.career-coach/`. That directory is local application data and is excluded from version control.

## Job workflow

Evaluate a new opportunity:

```bash
./career-coach judge-job \
  --company "Example Company" \
  --role "Data Scientist" \
  --jd-file path/to/job-description.txt
```

Discover public job opportunities on LinkedIn (supports flexible search filters):

```bash
./career-coach discover \
  --keywords "Actuarial Analyst" \
  --location "New York, NY" \
  --jobage 1 \
  --experience-level "entry,associate" \
  --remote "hybrid" \
  --limit 10
```

Supported `--experience-level` values: `internship` (1), `entry` (2), `associate` (3), `mid_senior` (4), `director` (5), `executive` (6). Combine with commas (e.g. `entry,associate`).
Supported `--remote` values: `onsite`, `hybrid`, `remote`.

Start interview preparation after an interview is scheduled:

```bash
./career-coach interview-start \
  --company "Example Company" \
  --role "Data Scientist" \
  --interviewer "Interviewer notes or profile text"
```

Review an interview transcript:

```bash
./career-coach interview-review \
  --company "Example Company" \
  --role "Data Scientist" \
  --transcript-file path/to/interview-transcript.txt
```

Already tracking applications in a spreadsheet? Import them (deduplicated by company/role/JD fingerprint, so re-running is safe):

```bash
python scripts/migrate_from_csv.py path/to/applications.csv
```

View or update the tracker:

```bash
./career-coach tracker
./career-coach update-status \
  --company "Example Company" \
  --role "Data Scientist" \
  --status offer
./career-coach cleanup
```

The standalone CLI currently reads UTF-8 text files. PDF or DOCX content can be extracted by the host environment or provider before it is passed to the CLI. A browser-based PDF parser is intentionally not part of this Agent repository.

## Model provider compatibility

The Agent is provider-agnostic. It sends prompts to a configured local command through standard input and reads the generated response from standard output. This allows it to work with:

- Codex CLI or a Codex-driven local command.
- Any trusted local AI CLI or command-line wrapper.
- Cloud Code or another authenticated local coding-agent CLI.
- Ollama or another local model runner.
- A custom trusted provider script.

Configure the provider command in your shell:

```bash
export CAREER_COACH_PROVIDER_COMMAND="your-provider-command"
export CAREER_COACH_PROVIDER_ARGS="optional arguments"
./career-coach ask "Generate interview preparation questions"
```

The Agent does not contain provider API keys and does not directly automate browser websites. The provider command must already be installed and authenticated in the environment where the Agent runs. If no provider is configured, the CLI returns a deterministic scaffold so the local workflow and state model can still be inspected.

## Repository layout

```text
career-coach                          CLI entry point
career_agent/                         Agent, state, tracker, workflow, and provider code
agents-skill/
  career-profile-builder/             Interviews you and writes your profile files
  job-fit-evaluator/                  Dual-dimension job scoring methodology
  resume-generator/                   Resume tailoring contract and one-page rules
  career-coach-agent/                 Top-level skill entry point
setup/
  ONBOARDING.md                       How to build your own profile
  templates/                          Blank profile, blueprint, and resume templates
scripts/migrate_from_csv.py           Import an existing application spreadsheet
tests/                                Node.js built-in test suite
docs/superpowers/                     Design and implementation documents
.env.example                          Optional environment variable reference
```

Everything personal lives in `.career-coach/`, which is gitignored.

## Privacy and security

Your profile, runtime sessions, job tracker data, resumes, job descriptions, interview transcripts, and generated artifacts all belong in the local `.career-coach/` directory, which is gitignored in full.

Do not commit personal career data, employer confidential information, credentials, or API keys. The `.gitignore` also blocks `.docx`/`.pdf`/`.xlsx`/`.csv` files and scratch resume JSON anywhere in the tree, but review `git status` before every push to a fork.

The profile files contain contact details, compensation, and work-authorization status. Treat them the way you would treat a passport scan: keep them local, and never paste their contents into a public issue, PR, or shared log.

## License

This project is distributed under the MIT License.
