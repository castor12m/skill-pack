# SkillPack

> Team-first AI skill management — standardize, version, audit, and benchmark your team's AI coding skills

**SkillPack** is a CLI tool for managing [Agent Skills](https://agentskills.io) across teams and organizations. Built on npm infrastructure, it provides version pinning, team synchronization, integrity auditing, and skill benchmarking — with zero additional infrastructure.

Keywords: Claude Code skills, Agent Skills, AI coding assistant, team skill management, skill audit, skill benchmark, prompt management, slash commands, AI developer tools, Codex skills, skill governance

---

## Why SkillPack?

AI coding agents (Claude Code, Codex, Cursor, etc.) support custom skills via the [Agent Skills](https://agentskills.io) open standard. But teams face real problems:

- **No team standardization** — each developer has different skills at different versions
- **No governance** — no way to audit what skills are installed or detect unauthorized modifications
- **No quality measurement** — no way to prove a skill actually improves code quality
- **No onboarding** — new team members manually copy skills from colleagues

**SkillPack solves these with npm infrastructure** — versioning, private registries, team sync, integrity auditing, and skill benchmarking.

---

## Quick Start

```bash
# Install the CLI
npm install -g @skillpack/cli

# Install skills
skillpack install review
skillpack install sdd debug handoff refactor

# List installed skills
skillpack list

# Update all skills
skillpack update
```

Installed skills are placed in `~/.claude/skills/` and are immediately available in Claude Code.

---

## CLI Commands

```
skillpack install <name[@version]> [...]   Install skills (default: latest)
skillpack install ./path/to/skill          Install from a local path
  --force                                  Overwrite existing files
skillpack list                             List installed skills
skillpack list --all                       List all skills (managed/local)
skillpack update [name]                    Update all or a specific skill
skillpack uninstall <name>                 Remove a skill
skillpack help                             Show help
```

### Install Flow

```
skillpack install review
  -> Downloads @skillpack/skill-review from npm registry
  -> Reads skill.json to determine which files to install
  -> Copies files to ~/.claude/skills/review/
  -> Records version in ~/.skillpack/manifest.json
```

### Private Skills

Package names starting with `@` are used as-is:

```bash
# Install an org-scoped skill
skillpack install @mycompany/skill-internal

# npm registry auth (one-time setup)
npm config set @mycompany:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
```

---

## Available Skills

| Skill | Description | Command |
|-------|-------------|---------|
| `review` | Pre-landing PR code review | `/review` |
| `sdd` | Specification-Driven Development | `/sdd` |
| `debug` | Systematic debugging (root cause first) | `/debug` |
| `handoff` | Session handoff | `/handoff` |
| `refactor` | Code refactoring | `/refactor` |

---

## Creating Skills

Anyone can create and publish their own skills to npm.

### Package Structure

```
packages/skill-myskill/
├── package.json       <- npm package metadata
├── skill.json         <- SkillPack manifest
├── SKILL.md           <- Skill entry file
└── README.md          <- Displayed on npmjs.com
```

### skill.json

```json
{
  "name": "myskill",
  "command": "/myskill",
  "entry": "SKILL.md",
  "files": ["SKILL.md"]
}
```

- `name` — Skill name (installed to `~/.claude/skills/{name}/`)
- `command` — Slash command in Claude Code
- `entry` — Entry file
- `files` — Files to install (directories supported)

### package.json

```json
{
  "name": "@skillpack/skill-myskill",
  "version": "1.0.0",
  "description": "My awesome skill for Claude Code",
  "keywords": ["claude-code", "skill", "skillpack"],
  "license": "MIT",
  "engines": { "node": ">=18" },
  "files": ["skill.json", "SKILL.md"]
}
```

### Publishing

```bash
npm publish --access public
```

Once published, anyone can install it with `skillpack install @yourname/skill-myskill`.

---

## Design Principles

1. **CLI direct copy** — `skillpack install` downloads the tarball and places files directly. No postinstall scripts (avoids security risks and `--ignore-scripts` issues).
2. **Non-destructive defaults** — Refuses to install if a skill already exists. Use `--force` to overwrite.
3. **State separation** — Install metadata lives in `~/.skillpack/manifest.json`, while `~/.claude/skills/` contains only skill files.
4. **npm paradigm** — Uses `npm view` and `npm pack` as subprocesses. No custom registry — just npmjs.com.
5. **Checksum integrity** — SHA-256 checksums are stored on install. Local modifications are detected and protected during updates.

---

## Repository Structure

```
skill-pack/
├── packages/
│   ├── cli/                  <- @skillpack/cli
│   │   ├── bin/skillpack.js
│   │   └── lib/
│   │       ├── paths.js
│   │       ├── manifest.js
│   │       ├── registry.js
│   │       ├── installer.js
│   │       └── commands/
│   ├── skill-review/         <- @skillpack/skill-review
│   ├── skill-sdd/            <- @skillpack/skill-sdd
│   ├── skill-debug/          <- @skillpack/skill-debug
│   ├── skill-handoff/        <- @skillpack/skill-handoff
│   └── skill-refactor/       <- @skillpack/skill-refactor
├── .changeset/               <- Changesets (version management)
├── package.json              <- Workspace root
└── README.md
```

---

## Contributing

1. Fork this repo
2. Add or modify a skill package under `packages/skill-xxx/`
3. Run `npx changeset` to describe your changes
4. Submit a PR

Or publish independently to npm under your own scope (`@yourname/skill-xxx`) to join the ecosystem without contributing to this repo.

---

## Roadmap

### Phase 1 — MVP (complete)
- [x] CLI (install, list, update, uninstall, search, init, override)
- [x] 5 core skills packaged (review, sdd, debug, handoff, refactor)
- [x] Local path install support
- [x] Checksum-based local modification detection
- [x] npmjs.com deployment

### Phase 2 — Team Operations (complete)
- [x] Private skills via GitHub Packages
- [x] `skillpack override` — project-local overrides
- [x] `skillpack init` — new skill scaffolding
- [x] Cursor `.cursor/rules/*.mdc` target support
- [x] CONTRIBUTING.md

### Phase 3 — Enterprise & Quality
- [x] Agent Skills open standard compatibility
- [ ] `skillpack team init/sync` — team skill standardization
- [ ] `skillpack audit` — integrity audit with JSON output
- [ ] `skillpack bench` — skill quality benchmarking (A/B + LLM-as-a-Judge)
- [ ] GitHub URL install (`github:owner/repo`)

---

## License

MIT
