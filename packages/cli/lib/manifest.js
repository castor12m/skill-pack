const fs = require('fs');
const { manifestDir, manifestFile } = require('./paths');

function read() {
  if (!fs.existsSync(manifestFile)) return {};
  const raw = fs.readFileSync(manifestFile, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`Warning: manifest.json is corrupted and could not be parsed. Returning empty state.`);
    console.error(`Run \`skillpack list\` to verify your installed skills.`);
    return {};
  }
}

function write(data) {
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(data, null, 2) + '\n');
}

function get(skillName) {
  const m = read();
  return m[skillName] || null;
}

function set(skillName, version, checksums, source) {
  const m = read();
  m[skillName] = {
    version,
    installedAt: new Date().toISOString(),
    checksums: checksums || {},
  };
  if (source) m[skillName].source = source;
  write(m);
}

function remove(skillName) {
  const m = read();
  delete m[skillName];
  write(m);
}

module.exports = { read, get, set, remove };
