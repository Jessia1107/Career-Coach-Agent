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

```bash
cd career-coach-agent
./career-coach status
./career-coach ask "Turn this work history into resume bullets"
./career-coach export
```

The CLI stores runtime state under `.career-coach/`. That directory is local application data and is excluded from version control.

## Job workflow

Evaluate a new opportunity:

```bash
./career-coach judge-job \
  --company "Example Company" \
  --role "Data Scientist" \
  --jd-file path/to/job-description.txt
```

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
career-coach             CLI entry point
career_agent/             Agent, state, tracker, workflow, and provider code
agents-skill/             Reusable Agent skill definition
tests/                    Node.js built-in test suite
docs/superpowers/         Design and implementation documents
.env.example              Optional environment variable reference
```

## Privacy and security

Runtime sessions, job tracker data, resumes, job descriptions, interview transcripts, and generated artifacts belong in the local `.career-coach/` directory. Do not commit personal career data, employer confidential information, credentials, or API keys. The repository includes `.gitignore` rules for common local-state and secret files, but users should still review staged files before publishing a fork.

## License

This project is distributed under the MIT License.
