const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const { resolvePackageName, viewPackage, downloadAndExtract, cleanup } = require('../registry');
const { readSkillJson, installFiles, computeChecksums, ConflictError } = require('../installer');

/**
 * Check if an argument looks like a local path.
 */
function isLocalPath(arg) {
  return arg.startsWith('.') || arg.startsWith('/') || arg.startsWith('~');
}

/**
 * Resolve a local path to absolute and read version from its package.json.
 */
function resolveLocal(raw) {
  const resolved = path.resolve(raw.replace(/^~/, require('os').homedir()));
  if (!fs.existsSync(resolved)) {
    throw new Error(`Local path not found: ${resolved}`);
  }
  const pkgJsonPath = path.join(resolved, 'package.json');
  let version = '0.0.0';
  let source = null;
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    version = pkg.version || '0.0.0';
    source = pkg.name || null;
  }
  return { packageDir: resolved, version, source };
}

module.exports = function install(args) {
  const force = args.includes('--force');
  const target = extractOption(args, '--target') || 'claude';
  const names = args.filter(a => !a.startsWith('--'));

  if (names.length === 0) {
    console.error('Usage: skillpack install <name[@version]> [...]');
    console.error('       skillpack install ./path/to/skill-package');
    process.exitCode = 1;
    return;
  }

  if (!['claude', 'cursor'].includes(target)) {
    console.error(`Unknown target: ${target}. Supported: claude, cursor`);
    process.exitCode = 1;
    return;
  }

  for (const raw of names) {
    try {
      if (isLocalPath(raw)) {
        // --- Local path install ---
        const { packageDir, version, source } = resolveLocal(raw);
        const skillJson = readSkillJson(packageDir);

        const existing = manifest.get(skillJson.name);
        if (existing && !force) {
          console.log(`${skillJson.name}@${existing.version} is already installed. Use --force to reinstall.`);
          continue;
        }

        const targetDir = installFiles(packageDir, skillJson, { force });
        const checksums = computeChecksums(skillJson);
        manifest.set(skillJson.name, version, checksums, source);
        console.log(`\u2705 ${skillJson.name}@${version} \u2192 ${targetDir}`);
        if (target === 'cursor') {
          installToCursor(packageDir, skillJson, { force });
        }
      } else {
        // --- Registry install ---
        const { name, version } = parseName(raw);
        const packageName = resolvePackageName(name);

        const existing = manifest.get(extractSkillName(name));
        if (existing && !force && !version) {
          console.log(`${extractSkillName(name)}@${existing.version} is already installed. Use --force to reinstall.`);
          continue;
        }

        const info = viewPackage(packageName, version);
        if (!info) {
          console.error(`Package not found: ${packageName}${version ? '@' + version : ''}`);
          process.exitCode = 1;
          continue;
        }

        const packageDir = downloadAndExtract(packageName, version);
        try {
          const skillJson = readSkillJson(packageDir);
          const targetDir = installFiles(packageDir, skillJson, { force });
          const checksums = computeChecksums(skillJson);
          manifest.set(skillJson.name, info.version, checksums, packageName);
          console.log(`\u2705 ${skillJson.name}@${info.version} \u2192 ${targetDir}`);
          if (target === 'cursor') {
            installToCursor(packageDir, skillJson, { force });
          }
        } finally {
          cleanup(packageDir);
        }
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        console.error(`\u26a0\ufe0f  ${err.message}`);
      } else {
        console.error(`Failed to install ${raw}: ${err.message}`);
      }
      process.exitCode = 1;
    }
  }
};

function parseName(raw) {
  // Handle scoped packages: @scope/name@version
  if (raw.startsWith('@')) {
    const lastAt = raw.lastIndexOf('@');
    if (lastAt > 0) {
      return { name: raw.slice(0, lastAt), version: raw.slice(lastAt + 1) };
    }
    return { name: raw, version: null };
  }
  // Simple name: name@version
  const atIdx = raw.indexOf('@');
  if (atIdx > 0) {
    return { name: raw.slice(0, atIdx), version: raw.slice(atIdx + 1) };
  }
  return { name: raw, version: null };
}

function extractSkillName(name) {
  // @scope/skill-xxx → xxx, review → review
  if (name.startsWith('@')) {
    const parts = name.split('/');
    const pkg = parts[parts.length - 1];
    return pkg.replace(/^skill-/, '');
  }
  return name;
}

/**
 * Install skill entry file to .cursor/rules/ as an .mdc file.
 * Cursor IDE reads .cursor/rules/*.mdc as project-level rules.
 */
function installToCursor(packageDir, skillJson, { force = false } = {}) {
  const cursorDir = path.join(process.cwd(), '.cursor', 'rules');
  const targetFile = path.join(cursorDir, `${skillJson.name}.mdc`);

  if (fs.existsSync(targetFile) && !force) {
    console.log(`  ⚠️  Cursor rule already exists: ${targetFile} (use --force)`);
    return;
  }

  fs.mkdirSync(cursorDir, { recursive: true });

  // Read the entry file (SKILL.md) and write as .mdc
  const entryPath = path.join(packageDir, skillJson.entry || 'SKILL.md');
  if (!fs.existsSync(entryPath)) {
    console.log(`  ⚠️  Entry file not found: ${skillJson.entry || 'SKILL.md'}`);
    return;
  }

  const content = fs.readFileSync(entryPath, 'utf8');
  fs.writeFileSync(targetFile, content);
  console.log(`  📎 Cursor rule → ${targetFile}`);
}

/**
 * Extract a --key value pair from args.
 * Returns the value and removes both --key and value from args array.
 */
function extractOption(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
}
