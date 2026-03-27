const fs = require('fs');
const path = require('path');

module.exports = function init(args) {
  // Parse --scope <scope>
  let scope = '@skillpack';
  const scopeIdx = args.indexOf('--scope');
  if (scopeIdx !== -1) {
    if (!args[scopeIdx + 1] || args[scopeIdx + 1].startsWith('--')) {
      console.error('Error: --scope requires a value (e.g. --scope @mycompany)');
      process.exitCode = 1;
      return;
    }
    scope = args[scopeIdx + 1];
  }

  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    if (i > 0 && args[i - 1] === '--scope') return false;
    return true;
  });

  const name = positional[0];

  if (!name) {
    console.error('Usage: skillpack init <name> [--scope <scope>]');
    process.exitCode = 1;
    return;
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error(`Error: invalid skill name "${name}". Use lowercase letters, numbers, and hyphens only (must start with a letter or digit).`);
    process.exitCode = 1;
    return;
  }

  const dirName = `skill-${name}`;
  const targetDir = path.join(process.cwd(), 'packages', dirName);

  if (fs.existsSync(targetDir)) {
    console.error(`Error: directory already exists: ${targetDir}`);
    process.exitCode = 1;
    return;
  }

  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  const packageName = `${scope}/skill-${name}`;

  const skillJson = JSON.stringify({
    name,
    command: `/${name}`,
    entry: 'SKILL.md',
    files: ['SKILL.md'],
  }, null, 2);

  const packageJson = JSON.stringify({
    name: packageName,
    version: '1.0.0',
    description: `${name} skill for Claude Code`,
    keywords: [
      'claude-code',
      'claude-code-skills',
      'skill',
      'skillpack',
      name,
      'ai-coding-assistant',
      'ai-developer-tools',
      'slash-commands',
    ],
    license: 'MIT',
    engines: { node: '>=18' },
    files: ['skill.json', 'SKILL.md'],
  }, null, 2);

  const skillMd = `---
name: ${name}
description: "${name} skill for Claude Code"
argument-hint: [arguments]
---

# ${capitalizedName} Skill

## Instructions

Describe what this skill does and how the AI assistant should behave.

## Arguments

$ARGUMENTS
`;

  const readmeMd = `# ${packageName}

${name} skill for Claude Code.

## Install

\`\`\`bash
skillpack install ${packageName}
\`\`\`

## Usage

In Claude Code:

\`\`\`
/${name}
\`\`\`

## Part of [SkillPack](https://github.com/castor12m/skill-pack)
`;

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'skill.json'), skillJson + '\n');
  fs.writeFileSync(path.join(targetDir, 'package.json'), packageJson + '\n');
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd);
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeMd);

  console.log(`\u2705 Created ${packageName} at ${targetDir}`);
  console.log('');
  console.log('  packages/' + dirName + '/');
  console.log('  \u251c\u2500\u2500 package.json');
  console.log('  \u251c\u2500\u2500 skill.json');
  console.log('  \u251c\u2500\u2500 SKILL.md');
  console.log('  \u2514\u2500\u2500 README.md');
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Edit SKILL.md to define your skill's behavior`);
  console.log(`  2. Test locally: skillpack install ./packages/${dirName}`);
  console.log(`  3. Publish:      cd packages/${dirName} && npm publish`);
};
