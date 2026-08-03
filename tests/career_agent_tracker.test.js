const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  JOB_DECISIONS,
  JOB_STATUSES,
  createDefaultTracker,
  createJobRecord,
  cleanupTracker,
  findDuplicateJob,
  findSimilarJob,
  getTrackerPaths,
  loadTracker,
  normalizeJobRecord,
  renderTrackerMarkdown,
  saveTracker,
} = require('../career_agent/tracker');

test('createDefaultTracker exposes the agreed decision and status model', () => {
  const tracker = createDefaultTracker();

  assert.deepEqual(JOB_DECISIONS, ['apply_now', 'do_not_apply', 'future_target']);
  assert.deepEqual(JOB_STATUSES, [
    'applied',
    'do_not_apply',
    'future_target',
    'interviewing',
    'interviewed',
    'offer',
    'rejected_after_interview',
    'withdrawn',
    'archived',
  ]);
  assert.deepEqual(tracker, { version: 1, updatedAt: tracker.updatedAt, lastCleanupAt: null, jobs: [] });
});

test('normalizeJobRecord preserves original JD and applies safe defaults', () => {
  const job = normalizeJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Python and model risk experience',
  });

  assert.equal(job.company, 'Example Bank');
  assert.equal(job.role, 'Data Scientist');
  assert.equal(job.jdText, 'Python and model risk experience');
  assert.equal(job.decision, null);
  assert.equal(job.status, 'applied');
  assert.match(job.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(job.artifacts, {});
});

test('tracker round-trip writes JSON and a readable markdown view', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-tracker-'));
  const tracker = createDefaultTracker();
  tracker.jobs.push(createJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Python and SQL',
    decision: 'apply_now',
    status: 'applied',
  }));

  await saveTracker(tracker, { rootDir });
  const loaded = await loadTracker({ rootDir });
  const paths = getTrackerPaths({ rootDir });
  const markdown = await fs.readFile(paths.markdownFile, 'utf8');

  assert.equal(loaded.jobs.length, 1);
  assert.equal(loaded.jobs[0].jdText, 'Python and SQL');
  assert.match(markdown, /Example Bank/);
  assert.match(markdown, /Data Scientist/);
  assert.match(markdown, /Python and SQL/);
});

test('findDuplicateJob matches the same normalized company, role, and JD', () => {
  const existing = createJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Python\nSQL',
  });
  const tracker = { version: 1, updatedAt: new Date().toISOString(), jobs: [existing] };

  const duplicate = findDuplicateJob(tracker, {
    company: ' example bank ',
    role: 'DATA SCIENTIST',
    jdText: ' Python SQL ',
  });

  assert.equal(duplicate.id, existing.id);
});

test('findSimilarJob finds a high-overlap role for resume reuse', () => {
  const existing = createJobRecord({
    company: 'First Bank',
    role: 'Data Scientist',
    jdText: 'Python SQL model risk analytics validation reporting',
    decision: 'apply_now',
  });
  const tracker = { version: 1, jobs: [existing] };

  const match = findSimilarJob(tracker, {
    company: 'Second Bank',
    role: 'Data Scientist',
    jdText: 'Python SQL model risk analytics validation',
  });

  assert.equal(match.job.id, existing.id);
  assert.ok(match.score >= 0.65);
});

test('renderTrackerMarkdown makes do-not-apply and interview states visible', () => {
  const markdown = renderTrackerMarkdown({
    version: 1,
    updatedAt: '2026-08-02T00:00:00.000Z',
    jobs: [
      createJobRecord({ company: 'A', role: 'Role A', jdText: 'JD A', decision: 'do_not_apply', status: 'do_not_apply', reason: 'Explicit no sponsorship' }),
      createJobRecord({ company: 'B', role: 'Role B', jdText: 'JD B', decision: 'apply_now', status: 'interviewing' }),
    ],
  });

  assert.match(markdown, /do_not_apply/);
  assert.match(markdown, /interviewing/);
  assert.match(markdown, /Explicit no sponsorship/);
});

test('cleanupTracker archives old non-interview jobs but preserves interview artifacts', () => {
  const oldDate = '2026-01-01T00:00:00.000Z';
  const tracker = {
    version: 1,
    updatedAt: oldDate,
    lastCleanupAt: null,
    jobs: [
      createJobRecord({
        company: 'Old Company',
        role: 'Data Scientist',
        jdText: 'Very long original JD',
        status: 'applied',
        artifacts: { resumePdf: '/private/resume.pdf' },
        updatedAt: oldDate,
      }),
      createJobRecord({
        company: 'Interview Company',
        role: 'Data Scientist',
        jdText: 'Keep this JD',
        status: 'interviewed',
        artifacts: { interviewReview: { summary: 'Keep this' } },
        updatedAt: oldDate,
      }),
    ],
  };

  const result = cleanupTracker(tracker, { now: '2026-08-02T00:00:00.000Z' });

  assert.equal(result.skipped, false);
  assert.equal(result.archived, 1);
  assert.equal(result.tracker.jobs[0].status, 'archived');
  assert.equal(result.tracker.jobs[0].jdText, '');
  assert.deepEqual(result.tracker.jobs[0].artifacts, {});
  assert.equal(result.tracker.jobs[1].status, 'interviewed');
  assert.deepEqual(result.tracker.jobs[1].artifacts, { interviewReview: { summary: 'Keep this' } });
});

test('cleanupTracker skips when it ran less than 30 days ago', () => {
  const tracker = createDefaultTracker();
  tracker.lastCleanupAt = '2026-07-20T00:00:00.000Z';

  const result = cleanupTracker(tracker, { now: '2026-08-02T00:00:00.000Z' });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'cleanup_cadence');
});
