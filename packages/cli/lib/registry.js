const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Resolve a skill name to a full npm package name.
 * - Starts with @ → use as-is (e.g. @mycompany/skill-xxx)
 * - Otherwise → @skillpack/skill-{name}
 */
function resolvePackageName(name) {
  if (name.startsWith('@')) return name;
  return `@skillpack/skill-${name}`;
}

/**
 * Get package info from npm registry.
 * Returns { version, tarball } or null if not found.
 */
function viewPackage(packageName, version) {
  const spec = version ? `${packageName}@${version}` : packageName;
  try {
    const json = execSync(`npm view ${spec} --json 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const info = JSON.parse(json);
    return {
      version: info.version,
      tarball: info.dist && info.dist.tarball,
    };
  } catch {
    return null;
  }
}

/**
 * Download and extract a tarball to a temp directory.
 * Returns the extracted directory path.
 */
function downloadAndExtract(packageName, version) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillpack-'));
  const spec = version ? `${packageName}@${version}` : packageName;
  try {
    execSync(`npm pack ${spec} --pack-destination ${tmpDir}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const tgzFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) {
      throw new Error(`Failed to download ${spec}`);
    }
    const tgzPath = path.join(tmpDir, tgzFiles[0]);
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir);
    execSync(`tar -xzf ${tgzPath} -C ${extractDir}`, { stdio: 'pipe' });
    // npm pack extracts to a 'package/' subdirectory
    return path.join(extractDir, 'package');
  } catch (err) {
    // Clean up on failure
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Clean up a temp directory created by downloadAndExtract.
 */
function cleanup(packageDir) {
  // packageDir is like /tmp/skillpack-xxx/extracted/package
  // We want to remove /tmp/skillpack-xxx/
  const tmpDir = path.resolve(packageDir, '..', '..');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

module.exports = { resolvePackageName, viewPackage, downloadAndExtract, cleanup };
