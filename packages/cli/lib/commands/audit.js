'use strict';

const manifest = require('../manifest');
const { resolvePackageName, viewPackage } = require('../registry');
const { getModifiedFiles } = require('../installer');

/**
 * skillpack audit [--json] [--offline]
 * Check installed skills for local modifications and outdated versions.
 */
module.exports = function audit(args) {
  const jsonMode = args.includes('--json');
  const offline = args.includes('--offline');

  const data = manifest.read();
  const skillNames = Object.keys(data);

  if (skillNames.length === 0) {
    if (jsonMode) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), skills: [], summary: { total: 0, clean: 0, modified: 0, outdated: 0 } }));
    } else {
      console.log('No skills installed. Nothing to audit.');
    }
    return;
  }

  const results = [];
  let clean = 0;
  let modified = 0;
  let outdated = 0;

  for (const name of skillNames.sort()) {
    const entry = data[name];
    const modifiedFiles = getModifiedFiles(name, entry.checksums);

    let status = 'clean';
    let latest = null;

    if (modifiedFiles.length > 0) {
      status = 'modified';
      modified++;
    }

    // Check for newer version (skip in offline mode)
    if (!offline && entry.source) {
      const packageName = entry.source.startsWith('@')
        ? entry.source
        : resolvePackageName(name);
      const info = viewPackage(packageName);
      if (info && info.version !== entry.version) {
        latest = info.version;
        if (status === 'clean') {
          status = 'outdated';
          outdated++;
        } else {
          // modified + outdated
          status = 'modified+outdated';
        }
      }
    }

    if (status === 'clean') clean++;

    results.push({
      name,
      version: entry.version,
      status,
      modified: modifiedFiles,
      latest,
    });
  }

  const summary = { total: skillNames.length, clean, modified, outdated };

  if (jsonMode) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      skills: results,
      summary,
    }, null, 2));
  } else {
    console.log(`\nSkillPack Audit Report`);
    console.log('\u2501'.repeat(50));

    // Column widths
    const maxName = Math.max(5, ...results.map(r => r.name.length));
    const maxVer = Math.max(7, ...results.map(r => r.version.length));

    console.log(
      `${'Skill'.padEnd(maxName + 2)}${'Version'.padEnd(maxVer + 2)}Status          Modified Files`
    );

    for (const r of results) {
      const statusIcon = r.status === 'clean' ? '\u2713 clean'
        : r.status === 'modified' ? '\u26a0 modified'
        : r.status === 'outdated' ? '\u2717 outdated'
        : '\u26a0 modified+outdated';

      const modifiedStr = r.modified.length > 0
        ? r.modified.join(', ')
        : r.latest ? `(latest: ${r.latest})` : '\u2014';

      console.log(
        `${r.name.padEnd(maxName + 2)}${r.version.padEnd(maxVer + 2)}${statusIcon.padEnd(16)}${modifiedStr}`
      );
    }

    console.log(`\nSummary: ${summary.total} skills, ${summary.clean} clean, ${summary.modified} modified, ${summary.outdated} outdated`);
  }

  // Exit code 1 if any issues found (for CI)
  if (modified > 0 || outdated > 0) {
    process.exitCode = 1;
  }
};
