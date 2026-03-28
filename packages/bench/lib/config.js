'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ConfigValidationError extends Error {
  constructor(errors) {
    super(`bench.yaml invalid:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

class ConfigNotFoundError extends Error {
  constructor(filePath) {
    super(`bench.yaml not found: ${filePath}\n  Run: skillpack bench init`);
    this.name = 'ConfigNotFoundError';
  }
}

const VALID_ASSERTION_TYPES = ['contains', 'llm-judge'];

const DEFAULTS = {
  runs: 1,
  cost_cap_usd: 5.0,
  concurrency: 5,
};

function load(configPath) {
  const absPath = path.resolve(configPath || 'bench.yaml');

  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new ConfigNotFoundError(absPath);
    throw err;
  }

  // Strip UTF-8 BOM
  raw = raw.replace(/^\uFEFF/, '');

  let doc;
  try {
    doc = yaml.load(raw, { schema: yaml.DEFAULT_SCHEMA });
  } catch (err) {
    if (err.mark) {
      throw new ConfigValidationError([
        `YAML syntax error at line ${err.mark.line + 1}: ${err.reason}`,
      ]);
    }
    throw err;
  }

  return validate(doc, path.dirname(absPath));
}

function validate(doc, baseDir) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    throw new ConfigValidationError(['bench.yaml is empty or not an object']);
  }

  if (!doc.model || typeof doc.model !== 'string') {
    errors.push('missing or invalid: model (string required)');
  }

  if (!doc.skill_path || typeof doc.skill_path !== 'string') {
    errors.push('missing or invalid: skill_path (string required)');
  }

  if (!Array.isArray(doc.tasks) || doc.tasks.length === 0) {
    errors.push('missing or empty: tasks (at least one task required)');
  }

  if (errors.length > 0) throw new ConfigValidationError(errors);

  // Resolve skill_path relative to bench.yaml location
  const skillPath = path.resolve(baseDir, doc.skill_path);
  if (!fs.existsSync(skillPath)) {
    throw new ConfigValidationError([
      `skill_path not found: ${doc.skill_path} (resolved: ${skillPath})`,
    ]);
  }

  const skillContent = fs.readFileSync(skillPath, 'utf8');
  if (skillContent.trim().length === 0) {
    process.stderr.write(`\u26a0 skill_path is empty (0 bytes): ${skillPath}\n`);
  }

  // Validate runs
  const runs = doc.runs ?? DEFAULTS.runs;
  if (typeof runs !== 'number' || runs < 1 || !Number.isInteger(runs)) {
    throw new ConfigValidationError(['runs must be a positive integer (>= 1)']);
  }

  // Validate cost_cap_usd
  const costCap = doc.cost_cap_usd ?? DEFAULTS.cost_cap_usd;
  if (typeof costCap !== 'number' || costCap < 0) {
    throw new ConfigValidationError(['cost_cap_usd must be a non-negative number']);
  }
  if (costCap === 0) {
    throw new ConfigValidationError([
      'cost_cap_usd is 0 — no API calls can be made. Set a positive value.',
    ]);
  }

  // Validate tasks
  const taskNames = new Set();
  doc.tasks.forEach((task, i) => {
    const prefix = `tasks[${i}]`;
    if (!task.name || typeof task.name !== 'string') {
      errors.push(`${prefix}: missing or invalid name`);
    } else if (taskNames.has(task.name)) {
      errors.push(`${prefix}: duplicate task name "${task.name}"`);
    } else {
      taskNames.add(task.name);
    }

    if (!task.user || typeof task.user !== 'string') {
      errors.push(`${prefix}: missing or invalid user prompt`);
    }

    if (task.context_files && Array.isArray(task.context_files)) {
      for (const cf of task.context_files) {
        const cfPath = path.resolve(baseDir, cf);
        if (!fs.existsSync(cfPath)) {
          errors.push(`${prefix}: context_file not found: ${cf}`);
        } else {
          const stat = fs.statSync(cfPath);
          if (stat.size > 1024 * 1024) {
            errors.push(`${prefix}: context_file exceeds 1MB: ${cf} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
          }
        }
      }
    }

    if (task.assertions && Array.isArray(task.assertions)) {
      task.assertions.forEach((a, j) => {
        if (!VALID_ASSERTION_TYPES.includes(a.type)) {
          errors.push(`${prefix}.assertions[${j}]: unknown type "${a.type}" (valid: ${VALID_ASSERTION_TYPES.join(', ')})`);
        }
        if (a.type === 'contains' && (!a.value || typeof a.value !== 'string')) {
          errors.push(`${prefix}.assertions[${j}]: "contains" requires a string value`);
        }
        if (a.type === 'llm-judge' && (!a.rubric || typeof a.rubric !== 'string')) {
          errors.push(`${prefix}.assertions[${j}]: "llm-judge" requires a string rubric`);
        }
      });
    }
  });

  if (errors.length > 0) throw new ConfigValidationError(errors);

  // Build resolved config
  const concurrency = doc.concurrency ?? DEFAULTS.concurrency;

  return {
    model: doc.model,
    skill_path: skillPath,
    skill_content: skillContent,
    runs,
    cost_cap_usd: costCap,
    concurrency,
    judge: doc.judge || {},
    tasks: doc.tasks.map(t => ({
      name: t.name,
      user: t.user,
      system: t.system || null,
      context_files: (t.context_files || []).map(cf => ({
        path: path.resolve(baseDir, cf),
        content: fs.readFileSync(path.resolve(baseDir, cf), 'utf8'),
      })),
      assertions: t.assertions || [],
    })),
  };
}

module.exports = { load, validate, ConfigValidationError, ConfigNotFoundError, DEFAULTS };
