const manifest = require('../manifest');
const { resolvePackageName, viewPackage, downloadAndExtract, cleanup } = require('../registry');
const { readSkillJson, installFiles, ConflictError } = require('../installer');

module.exports = function install(args) {
  const force = args.includes('--force');
  const names = args.filter(a => !a.startsWith('--'));

  if (names.length === 0) {
    console.error('Usage: skillpack install <name[@version]> [...]');
    process.exitCode = 1;
    return;
  }

  for (const raw of names) {
    const { name, version } = parseName(raw);
    const packageName = resolvePackageName(name);

    try {
      // Check if already installed (same version)
      const existing = manifest.get(extractSkillName(name));
      if (existing && !force && !version) {
        console.log(`${extractSkillName(name)}@${existing.version} is already installed. Use --force to reinstall.`);
        continue;
      }

      // Fetch package info
      const info = viewPackage(packageName, version);
      if (!info) {
        console.error(`Package not found: ${packageName}${version ? '@' + version : ''}`);
        process.exitCode = 1;
        continue;
      }

      // Download and extract
      const packageDir = downloadAndExtract(packageName, version);

      try {
        // Read skill.json and install files
        const skillJson = readSkillJson(packageDir);
        const targetDir = installFiles(packageDir, skillJson, { force });

        // Update manifest
        manifest.set(skillJson.name, info.version);

        console.log(`\u2705 ${skillJson.name}@${info.version} \u2192 ${targetDir}`);
      } finally {
        cleanup(packageDir);
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        console.error(`\u26a0\ufe0f  ${err.message}`);
      } else {
        console.error(`Failed to install ${name}: ${err.message}`);
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
