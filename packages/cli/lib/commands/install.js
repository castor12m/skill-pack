const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const { resolvePackageName, viewPackage, downloadAndExtract, cleanup, parseGitHubUrl, downloadFromGitHub } = require('../registry');
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

/**
 * Parse a name[@version] string.
 */
function parseName(raw) {
  if (raw.startsWith('@')) {
    const lastAt = raw.lastIndexOf('@');
    if (lastAt > 0) {
      return { name: raw.slice(0, lastAt), version: raw.slice(lastAt + 1) };
    }
    return { name: raw, version: null };
  }
  const atIdx = raw.indexOf('@');
  if (atIdx > 0) {
    return { name: raw.slice(0, atIdx), version: raw.slice(atIdx + 1) };
  }
  return { name: raw, version: null };
}

/**
 * Extract skill name from a package name.
 * @scope/skill-xxx → xxx, review → review
 */
function extractSkillName(name) {
  if (name.startsWith('@')) {
    const parts = name.split('/');
    const pkg = parts[parts.length - 1];
    return pkg.replace(/^skill-/, '');
  }
  return name;
}

/**
 * Install a single skill by name or local path.
 * Returns { skillName, version } on success.
 * Throws on failure.
 */
function installSingle(raw, { force = false, target = 'claude' } = {}) {
  // GitHub install: github:owner/repo[@ref][/path]
  const ghParsed = parseGitHubUrl(raw);
  if (ghParsed) {
    const packageDir = downloadFromGitHub(ghParsed);
    try {
      const skillJson = readSkillJson(packageDir);
      const existing = manifest.get(skillJson.name);
      if (existing && !force) {
        return { skillName: skillJson.name, version: existing.version, skipped: true };
      }

      const targetDir = installFiles(packageDir, skillJson, { force });
      const checksums = computeChecksums(skillJson);
      const source = `github:${ghParsed.owner}/${ghParsed.repo}${ghParsed.ref !== 'HEAD' ? '@' + ghParsed.ref : ''}`;
      // Read version from package.json if available
      const pkgJsonPath = path.join(packageDir, 'package.json');
      let version = '0.0.0';
      if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        version = pkg.version || '0.0.0';
      }
      manifest.set(skillJson.name, version, checksums, source);

      if (target === 'cursor') {
        installToCursor(packageDir, skillJson, { force });
      }

      return { skillName: skillJson.name, version, skipped: false };
    } finally {
      // Clean up the temp directory (go up to the skillpack-gh-xxx root)
      const tmpRoot = packageDir.split('/extracted/')[0] || path.resolve(packageDir, '..', '..');
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }

  if (isLocalPath(raw)) {
    const { packageDir, version, source } = resolveLocal(raw);
    const skillJson = readSkillJson(packageDir);

    const existing = manifest.get(skillJson.name);
    if (existing && !force) {
      return { skillName: skillJson.name, version: existing.version, skipped: true };
    }

    const targetDir = installFiles(packageDir, skillJson, { force });
    const checksums = computeChecksums(skillJson);
    manifest.set(skillJson.name, version, checksums, source);

    if (target === 'cursor') {
      installToCursor(packageDir, skillJson, { force });
    }

    return { skillName: skillJson.name, version, skipped: false };
  }

  // Registry install
  const { name, version } = parseName(raw);
  const packageName = resolvePackageName(name);
  const skillName = extractSkillName(name);

  const existing = manifest.get(skillName);
  if (existing && !force && !version) {
    return { skillName, version: existing.version, skipped: true };
  }

  const info = viewPackage(packageName, version);
  if (!info) {
    throw new Error(`Package not found: ${packageName}${version ? '@' + version : ''}`);
  }

  const packageDir = downloadAndExtract(packageName, version);
  try {
    const skillJson = readSkillJson(packageDir);
    const targetDir = installFiles(packageDir, skillJson, { force });
    const checksums = computeChecksums(skillJson);
    manifest.set(skillJson.name, info.version, checksums, packageName);

    if (target === 'cursor') {
      installToCursor(packageDir, skillJson, { force });
    }

    return { skillName: skillJson.name, version: info.version, skipped: false };
  } finally {
    cleanup(packageDir);
  }
}

/**
 * CLI entry point: skillpack install <name[@version]> [...]
 */
function install(args) {
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
      const result = installSingle(raw, { force, target });
      if (result.skipped) {
        console.log(`${result.skillName}@${result.version} is already installed. Use --force to reinstall.`);
      } else {
        console.log(`\u2705 ${result.skillName}@${result.version}`);
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
}

/**
 * Install skill entry file to .cursor/rules/ as an .mdc file.
 */
function installToCursor(packageDir, skillJson, { force = false } = {}) {
  const cursorDir = path.join(process.cwd(), '.cursor', 'rules');
  const targetFile = path.join(cursorDir, `${skillJson.name}.mdc`);

  if (fs.existsSync(targetFile) && !force) {
    console.log(`  \u26a0\ufe0f  Cursor rule already exists: ${targetFile} (use --force)`);
    return;
  }

  fs.mkdirSync(cursorDir, { recursive: true });

  const entryPath = path.join(packageDir, skillJson.entry || 'SKILL.md');
  if (!fs.existsSync(entryPath)) {
    console.log(`  \u26a0\ufe0f  Entry file not found: ${skillJson.entry || 'SKILL.md'}`);
    return;
  }

  const content = fs.readFileSync(entryPath, 'utf8');
  fs.writeFileSync(targetFile, content);
  console.log(`  \ud83d\udcce Cursor rule \u2192 ${targetFile}`);
}

/**
 * Extract a --key value pair from args.
 */
function extractOption(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
}

module.exports = install;
module.exports.installSingle = installSingle;
module.exports.parseName = parseName;
module.exports.extractSkillName = extractSkillName;
