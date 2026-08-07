const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  PROFILE_FILES,
  initProfile,
  profileStatus,
  renderInitReport,
  renderProfileStatus,
} = require('../career_agent/profile');

async function tempRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-coach-profile-'));
  return path.join(dir, '.career-coach');
}

test('init copies every template into .career-coach/profile', async () => {
  const rootDir = await tempRoot();
  const result = await initProfile({ rootDir });

  assert.equal(result.created.length, PROFILE_FILES.length);
  assert.equal(result.skipped.length, 0);

  for (const file of PROFILE_FILES) {
    const contents = await fs.readFile(path.join(result.targetDir, file.target), 'utf8');
    assert.ok(contents.length > 0, `${file.target} should not be empty`);
  }
});

test('init never overwrites an existing profile file', async () => {
  const rootDir = await tempRoot();
  const first = await initProfile({ rootDir });

  const targetPath = path.join(first.targetDir, 'candidate-profile.md');
  await fs.writeFile(targetPath, '# my real profile\n', 'utf8');

  const second = await initProfile({ rootDir });

  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, PROFILE_FILES.length);
  assert.equal(await fs.readFile(targetPath, 'utf8'), '# my real profile\n');
});

test('status reports missing files before init', async () => {
  const rootDir = await tempRoot();
  const status = await profileStatus({ rootDir });

  assert.equal(status.complete, false);
  assert.ok(status.files.every((file) => file.present === false));
  assert.match(renderProfileStatus(status), /missing/);
});

test('status flags freshly scaffolded templates as incomplete', async () => {
  const rootDir = await tempRoot();
  await initProfile({ rootDir });
  const status = await profileStatus({ rootDir });

  assert.equal(status.complete, false);
  assert.ok(status.files.every((file) => file.present));
  assert.ok(
    status.files.some((file) => file.placeholders > 0),
    'templates ship with TBD placeholders',
  );
  assert.match(renderProfileStatus(status), /incomplete/);
});

test('status reports ready once placeholders are gone', async () => {
  const rootDir = await tempRoot();
  const result = await initProfile({ rootDir });

  for (const file of PROFILE_FILES) {
    await fs.writeFile(path.join(result.targetDir, file.target), 'filled in\n', 'utf8');
  }

  const status = await profileStatus({ rootDir });
  assert.equal(status.complete, true);
  assert.match(renderProfileStatus(status), /ready/);
});

test('init report points at the profile builder skill', async () => {
  const rootDir = await tempRoot();
  const report = renderInitReport(await initProfile({ rootDir }));

  assert.match(report, /career-profile-builder/);
  assert.match(report, /gitignored/);
});

test('shipped templates contain no personal data', async () => {
  const templatesDir = path.resolve(__dirname, '..', 'setup', 'templates');
  const entries = await fs.readdir(templatesDir);

  for (const entry of entries) {
    const contents = await fs.readFile(path.join(templatesDir, entry), 'utf8');
    assert.doesNotMatch(contents, /jingyun|sunjingyun|\/Users\//i, `${entry} leaks personal data`);
  }
});
