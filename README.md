# SkillPack

> A package manager for AI coding assistant skills — install, manage, and publish like npm

---

## Why SkillPack?

Claude Code lets you define custom skills in `~/.claude/skills/`. But:

- There's no official way to keep skills in sync across multiple machines
- No version tracking — you can't tell which version of a skill you're running
- No system for standardizing skills across a team or onboarding new members

**SkillPack leverages npm infrastructure** to provide versioning, a registry, and team access control — with zero additional infrastructure.

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

### Phase 1 — MVP
- [x] CLI (install, list, update, uninstall)
- [x] 5 core skills packaged (review, sdd, debug, handoff, refactor)
- [x] Local path install support
- [x] Checksum-based local modification detection
- [x] npmjs.com deployment

### Phase 2 — Team Operations
- [ ] Private skills via GitHub Packages
- [ ] `skillpack override` — project-local overrides
- [ ] `skillpack init` — new skill scaffolding
- [ ] CONTRIBUTING.md

### Phase 3 — Expansion
- [ ] `skillpack search` — registry search
- [ ] Cursor `.cursorrules` target support
- [ ] Multi-AI tool install path configuration

---

## License

MIT
