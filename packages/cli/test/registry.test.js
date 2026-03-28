'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { resolvePackageName, parseGitHubUrl } = require('../lib/registry');

describe('resolvePackageName', () => {
  it('adds @skillpack/skill- prefix for simple names', () => {
    assert.equal(resolvePackageName('review'), '@skillpack/skill-review');
    assert.equal(resolvePackageName('sdd'), '@skillpack/skill-sdd');
  });

  it('keeps scoped names as-is', () => {
    assert.equal(resolvePackageName('@mycompany/skill-internal'), '@mycompany/skill-internal');
    assert.equal(resolvePackageName('@foo/bar'), '@foo/bar');
  });
});

describe('parseGitHubUrl', () => {
  it('parses basic github:owner/repo', () => {
    const r = parseGitHubUrl('github:castor12m/skill-pack');
    assert.equal(r.owner, 'castor12m');
    assert.equal(r.repo, 'skill-pack');
    assert.equal(r.ref, 'HEAD');
    assert.equal(r.subpath, null);
  });

  it('parses github:owner/repo@ref', () => {
    const r = parseGitHubUrl('github:castor12m/skill-pack@v1.0.0');
    assert.equal(r.owner, 'castor12m');
    assert.equal(r.repo, 'skill-pack');
    assert.equal(r.ref, 'v1.0.0');
    assert.equal(r.subpath, null);
  });

  it('parses github:owner/repo/path', () => {
    const r = parseGitHubUrl('github:castor12m/skill-pack/packages/skill-review');
    assert.equal(r.owner, 'castor12m');
    assert.equal(r.repo, 'skill-pack');
    assert.equal(r.ref, 'HEAD');
    assert.equal(r.subpath, 'packages/skill-review');
  });

  it('parses github:owner/repo@ref/path', () => {
    const r = parseGitHubUrl('github:castor12m/skill-pack@main/packages/skill-review');
    assert.equal(r.owner, 'castor12m');
    assert.equal(r.repo, 'skill-pack');
    assert.equal(r.ref, 'main');
    assert.equal(r.subpath, 'packages/skill-review');
  });

  it('returns null for non-github URLs', () => {
    assert.equal(parseGitHubUrl('review'), null);
    assert.equal(parseGitHubUrl('@scope/skill-review'), null);
    assert.equal(parseGitHubUrl('./local/path'), null);
  });

  it('returns null for incomplete github URL', () => {
    assert.equal(parseGitHubUrl('github:onlyowner'), null);
  });
});
