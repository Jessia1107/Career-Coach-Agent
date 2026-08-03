const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const JOB_DECISIONS = ['apply_now', 'do_not_apply', 'future_target'];
const JOB_STATUSES = [
  'applied',
  'do_not_apply',
  'future_target',
  'interviewing',
  'interviewed',
  'offer',
  'rejected_after_interview',
  'withdrawn',
  'archived',
];

function defaultRootDir() {
  return path.join(process.cwd(), '.career-coach');
}

function getTrackerPaths(options = {}) {
  const rootDir = options.rootDir || defaultRootDir();
  const jobsDir = path.join(rootDir, 'jobs');
  return {
    rootDir,
    jobsDir,
    jsonFile: path.join(jobsDir, 'job_tracker.json'),
    markdownFile: path.join(jobsDir, 'job_tracker.md'),
  };
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function fingerprintForJob({ company, role, jdText }) {
  const source = [company, role, jdText].map(normalizeText).join('\n');
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
}

function createDefaultTracker() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    lastCleanupAt: null,
    jobs: [],
  };
}

function normalizeJobRecord(raw = {}) {
  const job = raw && typeof raw === 'object' ? raw : {};
  const company = String(job.company || '').trim();
  const role = String(job.role || '').trim();
  const jdText = String(job.jdText || '');
  const decision = JOB_DECISIONS.includes(job.decision) ? job.decision : null;
  const status = JOB_STATUSES.includes(job.status) ? job.status : 'applied';

  return {
    id: String(job.id || crypto.randomUUID()),
    company,
    role,
    jdText,
    jdUrl: String(job.jdUrl || '').trim(),
    decision,
    status,
    reason: String(job.reason || '').trim(),
    fingerprint: String(job.fingerprint || fingerprintForJob({ company, role, jdText })),
    skillTags: Array.isArray(job.skillTags) ? job.skillTags.map(String) : [],
    domainTags: Array.isArray(job.domainTags) ? job.domainTags.map(String) : [],
    seniority: String(job.seniority || '').trim(),
    resumeStatus: String(job.resumeStatus || '').trim(),
    resumePath: String(job.resumePath || '').trim(),
    resumeReusedFrom: String(job.resumeReusedFrom || '').trim(),
    similarityScore: Number.isFinite(job.similarityScore) ? job.similarityScore : null,
    artifacts: job.artifacts && typeof job.artifacts === 'object' ? job.artifacts : {},
    interviewer: job.interviewer && typeof job.interviewer === 'object' ? job.interviewer : null,
    createdAt: String(job.createdAt || new Date().toISOString()),
    updatedAt: String(job.updatedAt || new Date().toISOString()),
    interviewDate: String(job.interviewDate || '').trim(),
  };
}

function createJobRecord(input = {}) {
  return normalizeJobRecord(input);
}

function normalizeTracker(raw = {}) {
  const tracker = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    updatedAt: String(tracker.updatedAt || new Date().toISOString()),
    lastCleanupAt: tracker.lastCleanupAt ? String(tracker.lastCleanupAt) : null,
    jobs: Array.isArray(tracker.jobs) ? tracker.jobs.map(normalizeJobRecord) : [],
  };
}

function cleanupTracker(tracker, options = {}) {
  const normalized = normalizeTracker(tracker);
  const now = new Date(options.now || new Date().toISOString());
  const lastCleanup = normalized.lastCleanupAt ? new Date(normalized.lastCleanupAt) : null;
  if (lastCleanup && now - lastCleanup < 30 * 24 * 60 * 60 * 1000 && !options.force) {
    return { skipped: true, reason: 'cleanup_cadence', archived: 0, tracker: normalized };
  }

  const protectedStatuses = new Set(['interviewing', 'interviewed', 'offer', 'rejected_after_interview']);
  let archived = 0;
  normalized.jobs = normalized.jobs.map((job) => {
    const updatedAt = new Date(job.updatedAt);
    const olderThan90Days = Number.isFinite(updatedAt.getTime())
      && now - updatedAt > 90 * 24 * 60 * 60 * 1000;
    if (!olderThan90Days || protectedStatuses.has(job.status) || job.status === 'archived') return job;
    archived += 1;
    return {
      ...job,
      status: 'archived',
      jdText: '',
      jdUrl: '',
      resumePath: '',
      artifacts: {},
      updatedAt: now.toISOString(),
    };
  });
  normalized.lastCleanupAt = now.toISOString();
  normalized.updatedAt = now.toISOString();
  return { skipped: false, reason: 'completed', archived, tracker: normalized };
}

function findDuplicateJob(tracker, input) {
  const fingerprint = fingerprintForJob(input);
  return normalizeTracker(tracker).jobs.find((job) => job.fingerprint === fingerprint) || null;
}

function textTokens(value) {
  return new Set(normalizeText(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function jaccardSimilarity(left, right) {
  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function findSimilarJob(tracker, input, minimumScore = 0.65) {
  const roleKey = normalizeText(input.role);
  const candidates = normalizeTracker(tracker).jobs
    .filter((job) => job.status !== 'archived' && normalizeText(job.role) === roleKey)
    .map((job) => ({ job, score: jaccardSimilarity(job.jdText, input.jdText) }))
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  return best && best.score >= minimumScore ? best : null;
}

function renderTrackerMarkdown(tracker) {
  const normalized = normalizeTracker(tracker);
  const rows = normalized.jobs.length === 0
    ? ['No tracked jobs.']
    : normalized.jobs.map((job) => [
      `### ${job.company || 'Unknown company'} — ${job.role || 'Unknown role'}`,
      '',
      `- Decision: ${job.decision || 'pending'}`,
      `- Status: ${job.status}`,
      `- Reason: ${job.reason || '—'}`,
      `- Resume: ${job.resumeStatus || 'not generated'}`,
      `- Updated: ${job.updatedAt}`,
      '',
      '#### Original JD',
      '',
      job.jdText || 'Not provided',
      '',
    ].join('\n'));

  return [
    '# Job Tracker',
    '',
    `Updated: ${normalized.updatedAt}`,
    '',
    ...rows,
  ].join('\n');
}

async function loadTracker(options = {}) {
  const paths = getTrackerPaths(options);
  try {
    const raw = await fs.readFile(paths.jsonFile, 'utf8');
    return normalizeTracker(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return createDefaultTracker();
    throw error;
  }
}

async function saveTracker(tracker, options = {}) {
  const normalized = normalizeTracker(tracker);
  normalized.updatedAt = new Date().toISOString();
  const paths = getTrackerPaths(options);
  await fs.mkdir(paths.jobsDir, { recursive: true });
  await fs.writeFile(paths.jsonFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await fs.writeFile(paths.markdownFile, renderTrackerMarkdown(normalized), 'utf8');
  return normalized;
}

module.exports = {
  JOB_DECISIONS,
  JOB_STATUSES,
  createDefaultTracker,
  createJobRecord,
  cleanupTracker,
  findDuplicateJob,
  findSimilarJob,
  fingerprintForJob,
  getTrackerPaths,
  loadTracker,
  normalizeJobRecord,
  normalizeTracker,
  renderTrackerMarkdown,
  saveTracker,
};
