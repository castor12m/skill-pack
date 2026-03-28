'use strict';

const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const { installSingle } = require('./install');
const { resolvePackageName, viewPackage } = require('../registry');
const { getModifiedFiles } = require('../installer');

const CONFIG_FILES = ['skillpack.config.json', '.skillpackrc'];

/**
 * Find the team config file in the current directory.
 * Priority: skillpack.config.json > .skillpackrc
 */
function findConfig() {
  const cwd = process.cwd();
  const found = [];
  for (const name of CONFIG_FILES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) found.push({ name, path: p });
  }
  if (found.length > 1) {
    console.error(`Warning: Both ${found.map(f => f.name).join(' and ')} found. Using ${found[0].name}.`);
  }
  return found[0] || null;
}

/**
 * Read and parse the team config file.
 */
function readConfig(configFile) {
  const raw = fs.readFileSync(configFile.path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${configFile.name}: invalid JSON`);
  }
}

/**
 * skillpack team init [--force]
 * Generate skillpack.config.json from currently installed skills.
 */
function teamInit(args) {
  const force = args.includes('--force');
  const configPath = path.join(process.cwd(), 'skillpack.config.json');

  if (fs.existsSync(configPath) && !force) {
    console.error(`skillpack.config.json already exists. Use --force to overwrite.`);
    process.exitCode = 1;
    return;
  }

  const data = manifest.read();
  const skillNames = Object.keys(data);

  if (skillNames.length === 0) {
    console.error('No skills installed. Install skills first, then run team init.');
    process.exitCode = 1;
    return;
  }

  const config = { skills: {} };
  for (const name of skillNames.sort()) {
    const entry = data[name];
    const key = entry.source && entry.source.startsWith('@') && !entry.source.startsWith('@skillpack/')
      ? entry.source
      : name;
    config.skills[key] = entry.version;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`\u2705 Created skillpack.config.json (${skillNames.length} skills)`);
  for (const [key, ver] of Object.entries(config.skills)) {
    console.log(`  ${key}: ${ver}`);
  }
}

/**
 * skillpack team sync [--force] [--dry-run]
 * Install/update skills to match the team config.
 */
function teamSync(args) {
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const configFile = findConfig();
  if (!configFile) {
    console.error('No skillpack.config.json or .skillpackrc found.');
    console.error('Run "skillpack team init" to create one, or add it manually.');
    process.exitCode = 1;
    return;
  }

  const config = readConfig(configFile);
  if (!config.skills || Object.keys(config.skills).length === 0) {
    console.log('No skills defined in config. Nothing to sync.');
    return;
  }

  console.log(`Syncing from ${configFile.name}...`);
  if (dryRun) console.log('(dry run — no changes will be made)\n');

  const data = manifest.read();
  let installed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [key, versionSpec] of Object.entries(config.skills)) {
    // Resolve skill name: @scope/skill-xxx → xxx, review → review
    const skillName = key.startsWith('@')
      ? key.split('/').pop().replace(/^skill-/, '')
      : key;

    const existing = data[skillName];

    if (existing && existing.version === versionSpec) {
      // Check for local modifications
      const modified = getModifiedFiles(skillName, existing.checksums);
      if (modified.length > 0) {
        console.log(`  \u26a0\ufe0f  ${skillName}@${existing.version} (modified locally: ${modified.join(', ')})`);
        if (!force) {
          skipped++;
          continue;
        }
      } else {
        console.log(`  \u2713 ${skillName}@${existing.version} (up to date)`);
        skipped++;
        continue;
      }
    }

    const action = existing ? 'update' : 'install';
    const installName = key.startsWith('@') ? key : key;

    if (dryRun) {
      if (existing) {
        console.log(`  \u2192 Would ${action} ${skillName}: ${existing.version} \u2192 ${versionSpec}`);
      } else {
        console.log(`  \u2192 Would install ${skillName}@${versionSpec}`);
      }
      continue;
    }

    try {
      const spec = versionSpec ? `${installName}@${versionSpec}` : installName;
      const result = installSingle(spec, { force: force || !existing });
      if (result.skipped) {
        console.log(`  \u2713 ${result.skillName}@${result.version} (already installed)`);
        skipped++;
      } else {
        console.log(`  \u2705 ${result.skillName}@${result.version} (${action}d)`);
        if (action === 'install') installed++;
        else updated++;
      }
    } catch (err) {
      console.error(`  \u274c ${skillName}: ${err.message}`);
      failed++;
    }
  }

  if (!dryRun) {
    console.log(`\nSync complete: ${installed} installed, ${updated} updated, ${skipped} unchanged, ${failed} failed`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

/**
 * CLI entry point: skillpack team <subcommand>
 */
module.exports = function team(args) {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'init':
      return teamInit(subArgs);
    case 'sync':
      return teamSync(subArgs);
    default:
      console.error('Usage: skillpack team <init|sync>');
      console.error('  init [--force]          Generate config from installed skills');
      console.error('  sync [--force] [--dry-run]  Install/update to match config');
      process.exitCode = 1;
  }
};

module.exports.findConfig = findConfig;
module.exports.teamInit = teamInit;
module.exports.teamSync = teamSync;
