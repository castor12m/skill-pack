const fs = require('fs');
const path = require('path');
const { skillsDir } = require('./paths');

/**
 * Read skill.json from an extracted package directory.
 */
function readSkillJson(packageDir) {
  const skillJsonPath = path.join(packageDir, 'skill.json');
  if (!fs.existsSync(skillJsonPath)) {
    throw new Error(`skill.json not found in package. Is this a valid SkillPack skill?`);
  }
  return JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
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

module.exports = { readSkillJson, installFiles, uninstallFiles, ConflictError };
