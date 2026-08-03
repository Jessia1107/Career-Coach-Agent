const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  createDefaultSession,
  loadSession,
  saveSession,
  applySessionInputs,
  getSessionPaths,
} = require('../career_agent/state');
const { extractFirstJsonValue } = require('../career_agent/json');

test('createDefaultSession creates the expected agent state shape', () => {
  const session = createDefaultSession('demo');

  assert.equal(session.id, 'demo');
  assert.equal(session.language, 'zh');
  assert.equal(session.inputs.careerGoal, '');
  assert.deepEqual(session.inputs.workExperiences, []);
  assert.deepEqual(session.artifacts.resumeBullets, []);
  assert.deepEqual(session.conversation, []);
});

test('saveSession and loadSession round-trip a local session file', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-state-'));
  const session = createDefaultSession('roundtrip');
  session.inputs.targetJobDescription = 'Quant role using SQL and Python';

  await saveSession(session, { rootDir });
  const loaded = await loadSession('roundtrip', { rootDir });

  assert.equal(loaded.id, 'roundtrip');
  assert.equal(loaded.inputs.targetJobDescription, 'Quant role using SQL and Python');
});

test('applySessionInputs merges jd, resume, and work experience without dropping existing fields', () => {
  const session = createDefaultSession('merge');
  session.artifacts.branding = { elevatorPitch: 'existing' };

  const updated = applySessionInputs(session, {
    targetJobDescription: 'New JD',
    resumeText: 'Resume text',
    workExperience: 'Built reporting automation',
  });

  assert.equal(updated.inputs.targetJobDescription, 'New JD');
  assert.equal(updated.inputs.resumeText, 'Resume text');
  assert.deepEqual(updated.inputs.workExperiences, ['Built reporting automation']);
  assert.equal(updated.artifacts.branding.elevatorPitch, 'existing');
});

test('applySessionInputs stores career goal separately from profile inputs', () => {
  const session = createDefaultSession('goal');

  const updated = applySessionInputs(session, {
    careerGoal: 'Move into quantitative model risk data science.',
  });

  assert.equal(updated.inputs.careerGoal, 'Move into quantitative model risk data science.');
  assert.equal(updated.inputs.resumeText, '');
  assert.deepEqual(updated.inputs.workExperiences, []);
});

test('getSessionPaths resolves session and output files under the local root', () => {
  const paths = getSessionPaths('abc', { rootDir: '/tmp/career-agent-root' });

  assert.equal(paths.sessionFile, '/tmp/career-agent-root/sessions/abc.json');
  assert.equal(paths.outputFile, '/tmp/career-agent-root/outputs/abc.md');
});

test('extractFirstJsonValue extracts fenced arrays and objects from provider output', () => {
  assert.equal(
    extractFirstJsonValue('text\n```json\n[{"title":"A"}]\n```'),
    '[{"title":"A"}]'
  );
  assert.equal(
    extractFirstJsonValue('prefix {"ok": true} suffix'),
    '{"ok": true}'
  );
});
