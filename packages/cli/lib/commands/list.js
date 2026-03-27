const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const { skillsDir } = require('../paths');

module.exports = function list(args) {
  const showAll = args.includes('--all');

  if (showAll) {
    listAll();
  } else {
    listManaged();
  }
};

function listManaged() {
  const data = manifest.read();
  const entries = Object.entries(data);

  if (entries.length === 0) {
    console.log('No skills installed via skillpack. Run "skillpack install <name>" to get started.');
    console.log('Tip: use "skillpack list --all" to see all skills in ~/.claude/skills/');
    return;
  }

  for (const [name, info] of entries) {
    const dir = path.join(skillsDir, name);
    console.log(`${name}@${info.version}\t${dir}`);
  }
}

function listAll() {
  if (!fs.existsSync(skillsDir)) {
    console.log('No skills directory found at ' + skillsDir);
    return;
  }

  const managed = manifest.read();
  const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (dirs.length === 0) {
    console.log('No skills found in ' + skillsDir);
    return;
  }

  for (const name of dirs) {
    const info = managed[name];
    if (info) {
      console.log(`${name}@${info.version}\t[managed]\t${path.join(skillsDir, name)}`);
    } else {
      console.log(`${name}\t\t[local]\t\t${path.join(skillsDir, name)}`);
    }
  }

  const managedCount = dirs.filter(n => managed[n]).length;
  const localCount = dirs.length - managedCount;
  console.log(`\n${dirs.length} skills total (${managedCount} managed, ${localCount} local)`);
}
