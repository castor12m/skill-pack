'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function init(args) {
  const force = args.includes('--force');
  const targetPath = path.resolve('bench.yaml');

  if (fs.existsSync(targetPath) && !force) {
    console.error(
      `\u2717 bench.yaml already exists. Use --force to overwrite.`
    );
    process.exitCode = 1;
    return;
  }

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'bench.yaml.tpl');
  const template = fs.readFileSync(templatePath, 'utf8');

  fs.writeFileSync(targetPath, template, 'utf8');
  console.log(`\u2713 Created bench.yaml`);
  console.log(`  Edit tasks and skill_path, then run: skillpack bench run`);
};
