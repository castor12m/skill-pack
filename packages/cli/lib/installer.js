const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { skillsDir } = require('./paths');

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns { name, description } or null if no valid frontmatter.
 */
function parseSkillFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) frontmatter[key] = value;
  }
  return frontmatter.name ? frontmatter : null;
}

/**
 * Read skill.json from an extracted package directory.
 * Falls back to SKILL.md frontmatter (Agent Skills open standard) if skill.json is absent.
 */
function readSkillJson(packageDir) {
  const skillJsonPath = path.join(packageDir, 'skill.json');
  if (fs.existsSync(skillJsonPath)) {
    return JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
  }

  // Fallback: read from SKILL.md frontmatter (Agent Skills open standard)
  const skillMdPath = path.join(packageDir, 'SKILL.md');
  const frontmatter = parseSkillFrontmatter(skillMdPath);
  if (frontmatter) {
    // Collect all non-metadata files for installation
    const allFiles = fs.readdirSync(packageDir).filter(f =>
      !['package.json', 'node_modules', '.git', '.gitignore'].includes(f)
    );
    return {
      name: frontmatter.name,
      command: frontmatter.command || `/${frontmatter.name}`,
      entry: 'SKILL.md',
      files: allFiles,
    };
  }

  throw new Error(
    `No skill.json or SKILL.md with frontmatter found in package.\n` +
    `Expected either skill.json or a SKILL.md with Agent Skills frontmatter (name, description).`
  );
}

/**
 * Install skill files from extracted package to ~/.claude/skills/<name>/.
 * Returns the target directory path.
 */
function installFiles(packageDir, skillJson, { force = false } = {}) {
  const targetDir = path.join(skillsDir, skillJson.name);

  // Conflict check
  if (fs.existsSync(targetDir) && !force) {
    const existing = fs.readdirSync(targetDir);
    if (existing.length > 0) {
      throw new ConflictError(skillJson.name, targetDir);
    }
  }

  // Copy to temp first, then move (atomic-ish install)
  const tmpTarget = targetDir + '.installing';
  fs.rmSync(tmpTarget, { recursive: true, force: true });
  fs.mkdirSync(tmpTarget, { recursive: true });

  try {
    for (const file of skillJson.files) {
      const src = path.join(packageDir, file);
      const dest = path.join(tmpTarget, file);

      if (file.endsWith('/') || (fs.existsSync(src) && fs.statSync(src).isDirectory())) {
        // Directory: recursive copy
        fs.cpSync(src, dest, { recursive: true });
      } else {
        // File: ensure parent dir exists
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }

    // Atomic swap: remove old, rename temp to final
    if (force) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.renameSync(tmpTarget, targetDir);

    return targetDir;
  } catch (err) {
    // Rollback: clean up temp
    fs.rmSync(tmpTarget, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Remove installed skill files.
 */
function uninstallFiles(skillName) {
  const targetDir = path.join(skillsDir, skillName);
  if (!fs.existsSync(targetDir)) {
    return false;
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
  return true;
}

class ConflictError extends Error {
  constructor(skillName, targetDir) {
    super(
      `"${skillName}" is already installed at ${targetDir}\n` +
      `Use --force to overwrite.`
    );
    this.name = 'ConflictError';
    this.skillName = skillName;
  }
}

/**
 * Compute SHA-256 hash of a file.
 */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compute checksums for all installed skill files.
 * Returns { "SKILL.md": "abc123...", "help.md": "def456..." }
 */
function computeChecksums(skillJson) {
  const targetDir = path.join(skillsDir, skillJson.name);
  const checksums = {};

  for (const file of skillJson.files) {
    const filePath = path.join(targetDir, file);
    if (!fs.existsSync(filePath)) continue;

    if (fs.statSync(filePath).isDirectory()) {
      const entries = fs.readdirSync(filePath, { recursive: true });
      for (const entry of entries) {
        const fullPath = path.join(filePath, entry);
        if (fs.statSync(fullPath).isFile()) {
          const relPath = path.join(file, entry);
          checksums[relPath] = hashFile(fullPath);
        }
      }
    } else {
      checksums[file] = hashFile(filePath);
    }
  }

  return checksums;
}

/**
 * Check which files have been locally modified since installation.
 * Returns array of modified file names, empty if no modifications.
 */
function getModifiedFiles(skillName, savedChecksums) {
  if (!savedChecksums || Object.keys(savedChecksums).length === 0) return [];

  const targetDir = path.join(skillsDir, skillName);
  if (!fs.existsSync(targetDir)) return [];

  const modified = [];
  for (const [file, savedHash] of Object.entries(savedChecksums)) {
    const filePath = path.join(targetDir, file);
    if (!fs.existsSync(filePath)) {
      modified.push(file + ' (deleted)');
    } else {
      const currentHash = hashFile(filePath);
      if (currentHash !== savedHash) {
        modified.push(file);
      }
    }
  }
  return modified;
}

module.exports = {
  readSkillJson, parseSkillFrontmatter, installFiles, uninstallFiles, computeChecksums, getModifiedFiles, ConflictError,
};
