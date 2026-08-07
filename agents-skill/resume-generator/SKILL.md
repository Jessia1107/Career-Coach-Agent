---
name: resume-generator
description: Tailor and generate the user's one-page resume from a structured JSON master profile, targeted at a specific job description. Use when the user asks to generate, tailor, rebuild, or export a resume, when job-fit-evaluator returns apply_now, or when the user says "make me a resume for this role", "tailor my resume", "帮我改简历".
---

# Resume Generator

## Purpose

Produce a tailored one-page resume from a structured JSON master profile, reordered and
reworded for a specific job description. The master profile is the source of truth; each
application produces a derived copy, never an edit of the master.

## Input Contract

The master resume lives at `.career-coach/profile/resume-input.json` and follows
`setup/templates/resume-input.schema.json`:

```json
{
  "contact": {
    "name": "Your Name",
    "email": "you@example.com",
    "phone": "000-000-0000",
    "linkedin": "linkedin.com/in/your-handle"
  },
  "education": [
    {
      "institution": "UNIVERSITY NAME, School or College",
      "location": "City, ST",
      "degree": "Master of Science in Your Field",
      "dates": "Month YYYY - Month YYYY",
      "details": ["Concentration, honors, or key coursework"]
    }
  ],
  "credentials": "Certification or exam summary as a single line, or empty string",
  "experience": [
    {
      "organization": "Company",
      "location": "City, ST",
      "title": "Role",
      "dates": "Month YYYY - Month YYYY",
      "bullets": ["Action + method + quantified result"]
    }
  ],
  "projects": [
    { "name": "Project Name", "bullets": ["Skill + business purpose + result"] }
  ],
  "skills": {
    "Programming": ["Python", "SQL"],
    "Languages": ["English"]
  }
}
```

If the user has no master file yet, run `career-profile-builder` first — do not improvise
a resume from chat history.

## Tailoring Workflow

1. **Read the JD.** Extract required skills, preferred skills, and the top 3 responsibilities.
2. **Reorder, don't rewrite history.** Move the most JD-relevant experience bullets to the
   top of each role. The one-page fitter drops trailing bullets first, so ordering is how
   you control what survives.
3. **Re-word for keyword overlap** using the JD's own vocabulary — but only where the
   underlying fact is genuinely the same thing. Renaming "built an ETL pipeline" to
   "built a data ingestion pipeline" is fine. Renaming it to "built a real-time streaming
   platform" is not.
4. **Never fabricate.** No invented metrics, employers, dates, tools, or clearances. If a
   JD requires something absent from the master profile, leave the gap and let
   `job-fit-evaluator` report it.
5. **Trim to one page.** Drop weakest projects first, then trailing bullets from the
   oldest roles, then optional education details. Never shrink font below the template's
   baseline or delete contact info.
6. **Write the tailored JSON to a scratch path**, not over the master file.

## Output

Write generated resumes to a directory the user controls, named per application:

```
<output-dir>/<Name>_Resume_<Company>_<Role>.docx
<output-dir>/<Name>_Resume_<Company>_<Role>.pdf
```

Configure the output directory via `CAREER_COACH_RESUME_OUTPUT_DIR`; default to
`.career-coach/outputs/resumes/`. Sanitize company and role into `[A-Za-z0-9_]` before
using them in a filename.

## Rendering Backend

This skill defines the *content contract*. Rendering is pluggable — pick one:

- **Bring your own template.** Put a `.docx` you already like in `assets/`, and write a
  script that fills it via `python-docx`, preserving styles. This is the recommended path:
  a resume layout you have already used successfully is worth more than a generated one.
- **Generate from scratch** with `python-docx` or a LaTeX template, then convert to PDF
  with LibreOffice (`soffice --headless --convert-to pdf`).
- **Markdown → PDF** via Pandoc, for users who do not need a DOCX.

Whatever the backend, it must report page count and fail loudly if the result exceeds one
page. Silent two-page output is the main failure mode of automated resume tools.

## Bullet Style Reference

- Start with a strong past-tense verb; no "Responsible for".
- One line each where possible; two lines maximum.
- `Action + method + quantified result` — e.g. "Automated monthly reconciliation in Python,
  cutting a 6-hour manual process to 15 minutes across 20,000+ records."
- Numbers beat adjectives. If there is no number, name the concrete artifact instead.
- No first-person pronouns, no periods-optional inconsistency — pick one and hold it.

## Checklist Before Delivering

- [ ] Page count is exactly 1
- [ ] Contact block is complete and correct
- [ ] No placeholder text (`TBD`, `Your Name`, `Company`) survived
- [ ] Every JD-required skill that the user actually has appears somewhere on the page
- [ ] Dates are consistent and in reverse-chronological order
- [ ] The exact output file path is stated back to the user
