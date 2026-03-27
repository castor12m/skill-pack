const manifest = require('../manifest');
const { resolvePackageName, viewPackage, downloadAndExtract, cleanup } = require('../registry');
const { readSkillJson, installFiles } = require('../installer');

module.exports = function update(args) {
  const names = args.filter(a => !a.startsWith('--'));
  const data = manifest.read();

  // If no specific name, update all
  const toUpdate = names.length > 0 ? names : Object.keys(data);

  if (toUpdate.length === 0) {
    console.log('No skills installed. Nothing to update.');
    return;
  }

  for (const skillName of toUpdate) {
    const existing = data[skillName];
    if (!existing) {
      console.error(`"${skillName}" is not installed. Use "skillpack install ${skillName}" first.`);
      process.exitCode = 1;
      continue;
    }

    const packageName = resolvePackageName(skillName);

    try {
      const info = viewPackage(packageName);
      if (!info) {
        console.error(`Package not found: ${packageName}`);
        process.exitCode = 1;
        continue;
      }

      if (info.version === existing.version) {
        console.log(`${skillName}@${existing.version} is already up to date.`);
        continue;
      }

      const packageDir = downloadAndExtract(packageName);

      try {
        const skillJson = readSkillJson(packageDir);
        installFiles(packageDir, skillJson, { force: true });
        manifest.set(skillJson.name, info.version);
        console.log(`\u2705 ${skillName} ${existing.version} \u2192 ${info.version}`);
      } finally {
        cleanup(packageDir);
      }
    } catch (err) {
      console.error(`Failed to update ${skillName}: ${err.message}`);
      process.exitCode = 1;
    }
  }
};
