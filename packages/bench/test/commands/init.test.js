'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('bench init', () => {
  let tmpDir;
  let origCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-init-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    process.exitCode = 0;
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = 0;
  });

  it('creates bench.yaml when not exists', () => {
    const init = require('../../lib/commands/init');
    init([]);
    assert.ok(fs.existsSync(path.join(tmpDir, 'bench.yaml')));
    const content = fs.readFileSync(path.join(tmpDir, 'bench.yaml'), 'utf8');
    assert.ok(content.includes('model:'));
    assert.ok(content.includes('tasks:'));
  });

  it('refuses to overwrite without --force', () => {
    fs.writeFileSync(path.join(tmpDir, 'bench.yaml'), 'existing', 'utf8');
    const init = require('../../lib/commands/init');
    init([]);
    assert.equal(process.exitCode, 1);
    // Content should be unchanged
    assert.equal(fs.readFileSync(path.join(tmpDir, 'bench.yaml'), 'utf8'), 'existing');
  });

  it('overwrites with --force', () => {
    fs.writeFileSync(path.join(tmpDir, 'bench.yaml'), 'old', 'utf8');
    const init = require('../../lib/commands/init');
    init(['--force']);
    const content = fs.readFileSync(path.join(tmpDir, 'bench.yaml'), 'utf8');
    assert.ok(content.includes('model:'));
    assert.notEqual(content, 'old');
  });

  it('scaffold contains required sections', () => {
    const init = require('../../lib/commands/init');
    init([]);
    const content = fs.readFileSync(path.join(tmpDir, 'bench.yaml'), 'utf8');
    assert.ok(content.includes('skill_path:'));
    assert.ok(content.includes('cost_cap_usd:'));
    assert.ok(content.includes('assertions:'));
  });
});
