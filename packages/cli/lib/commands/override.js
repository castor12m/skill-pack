const fs = require('fs');
const path = require('path');
const { skillsDir } = require('../paths');
const manifest = require('../manifest');

const color = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

module.exports = function override(args) {
  const force = args.includes('--force');
  const isList = args.includes('--list');
  const isReset = args.includes('--reset');

  if (isList) return listOverrides();

  if (isReset) {
    const name = args.filter(a => !a.startsWith('--'))[0];
    if (!name) {
      console.error('Usage: skillpack override --reset <name>');
      process.exitCode = 1;
      return;
    }
    return resetOverride(name);
  }

  const name = args.filter(a => !a.startsWith('--'))[0];
  if (!name) {
    console.error('Usage: skillpack override <name>');
    process.exitCode = 1;
    return;
  }
  return createOverride(name, force);
};

function createOverride(name, force) {
  const existing = manifest.get(name);
  if (!existing) {
    console.error(`"${name}" is not a managed skill. Run "skillpack install ${name}" first.`);
    process.exitCode = 1;
    return;
  }

  const source = path.join(skillsDir, name);
  if (!fs.existsSync(source)) {
    console.error(`Skill source not found at ${source}`);
    process.exitCode = 1;
    return;
  }

  const target = path.join(process.cwd(), '.claude', 'commands', name);

  if (fs.existsSync(target) && !force) {
    console.error(`Override already exists at ${target}`);
    console.error(`Use --force to overwrite.`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });

  console.log(`${color.green('✔')} Copied ${name} to ${color.dim(target)}`);
  console.log(`Edit files in that directory to customize the skill locally.`);
}

function listOverrides() {
  const commandsDir = path.join(process.cwd(), '.claude', 'commands');

  if (!fs.existsSync(commandsDir)) {
    console.log('No .claude/commands/ directory found in current project.');
    return;
  }

  const dirs = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (dirs.length === 0) {
    console.log('No project-level command overrides found.');
    return;
  }

  const managed = manifest.read();
  const maxName = Math.max(...dirs.map(n => n.length));

  for (const name of dirs) {
    const isManaged = Boolean(managed[name]);
    const tag = isManaged ? color.green('[override]') : color.dim('[local]');
    const dir = path.join(commandsDir, name);
    console.log(`${name.padEnd(maxName + 2)} ${tag}  ${color.dim(dir)}`);
  }
}

function resetOverride(name) {
  const target = path.join(process.cwd(), '.claude', 'commands', name);

  if (!fs.existsSync(target)) {
    console.error(`No override found for "${name}" at ${target}`);
    process.exitCode = 1;
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  console.log(`${color.green('✔')} Removed override for ${name}.`);
}
