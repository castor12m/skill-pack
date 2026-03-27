const os = require('os');
const path = require('path');

const home = os.homedir();

module.exports = {
  skillsDir: path.join(home, '.claude', 'skills'),
  manifestDir: path.join(home, '.skillpack'),
  manifestFile: path.join(home, '.skillpack', 'manifest.json'),
};
