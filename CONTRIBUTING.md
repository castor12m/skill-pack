# Contributing to SkillPack

Thanks for your interest in contributing! This guide covers how to create skills, contribute to the CLI, and publish your own skills.

---

## Creating a Skill Package

### 1. Package Structure

```
packages/skill-myskill/
├── package.json       ← npm package metadata
├── skill.json         ← SkillPack manifest
├── SKILL.md           ← Skill entry file (required)
└── README.md          ← Displayed on npmjs.com (optional)
```

### 2. skill.json

```json
{
  "name": "myskill",
  "command": "/myskill",
  "entry": "SKILL.md",
  "files": ["SKILL.md"]
}
```

| Field | Description |
|-------|-------------|
| `name` | Skill name — installs to `~/.claude/skills/{name}/` |
| `command` | Slash command in Claude Code |
| `entry` | Entry file (always `SKILL.md`) |
| `files` | Files to install. Directories are supported (recursive copy) |

### 3. package.json

```json
{
  "name": "@skillpack/skill-myskill",
  "version": "1.0.0",
  "description": "My awesome skill for Claude Code",
  "keywords": [
    "claude-code",
    "claude-code-skills",
    "skill",
    "skillpack",
    "ai-coding-assistant",
    "ai-developer-tools",
    "slash-commands"
  ],
  "license": "MIT",
  "engines": { "node": ">=18" },
  "files": ["skill.json", "SKILL.md"]
}
```

**Important:**
- `files` must include `skill.json` + all files referenced in `skill.json`'s `files` array
- Never use `scripts.postinstall` — SkillPack uses direct copy, not npm lifecycle scripts

### 4. SKILL.md

This is the entry file that Claude Code reads. Write it as a prompt/instruction for the AI assistant. See existing skills in `packages/skill-*/SKILL.md` for examples.

### 5. File Copy Rules

Only files listed in `skill.json`'s `files` array are copied to `~/.claude/skills/{name}/`. Metadata files (`package.json`, `skill.json`, `README.md`) are **not** copied.

```
packages/skill-myskill/          ~/.claude/skills/myskill/
├── package.json                 (not copied)
├── skill.json                   (not copied)
├── README.md                    (not copied)
├── SKILL.md               →   ├── SKILL.md
└── templates/              →   └── templates/
    └── plan.md                      └── plan.md
```

---

## Contributing to This Repo

### Setup

```bash
git clone https://github.com/castor12m/skill-pack.git
cd skill-pack
npm install
```

This is an npm workspaces monorepo. All packages are under `packages/`.

### Workflow

1. Create a branch from `develop`
2. Make your changes
3. Run a changeset: `npx changeset` (select affected packages, bump type, and description)
4. Test locally:
   ```bash
   # Test skill install from local path
   node packages/cli/bin/skillpack.js install ./packages/skill-myskill

   # Verify package contents
   npm pack --dry-run -w packages/skill-myskill
   ```
5. Submit a PR to `develop`

### Changeset Workflow

We use [Changesets](https://github.com/changesets/changesets) for version management.

```bash
# After making changes, create a changeset
npx changeset
# → Select changed packages → patch/minor/major → Write description

# The changeset file is committed with your PR
# Maintainers handle version bumps and publishing
```

### Branch Strategy

- `main` — stable, published to npm
- `develop` — active development, PRs target here

---

## Publishing Your Own Skills

You don't have to contribute to this repo. Publish independently under your own npm scope:

```bash
# Create your skill package
mkdir my-skill && cd my-skill
# ... create package.json, skill.json, SKILL.md ...

# Publish to npm
npm publish --access public

# Anyone can install it
skillpack install @yourname/skill-myskill
```

### Private Skills (GitHub Packages)

```bash
# One-time setup
npm config set @mycompany:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)

# Publish
npm publish --registry https://npm.pkg.github.com

# Install
skillpack install @mycompany/skill-internal
```

---

## Package Naming Convention

| Type | npm Package Name | Install Command |
|------|-----------------|-----------------|
| Official | `@skillpack/skill-{name}` | `skillpack install {name}` |
| Personal/Org | `@yourname/skill-{name}` | `skillpack install @yourname/skill-{name}` |

---

## Security

- Skills are AI instruction files that directly control assistant behavior
- We use **manual deployment only** — no CI auto-publish
- All PRs are reviewed by maintainers before merging
- SHA-256 checksums protect installed files from silent modification

---

## Questions?

Open an issue at [github.com/castor12m/skill-pack/issues](https://github.com/castor12m/skill-pack/issues).
