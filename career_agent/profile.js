const fs = require('node:fs/promises');
const path = require('node:path');

const PROFILE_FILES = [
  {
    template: 'candidate-profile.template.md',
    target: 'candidate-profile.md',
    label: 'Hard credentials: education, credentials, work history, skills',
  },
  {
    template: 'career-blueprint.template.md',
    target: 'career-blueprint.md',
    label: 'Direction, role tiers, hard constraints, anti-patterns, comp floor',
  },
  {
    template: 'resume-input.example.json',
    target: 'resume-input.json',
    label: 'Structured master resume used to generate tailored versions',
  },
];

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function templatesDir(options = {}) {
  return options.templatesDir || path.join(repoRoot(), 'setup', 'templates');
}

function profileDir(options = {}) {
  const rootDir = options.rootDir || path.join(process.cwd(), '.career-coach');
  return path.join(rootDir, 'profile');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Copy blank profile templates into .career-coach/profile/.
 * Never overwrites an existing file: profiles hold personal data that is
 * expensive to recreate, so an accidental `init` must be harmless.
 */
async function initProfile(options = {}) {
  const targetDir = profileDir(options);
  const sourceDir = templatesDir(options);
  const created = [];
  const skipped = [];

  await fs.mkdir(targetDir, { recursive: true });

  for (const file of PROFILE_FILES) {
    const targetPath = path.join(targetDir, file.target);

    if (await exists(targetPath)) {
      skipped.push({ ...file, path: targetPath });
      continue;
    }

    const contents = await fs.readFile(path.join(sourceDir, file.template), 'utf8');
    await fs.writeFile(targetPath, contents, 'utf8');
    created.push({ ...file, path: targetPath });
  }

  return { targetDir, created, skipped };
}

async function profileStatus(options = {}) {
  const targetDir = profileDir(options);
  const files = [];

  for (const file of PROFILE_FILES) {
    const targetPath = path.join(targetDir, file.target);
    const present = await exists(targetPath);
    let placeholders = 0;

    if (present) {
      const contents = await fs.readFile(targetPath, 'utf8');
      placeholders = (contents.match(/TBD|Your Name|<Your Name>/g) || []).length;
    }

    files.push({ ...file, path: targetPath, present, placeholders });
  }

  return { targetDir, files, complete: files.every((file) => file.present && file.placeholders === 0) };
}

function renderInitReport(result) {
  const lines = ['Career Coach profile scaffold', ''];

  for (const file of result.created) {
    lines.push(`  created  ${file.target}  — ${file.label}`);
  }
  for (const file of result.skipped) {
    lines.push(`  kept     ${file.target}  — already exists, left untouched`);
  }

  lines.push('');
  lines.push(`Location: ${result.targetDir}`);
  lines.push('');
  lines.push('Next step — let the agent fill these in for you. In your AI assistant, say:');
  lines.push('');
  lines.push('  Use the career-profile-builder skill to build my career profile.');
  lines.push('');
  lines.push('It runs a short structured interview and writes all three files.');
  lines.push('Prefer to type them yourself? See setup/ONBOARDING.md.');
  lines.push('');
  lines.push('These files hold personal data and are gitignored. Keep them that way.');

  return lines.join('\n');
}

function renderProfileStatus(status) {
  const lines = ['Profile files:'];

  for (const file of status.files) {
    if (!file.present) {
      lines.push(`  missing     ${file.target}  — run ./career-coach init`);
    } else if (file.placeholders > 0) {
      lines.push(`  incomplete  ${file.target}  — ${file.placeholders} placeholder(s) left`);
    } else {
      lines.push(`  ready       ${file.target}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  PROFILE_FILES,
  initProfile,
  profileDir,
  profileStatus,
  renderInitReport,
  renderProfileStatus,
};
