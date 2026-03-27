const path = require('path');
const manifest = require('../manifest');
const { skillsDir } = require('../paths');

module.exports = function list() {
  const data = manifest.read();
  const entries = Object.entries(data);

  if (entries.length === 0) {
    console.log('No skills installed. Run "skillpack install <name>" to get started.');
    return;
  }

  for (const [name, info] of entries) {
    const dir = path.join(skillsDir, name);
    console.log(`${name}@${info.version}\t${dir}`);
  }
};
