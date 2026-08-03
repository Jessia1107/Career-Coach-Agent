---
name: career-coach-agent
description: Use when a user wants career coaching, resume/JD analysis, work-history updates, polished resume bullets, gap planning, personal branding, interview prep, knowledge guides, or mock interviews from the local Career Coach project.
---

# Career Coach Agent

Use this skill when working from the Career Coach repository and the user asks about career coach, resume coach, interview prep, mock interview, JD fit, work-history updates, or resume bullet generation.

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

- Default to Chinese.
- Use concise American resume bullets when drafting resume content.
- Keep claims evidence-based.
- Ask only for missing facts that materially affect accuracy.
