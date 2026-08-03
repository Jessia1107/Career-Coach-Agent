# Local CLI Career Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local CLI-first Career Coach Agent that can be used from Codex, Antigravity, Colab, or a terminal without requiring the web UI.

**Architecture:** Add a focused CommonJS `career_agent/` module tree with state persistence, provider adapters, task prompt builders, an agent router, and a CLI entry. Keep the current web app untouched.

**Tech Stack:** Node.js built-ins, CommonJS, `node:test`, local JSON session files, optional local CLI provider.

---

## Chunk 1: Core State And Parsing

- [ ] Write failing tests for session persistence and JSON extraction.
- [ ] Implement `career_agent/state.js`.
- [ ] Implement `career_agent/json.js`.
- [ ] Run focused tests.

## Chunk 2: Provider And Task Router

- [ ] Write failing tests for local CLI provider command execution.
- [ ] Write failing tests for intent routing and artifact updates.
- [ ] Implement `career_agent/providers/local_cli.js`.
- [ ] Implement `career_agent/tasks.js`.
- [ ] Implement `career_agent/agent.js`.
- [ ] Run focused tests.

## Chunk 3: CLI Entry And Export

- [ ] Write failing tests or CLI smoke checks for `ask`, `status`, and `export`.
- [ ] Implement `career_agent/cli.js`.
- [ ] Add executable `career-coach` wrapper.
- [ ] Add `.career-coach/` to `.gitignore`.
- [ ] Run all tests and CLI smoke checks.
