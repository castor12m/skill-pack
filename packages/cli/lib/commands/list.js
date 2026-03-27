const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const { skillsDir } = require('../paths');
const { getModifiedFiles } = require('../installer');

const color = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  white: (s) => `\x1b[37m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  orange: (s) => `\x1b[38;5;208m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Extract scope from source package name if it's not @skillpack.
 * @skillpack/skill-xxx → null (public, no extra display)
 * @castor12m/skill-xxx → '@castor12m'
 */
function getScope(source) {
  if (!source || !source.startsWith('@')) return null;
  const scope = source.split('/')[0];
  if (scope === '@skillpack') return null;
  return scope;
}

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

  const maxName = Math.max(...entries.map(([n, i]) => `${n}@${i.version}`.length));

  for (const [name, info] of entries) {
    const label = `${name}@${info.version}`;
    const modified = getModifiedFiles(name, info.checksums);
    const status = modified.length > 0 ? color.yellow(' [modified]') : '';
    const scope = getScope(info.source);
    const scopeTag = scope ? ' ' + color.orange(scope) : '';
    const dir = path.join(skillsDir, name);
    console.log(`${label.padEnd(maxName + 2)} ${color.green('[managed]')}${scopeTag}${status}  ${color.dim(dir)}`);
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

  const maxName = Math.max(...dirs.map(n => {
    const info = managed[n];
    return info ? `${n}@${info.version}`.length : n.length;
  }));

  for (const name of dirs) {
    const info = managed[name];
    const label = info ? `${name}@${info.version}` : name;

    let tag, status = '', scopeTag = '';
    if (info) {
      tag = color.green('[managed]');
      const modified = getModifiedFiles(name, info.checksums);
      if (modified.length > 0) {
        status = color.yellow(' [modified]');
      }
      const scope = getScope(info.source);
      if (scope) scopeTag = ' ' + color.orange(scope);
    } else {
      tag = color.white('[local]');
    }

    console.log(`${label.padEnd(maxName + 2)} ${tag}${scopeTag}${status}  ${color.dim(path.join(skillsDir, name))}`);
  }

  const managedCount = dirs.filter(n => managed[n]).length;
  const localCount = dirs.length - managedCount;
  console.log(`\n${dirs.length} skills total (${managedCount} managed, ${localCount} local)`);
}
