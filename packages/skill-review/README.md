# @skillpack/skill-review

Pre-landing PR review skill for Claude Code.

Analyzes diff against the base branch for SQL safety, LLM trust boundary violations, conditional side effects, and other structural issues.

## Install

```bash
skillpack install review
```

## Usage

In Claude Code:

```
/review
```

## What it checks

- SQL safety (destructive operations, missing WHERE clauses)
- LLM trust boundary violations
- Conditional side effects
- Structural issues in the diff

## Part of [SkillPack](https://github.com/naraspace/skill-pack)
