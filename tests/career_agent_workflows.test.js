const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  runInterviewReview,
  runInterviewStart,
  runJudgeJob,
} = require('../career_agent/workflows');
const { createJobRecord, loadTracker, saveTracker } = require('../career_agent/tracker');

function providerReturning(value, calls) {
  return {
    name: 'test-provider',
    generate: async (prompt) => {
      calls.push(prompt);
      return JSON.stringify(value);
    },
  };
}

test('runJudgeJob stores a decision and includes career goal plus decision rules in the prompt', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-judge-'));
  const calls = [];

  const result = await runJudgeJob({
    rootDir,
    company: 'Example Company',
    role: 'Model Risk Data Scientist',
    jdText: 'Build model risk analytics with Python and SQL.',
    careerGoal: 'Move into quantitative model risk and data science.',
    provider: providerReturning({
      decision: 'apply_now',
      reason: 'Strong skill and domain alignment.',
      skillTags: ['Python', 'SQL'],
      domainTags: ['model risk'],
    }, calls),
  });

  assert.equal(result.job.decision, 'apply_now');
  assert.equal(result.job.status, 'applied');
  assert.equal(result.job.jdText, 'Build model risk analytics with Python and SQL.');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Move into quantitative model risk/);
  assert.match(calls[0], /Missing sponsorship or location information is not a rejection reason/);
  assert.match(calls[0], /Only explicit hard red flags justify do_not_apply/);
});

test('runJudgeJob reuses an exact duplicate without calling the provider', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-duplicate-'));
  const existing = createJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Python SQL',
    decision: 'do_not_apply',
    status: 'do_not_apply',
    reason: 'Explicitly requires citizenship.',
  });
  await saveTracker({ version: 1, jobs: [existing] }, { rootDir });
  let calls = 0;

  const result = await runJudgeJob({
    rootDir,
    company: ' example bank ',
    role: 'DATA SCIENTIST',
    jdText: 'Python SQL',
    provider: { generate: async () => { calls += 1; return '{}'; } },
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.job.id, existing.id);
  assert.equal(result.job.decision, 'do_not_apply');
  assert.equal(calls, 0);
});

test('runJudgeJob records resume reuse when an earlier same-role JD is highly similar', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-resume-reuse-'));
  const existing = createJobRecord({
    company: 'First Bank',
    role: 'Data Scientist',
    jdText: 'Python SQL model risk analytics validation reporting',
    decision: 'apply_now',
    status: 'applied',
    resumeStatus: 'generated',
    resumePath: 'resumes/first-bank-data-scientist.pdf',
  });
  await saveTracker({ version: 1, jobs: [existing] }, { rootDir });

  const result = await runJudgeJob({
    rootDir,
    company: 'Second Bank',
    role: 'Data Scientist',
    jdText: 'Python SQL model risk analytics validation',
    provider: providerReturning({ decision: 'apply_now', reason: 'Same target profile.' }, []),
  });

  assert.equal(result.job.resumeStatus, 'reused');
  assert.equal(result.job.resumeReusedFrom, existing.id);
  assert.ok(result.job.similarityScore >= 0.65);
});

test('runInterviewStart loads the saved JD and resume context and marks the job interviewing', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-interview-start-'));
  const job = createJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Build risk models with Python.',
    decision: 'apply_now',
    status: 'applied',
    artifacts: { resumeText: 'Built a risk model.' },
  });
  await saveTracker({ version: 1, jobs: [job] }, { rootDir });
  const calls = [];

  const result = await runInterviewStart({
    rootDir,
    company: 'Example Bank',
    role: 'Data Scientist',
    careerGoal: 'Become a model risk data scientist.',
    interviewer: 'Senior Hiring Manager LinkedIn profile: 20 years in model risk.',
    provider: providerReturning({ persona: 'Senior model risk hiring manager.' }, calls),
  });

  assert.equal(result.job.status, 'interviewing');
  assert.equal(result.job.interviewer.text, 'Senior Hiring Manager LinkedIn profile: 20 years in model risk.');
  assert.match(calls[0], /Build risk models with Python/);
  assert.match(calls[0], /Built a risk model/);
  assert.match(calls[0], /Become a model risk data scientist/);
});

test('runInterviewReview saves transcript and review while marking the job interviewed', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-interview-review-'));
  const job = createJobRecord({
    company: 'Example Bank',
    role: 'Data Scientist',
    jdText: 'Build risk models with Python.',
    decision: 'apply_now',
    status: 'interviewing',
    artifacts: { resumeText: 'Built a risk model.', evaluation: { score: 92 } },
  });
  await saveTracker({ version: 1, jobs: [job] }, { rootDir });
  const calls = [];
  const transcript = 'Interviewer: Explain your model validation project.\nCandidate: ...';

  const result = await runInterviewReview({
    rootDir,
    company: 'Example Bank',
    role: 'Data Scientist',
    transcript,
    provider: providerReturning({ summary: 'Strong validation explanation.', nextActions: ['Practice concise STAR answers.'] }, calls),
  });

  assert.equal(result.job.status, 'interviewed');
  assert.equal(result.job.artifacts.interviewTranscript, transcript);
  assert.equal(result.job.artifacts.interviewReview.summary, 'Strong validation explanation.');
  assert.match(calls[0], /Build risk models with Python/);
  assert.match(calls[0], /Built a risk model/);
  assert.match(calls[0], /score.*92/i);
});
