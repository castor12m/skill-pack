'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { load, ConfigValidationError, ConfigNotFoundError } = require('../lib/config');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bench-test-'));
}

function writeYaml(dir, content) {
  fs.writeFileSync(path.join(dir, 'bench.yaml'), content, 'utf8');
}

function writeSkill(dir, content = '# Test Skill\nDo stuff.') {
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
}

describe('config.load', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses valid bench.yaml', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: test-task
    user: "Hello"
    assertions:
      - type: contains
        value: "world"
`);
    const config = load(path.join(tmpDir, 'bench.yaml'));
    assert.equal(config.model, 'claude-sonnet-4-20250514');
    assert.equal(config.tasks.length, 1);
    assert.equal(config.tasks[0].name, 'test-task');
    assert.equal(config.runs, 1);
    assert.equal(config.cost_cap_usd, 5.0);
  });

  it('applies defaults for optional fields', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "test"
`);
    const config = load(path.join(tmpDir, 'bench.yaml'));
    assert.equal(config.runs, 1);
    assert.equal(config.cost_cap_usd, 5.0);
    assert.equal(config.concurrency, 5);
  });

  it('throws ConfigNotFoundError for missing file', () => {
    assert.throws(
      () => load(path.join(tmpDir, 'nope.yaml')),
      err => err instanceof ConfigNotFoundError
    );
  });

  it('throws ConfigValidationError for malformed YAML', () => {
    writeYaml(tmpDir, '{{bad yaml');
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError
    );
  });

  it('throws for missing model', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "test"
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('model'))
    );
  });

  it('throws for empty tasks', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks: []
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('tasks'))
    );
  });

  it('throws for duplicate task names', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: dup
    user: "a"
  - name: dup
    user: "b"
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('duplicate'))
    );
  });

  it('throws for missing skill_path file', () => {
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./MISSING.md
tasks:
  - name: t1
    user: "test"
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('skill_path'))
    );
  });

  it('throws for cost_cap_usd of 0', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
cost_cap_usd: 0
tasks:
  - name: t1
    user: "test"
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('cost_cap_usd'))
    );
  });

  it('throws for runs < 1', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
runs: 0
tasks:
  - name: t1
    user: "test"
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError
    );
  });

  it('throws for unknown assertion type', () => {
    writeSkill(tmpDir);
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "test"
    assertions:
      - type: unknown-type
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('unknown'))
    );
  });

  it('strips UTF-8 BOM', () => {
    writeSkill(tmpDir);
    const yaml = `\uFEFF
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "test"
`;
    fs.writeFileSync(path.join(tmpDir, 'bench.yaml'), yaml, 'utf8');
    const config = load(path.join(tmpDir, 'bench.yaml'));
    assert.equal(config.model, 'claude-sonnet-4-20250514');
  });

  it('resolves context_files relative to bench.yaml', () => {
    writeSkill(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'fixtures'));
    fs.writeFileSync(path.join(tmpDir, 'fixtures', 'code.py'), 'print("hello")', 'utf8');
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "review"
    context_files:
      - fixtures/code.py
`);
    const config = load(path.join(tmpDir, 'bench.yaml'));
    assert.equal(config.tasks[0].context_files[0].content, 'print("hello")');
  });

  it('throws for context_file exceeding 1MB', () => {
    writeSkill(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'fixtures'));
    fs.writeFileSync(path.join(tmpDir, 'fixtures', 'huge.txt'), 'x'.repeat(1024 * 1025), 'utf8');
    writeYaml(tmpDir, `
model: claude-sonnet-4-20250514
skill_path: ./SKILL.md
tasks:
  - name: t1
    user: "review"
    context_files:
      - fixtures/huge.txt
`);
    assert.throws(
      () => load(path.join(tmpDir, 'bench.yaml')),
      err => err instanceof ConfigValidationError && err.errors.some(e => e.includes('1MB'))
    );
  });
});
