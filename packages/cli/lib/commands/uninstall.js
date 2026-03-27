const manifest = require('../manifest');
const { uninstallFiles } = require('../installer');

module.exports = function uninstall(args) {
  const names = args.filter(a => !a.startsWith('--'));

  if (names.length === 0) {
    console.error('Usage: skillpack uninstall <name>');
    process.exitCode = 1;
    return;
  }

  for (const skillName of names) {
    const existing = manifest.get(skillName);
    if (!existing) {
      console.error(`"${skillName}" is not installed.`);
      process.exitCode = 1;
      continue;
    }

    const removed = uninstallFiles(skillName);
    if (removed) {
      manifest.remove(skillName);
      console.log(`\u2705 ${skillName}@${existing.version} uninstalled.`);
    } else {
      // Files already gone, just clean manifest
      manifest.remove(skillName);
      console.log(`${skillName} files not found, cleaned up manifest.`);
    }
  }
};
