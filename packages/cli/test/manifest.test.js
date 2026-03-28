'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We need to test manifest with a temp directory. Override paths module.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'skillpack-manifest-test-'));
const manifestDir = path.join(tmpHome, '.skillpack');
const manifestFile = path.join(manifestDir, 'manifest.json');

// Patch paths before requiring manifest
const pathsModule = require('../lib/paths');
const origManifestDir = pathsModule.manifestDir;
const origManifestFile = pathsModule.manifestFile;
pathsModule.manifestDir = manifestDir;
pathsModule.manifestFile = manifestFile;

const manifest = require('../lib/manifest');

describe('manifest', () => {
  beforeEach(() => {
    // Clean manifest before each test
    if (fs.existsSync(manifestFile)) fs.unlinkSync(manifestFile);
    if (fs.existsSync(manifestDir)) fs.rmSync(manifestDir, { recursive: true });
  });

  after(() => {
    // Restore original paths
    pathsModule.manifestDir = origManifestDir;
    pathsModule.manifestFile = origManifestFile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns empty object when manifest does not exist', () => {
      const result = manifest.read();
      assert.deepEqual(result, {});
    });

    it('reads valid manifest', () => {
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(manifestFile, JSON.stringify({ review: { version: '1.0.0' } }));
      const result = manifest.read();
      assert.equal(result.review.version, '1.0.0');
    });

    it('returns empty object for corrupted manifest', () => {
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(manifestFile, 'not json{{{');
      const result = manifest.read();
      assert.deepEqual(result, {});
    });
  });

  describe('get', () => {
    it('returns null for missing skill', () => {
      assert.equal(manifest.get('nonexistent'), null);
    });

    it('returns skill entry when exists', () => {
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(manifestFile, JSON.stringify({
        review: { version: '1.0.0', installedAt: '2026-01-01' },
      }));
      const result = manifest.get('review');
      assert.equal(result.version, '1.0.0');
    });
  });

  describe('set', () => {
    it('creates manifest dir and file', () => {
      manifest.set('review', '1.0.0', { 'SKILL.md': 'abc123' });
      assert.ok(fs.existsSync(manifestFile));
      const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.equal(data.review.version, '1.0.0');
      assert.equal(data.review.checksums['SKILL.md'], 'abc123');
      assert.ok(data.review.installedAt);
    });

    it('stores source when provided', () => {
      manifest.set('review', '1.0.0', {}, '@skillpack/skill-review');
      const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.equal(data.review.source, '@skillpack/skill-review');
    });

    it('preserves other skills when adding', () => {
      manifest.set('review', '1.0.0', {});
      manifest.set('debug', '1.0.0', {});
      const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.ok(data.review);
      assert.ok(data.debug);
    });
  });

  describe('remove', () => {
    it('removes a skill entry', () => {
      manifest.set('review', '1.0.0', {});
      manifest.set('debug', '1.0.0', {});
      manifest.remove('review');
      const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.equal(data.review, undefined);
      assert.ok(data.debug);
    });

    it('handles removing nonexistent skill gracefully', () => {
      manifest.set('review', '1.0.0', {});
      manifest.remove('nonexistent');
      const data = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.ok(data.review);
    });
  });
});
