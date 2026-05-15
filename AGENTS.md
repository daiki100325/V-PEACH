# AGENTS Guide

This project uses documentation-first development with Obsidian notes.

## Core rules
- Keep app behavior and docs in sync in the same task.
- Treat implementation files as source of truth for code behavior.
- Keep notes concise; do not duplicate full specs.

## Required doc updates after meaningful code changes
- `notes/_index.md` (new key entry points)
- `notes/*_architecture.md` (structure/data flow changes)
- `notes/*_requirements.md` (behavior/constraint changes)
- `notes/*_release-plan.md` (rollout/checklist updates)
- `DECISIONS.md` (important trade-offs/decisions)
- `TROUBLESHOOTING.md` (non-obvious bug cause/fix/prevention)
- `CHANGELOG_DEV.md` (date, what, why, files, related)

## Bootstrap (template copy only)
- If placeholders exist (`PROJECT`, `project/project-slug`), replace them before normal implementation.

## Output expectation
- At task end, report which docs were updated and why.
