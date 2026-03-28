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
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const is404 = stderr.includes('E404') || stderr.includes('Not found') || stdout.includes('"error"');
    if (is404) {
      return null;
    }
    const is403 = stderr.includes('E403') || stderr.includes('Forbidden');
    if (is403) {
      console.error(`Access denied for ${spec}. For private packages, configure npm auth:`);
      console.error(`  npm config set //npm.pkg.github.com/:_authToken $(gh auth token)`);
      return null;
    }
    const isNetwork = stderr.includes('ETIMEDOUT') || stderr.includes('ENOTFOUND') || stderr.includes('EAI_AGAIN');
    if (isNetwork) {
      console.error(`Network error looking up ${spec}. Check your internet connection.`);
      return null;
    }
    console.error(`Failed to look up ${spec}: ${stderr || err.message}`);
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
  let tgzPath;
  try {
    execSync(`npm pack ${spec} --pack-destination ${tmpDir}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const tgzFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) {
      throw new Error(`Failed to download ${spec}`);
    }
    tgzPath = path.join(tmpDir, tgzFiles[0]);
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error(`Failed to download ${spec}. Check your network connection and npm registry access.`);
    throw err;
  }
  try {
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir);
    execSync(`tar -xzf ${tgzPath} -C ${extractDir}`, { stdio: 'pipe' });
    // npm pack extracts to a 'package/' subdirectory
    return path.join(extractDir, 'package');
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error(`Failed to extract ${spec}. The package may be corrupted. Try reinstalling.`);
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

/**
 * Parse a github: URL into components.
 * Formats: github:owner/repo, github:owner/repo@ref, github:owner/repo/path, github:owner/repo@ref/path
 * Returns { owner, repo, ref, subpath } or null.
 */
function parseGitHubUrl(raw) {
  if (!raw.startsWith('github:')) return null;
  let rest = raw.slice('github:'.length);

  // Extract ref (@tag or @branch)
  let ref = null;
  const atIdx = rest.indexOf('@');
  if (atIdx > 0) {
    const afterAt = rest.slice(atIdx + 1);
    const slashIdx = afterAt.indexOf('/');
    if (slashIdx > 0) {
      ref = afterAt.slice(0, slashIdx);
      rest = rest.slice(0, atIdx) + afterAt.slice(slashIdx);
    } else {
      ref = afterAt;
      rest = rest.slice(0, atIdx);
    }
  }

  // Split owner/repo/path
  const parts = rest.split('/');
  if (parts.length < 2) return null;

  return {
    owner: parts[0],
    repo: parts[1],
    ref: ref || 'HEAD',
    subpath: parts.length > 2 ? parts.slice(2).join('/') : null,
  };
}

/**
 * Get a GitHub auth token from environment or gh CLI.
 */
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Download and extract a GitHub repo tarball to a temp directory.
 * Returns the extracted directory path (optionally a subdirectory).
 */
function downloadFromGitHub(parsed) {
  const { owner, repo, ref, subpath } = parsed;
  const token = getGitHubToken();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillpack-gh-'));
  const tgzPath = path.join(tmpDir, 'repo.tar.gz');

  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
  const authHeader = token ? `-H "Authorization: token ${token}"` : '';

  try {
    execSync(`curl -sL ${authHeader} -o "${tgzPath}" "${url}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    if (!fs.existsSync(tgzPath) || fs.statSync(tgzPath).size === 0) {
      throw new Error(`Repository not found: ${owner}/${repo}${ref !== 'HEAD' ? '@' + ref : ''}`);
    }

    // Check for GitHub API error (JSON response instead of tarball)
    const head = fs.readFileSync(tgzPath, { encoding: 'utf8', flag: 'r' }).slice(0, 100);
    if (head.startsWith('{') && head.includes('"message"')) {
      const msg = JSON.parse(fs.readFileSync(tgzPath, 'utf8'));
      if (msg.message === 'Not Found') {
        throw new Error(`Repository not found: ${owner}/${repo}`);
      }
      if (msg.message && msg.message.includes('API rate limit')) {
        throw new Error(`GitHub API rate limit exceeded. Set GITHUB_TOKEN to authenticate.`);
      }
      throw new Error(`GitHub API error: ${msg.message}`);
    }

    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir);
    execSync(`tar -xzf "${tgzPath}" -C "${extractDir}"`, { stdio: 'pipe' });

    // GitHub tarballs extract to owner-repo-sha/ directory
    const dirs = fs.readdirSync(extractDir);
    if (dirs.length === 0) throw new Error('Failed to extract GitHub tarball');
    let resultDir = path.join(extractDir, dirs[0]);

    // Navigate to subpath if specified
    if (subpath) {
      resultDir = path.join(resultDir, subpath);
      if (!fs.existsSync(resultDir)) {
        throw new Error(`Path not found in repo: ${subpath}`);
      }
    }

    return resultDir;
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (err.message.includes('Repository not found') || err.message.includes('GitHub API')) {
      throw err;
    }
    if (!token) {
      throw new Error(
        `Failed to download ${owner}/${repo}. For private repos, set GITHUB_TOKEN:\n` +
        `  export GITHUB_TOKEN=$(gh auth token)`
      );
    }
    throw err;
  }
}

module.exports = { resolvePackageName, viewPackage, downloadAndExtract, cleanup, parseGitHubUrl, downloadFromGitHub };
