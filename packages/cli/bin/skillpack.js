#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
SkillPack — AI coding tool skill package manager

Usage:
  skillpack <command> [options]

Commands:
  install <name[@version]> [...]        Install skills from the registry
  list [--all]                          List installed skills (--all: include local)
  update [name]                         Update all or a specific skill
  uninstall <name>                      Remove an installed skill
  init <name> [--scope <scope>]         Scaffold a new skill package
  override <name>                       Copy skill to project for local editing
  help                                  Show this help message

Options:
  --force    Overwrite existing skill files on install/update

Examples:
  skillpack install review                Install latest version
  skillpack install review@1.0.0          Install specific version
  skillpack install sdd review debug      Install multiple skills
  skillpack install review --force        Overwrite existing files
  skillpack list                          Show installed skills
  skillpack update                        Update all skills
  skillpack update review                 Update a specific skill
  skillpack uninstall review              Remove a skill
  skillpack init myskill                  Create new skill package
  skillpack init myskill --scope @myco    Create with custom scope
  skillpack override review               Override review skill locally
  skillpack override --list               List project overrides
  skillpack override --reset review       Remove local override

Private skills (org-scoped):
  skillpack install @mycompany/skill-xxx  Install from GitHub Packages

Learn more: https://github.com/castor12m/skill-pack
`.trim();

function run() {
  switch (command) {
    case 'install':
    case 'i':
      return require('../lib/commands/install')(args.slice(1));
    case 'list':
    case 'ls':
      return require('../lib/commands/list')(args.slice(1));
    case 'update':
    case 'up':
      return require('../lib/commands/update')(args.slice(1));
    case 'uninstall':
    case 'rm':
    case 'remove':
      return require('../lib/commands/uninstall')(args.slice(1));
    case 'init':
      return require('../lib/commands/init')(args.slice(1));
    case 'override':
      return require('../lib/commands/override')(args.slice(1));
    case 'version':
    case '--version':
    case '-v':
      console.log(require('../package.json').version);
      return;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

run();
