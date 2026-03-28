'use strict';

const { execSync } = require('child_process');

module.exports = function search(args) {
  const query = args.filter(a => !a.startsWith('--')).join(' ');

  try {
    let results = [];

    // Search using keywords:skillpack for accurate results
    const searchTerm = query
      ? `keywords:skillpack ${query}`
      : 'keywords:skillpack';

    try {
      const output = execSync(
        `npm search ${searchTerm} --json --searchlimit 50`,
        { encoding: 'utf8', timeout: 15000 }
      );
      results = JSON.parse(output);
    } catch (e) {
      if (e.killed || e.signal === 'SIGTERM') {
        console.error('Search timed out. Check your network connection.');
      } else {
        console.error('Search failed. Check your network connection.');
      }
      console.log('Browse manually: https://www.npmjs.com/search?q=keywords:skillpack');
      process.exitCode = 1;
      return;
    }

    // Filter out the CLI itself, keep only skill packages
    results = results.filter(r =>
      r.name !== '@skillpack/cli' &&
      (r.keywords || []).some(k => ['skillpack', 'claude-code-skills'].includes(k))
    );

    if (results.length === 0) {
      console.log('No skills found.' + (query ? ' Try a different search term.' : ''));
      console.log('Browse all skills: https://www.npmjs.com/search?q=keywords:skillpack');
      return;
    }

    // Display
    const maxName = Math.max(...results.map(r => r.name.length));
    const maxVer = Math.max(...results.map(r => (r.version || '').length));

    console.log(`Found ${results.length} skill(s):\n`);
    for (const r of results) {
      const name = r.name.padEnd(maxName + 2);
      const ver = ('\x1b[2m' + (r.version || '').padEnd(maxVer + 2) + '\x1b[0m');
      const desc = r.description || '';
      console.log(`  ${name} ${ver} ${desc}`);
    }

    console.log('\nInstall: skillpack install <name>');
  } catch (err) {
    console.error(`Search failed: ${err.message}`);
    console.log('Browse manually: https://www.npmjs.com/search?q=keywords:skillpack');
    process.exitCode = 1;
  }
};
