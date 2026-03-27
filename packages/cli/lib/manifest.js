const fs = require('fs');
const { manifestDir, manifestFile } = require('./paths');

function read() {
  if (!fs.existsSync(manifestFile)) return {};
  return JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
}

function write(data) {
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(data, null, 2) + '\n');
}

function get(skillName) {
  const m = read();
  return m[skillName] || null;
}

function set(skillName, version) {
  const m = read();
  m[skillName] = { version, installedAt: new Date().toISOString() };
  write(m);
}

function remove(skillName) {
  const m = read();
  delete m[skillName];
  write(m);
}

module.exports = { read, get, set, remove };
