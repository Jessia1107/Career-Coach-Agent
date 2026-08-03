const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { main } = require('../career_agent/cli');
const { createJobRecord, saveTracker } = require('../career_agent/tracker');
const { createDefaultSession, saveSession } = require('../career_agent/state');

test('CLI status prints a compact session summary', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-status-'));
  const writes = [];

  const code = await main(['status', '--session', 'demo'], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
  });

  assert.equal(code, 0);
  assert.match(writes.join(''), /Session: demo/);
  assert.match(writes.join(''), /JD: missing/);
  assert.match(writes.join(''), /Artifacts: none/);
});

test('CLI ask routes a one-shot message and persists the reply', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-ask-'));
  const writes = [];

  const code = await main(['ask', 'generate interview prep', '--session', 'demo'], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
    provider: {
      name: 'test-provider',
      generate: async () => JSON.stringify({
        questions: [{ title: 'SQL window functions', type: 'technical', description: 'Explain ROW_NUMBER.' }],
      }),
    },
  });

  assert.equal(code, 0);
  assert.match(writes.join(''), /SQL window functions/);
});

test('CLI export writes a markdown artifact file', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-export-'));
  const writes = [];

  await main(['ask', 'generate branding', '--session', 'demo'], {
    rootDir,
    stdout: { write: () => {} },
    stderr: { write: () => {} },
    provider: {
      name: 'test-provider',
      generate: async () => JSON.stringify({ elevatorPitch: 'A focused career story.', stories: [] }),
    },
  });

  const code = await main(['export', '--session', 'demo'], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
  });

  assert.equal(code, 0);
  const match = writes.join('').match(/Exported: (.+\.md)/);
  assert.ok(match);
  const content = await fs.readFile(match[1], 'utf8');
  assert.match(content, /A focused career story/);
});

test('CLI judge-job reads a JD file and records the decision', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-judge-'));
  const jdFile = path.join(rootDir, 'jd.txt');
  await fs.writeFile(jdFile, 'Python model risk role with SQL.', 'utf8');
  const writes = [];

  const code = await main([
    'judge-job',
    '--company', 'Example Bank',
    '--role', 'Data Scientist',
    '--jd-file', jdFile,
    '--career-goal', 'Become a model risk data scientist.',
  ], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
    provider: {
      name: 'test-provider',
      generate: async () => JSON.stringify({ decision: 'apply_now', reason: 'Good alignment' }),
    },
  });

  assert.equal(code, 0);
  assert.match(writes.join(''), /Decision: apply_now/);
  const tracker = JSON.parse(await fs.readFile(path.join(rootDir, 'jobs', 'job_tracker.json'), 'utf8'));
  assert.equal(tracker.jobs[0].jdText, 'Python model risk role with SQL.');
});

test('CLI interview-review only needs tracker identity and transcript file', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-review-'));
  await saveTracker({
    version: 1,
    jobs: [createJobRecord({
      company: 'Example Bank',
      role: 'Data Scientist',
      jdText: 'Python model risk role.',
      status: 'interviewing',
      artifacts: { resumeText: 'Built model validation automation.' },
    })],
  }, { rootDir });
  const transcriptFile = path.join(rootDir, 'transcript.txt');
  await fs.writeFile(transcriptFile, 'Interviewer: Tell me about validation. Candidate: ...', 'utf8');
  const writes = [];

  const code = await main([
    'interview-review',
    '--company', 'Example Bank',
    '--role', 'Data Scientist',
    '--transcript-file', transcriptFile,
  ], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
    provider: {
      name: 'test-provider',
      generate: async () => JSON.stringify({ summary: 'Good validation answer.', nextActions: [] }),
    },
  });

  assert.equal(code, 0);
  assert.match(writes.join(''), /Good validation answer/);
  const tracker = JSON.parse(await fs.readFile(path.join(rootDir, 'jobs', 'job_tracker.json'), 'utf8'));
  assert.equal(tracker.jobs[0].status, 'interviewed');
  assert.match(tracker.jobs[0].artifacts.interviewTranscript, /Tell me about validation/);
});

test('CLI judge-job can load the stored career goal without repeating it', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-goal-'));
  const session = createDefaultSession('demo');
  session.inputs.careerGoal = 'Move into model risk data science.';
  await saveSession(session, { rootDir });
  const jdFile = path.join(rootDir, 'jd.txt');
  await fs.writeFile(jdFile, 'Python model risk role.', 'utf8');
  let prompt = '';

  const code = await main([
    'judge-job',
    '--session', 'demo',
    '--company', 'Example Bank',
    '--role', 'Data Scientist',
    '--jd-file', jdFile,
  ], {
    rootDir,
    stdout: { write: () => {} },
    stderr: { write: () => {} },
    provider: {
      name: 'test-provider',
      generate: async (value) => { prompt = value; return JSON.stringify({ decision: 'apply_now' }); },
    },
  });

  assert.equal(code, 0);
  assert.match(prompt, /Move into model risk data science/);
});

test('CLI update-status records a user-confirmed offer without re-running the model', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-status-update-'));
  await saveTracker({
    version: 1,
    jobs: [createJobRecord({ company: 'Example Bank', role: 'Data Scientist', status: 'interviewed' })],
  }, { rootDir });
  const writes = [];

  const code = await main([
    'update-status',
    '--company', 'Example Bank',
    '--role', 'Data Scientist',
    '--status', 'offer',
  ], {
    rootDir,
    stdout: { write: (value) => writes.push(String(value)) },
    stderr: { write: () => {} },
  });

  assert.equal(code, 0);
  assert.match(writes.join(''), /Status: offer/);
  const tracker = JSON.parse(await fs.readFile(path.join(rootDir, 'jobs', 'job_tracker.json'), 'utf8'));
  assert.equal(tracker.jobs[0].status, 'offer');
});

test('CLI cleanup archives old non-interview jobs', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-cli-cleanup-'));
  await saveTracker({
    version: 1,
    jobs: [createJobRecord({
      company: 'Old Company',
      role: 'Data Scientist',
      jdText: 'Old JD',
      status: 'applied',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })],
  }, { rootDir });

  const code = await main(['cleanup', '--now', '2026-08-02T00:00:00.000Z'], {
    rootDir,
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  });

  assert.equal(code, 0);
  const tracker = JSON.parse(await fs.readFile(path.join(rootDir, 'jobs', 'job_tracker.json'), 'utf8'));
  assert.equal(tracker.jobs[0].status, 'archived');
  assert.equal(tracker.jobs[0].jdText, '');
});
