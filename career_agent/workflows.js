const { parseFirstJsonValue } = require('./json');
const { createProvider } = require('./providers/local_cli');
const {
  createJobRecord,
  findDuplicateJob,
  findSimilarJob,
  loadTracker,
  normalizeTracker,
  saveTracker,
} = require('./tracker');

function parseProviderObject(rawOutput, workflowName) {
  try {
    const parsed = parseFirstJsonValue(rawOutput);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('provider response is not a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(`${workflowName} provider response could not be parsed: ${error.message}`);
  }
}

function selectJob(tracker, company, role) {
  const companyKey = String(company || '').trim().toLowerCase();
  const roleKey = String(role || '').trim().toLowerCase();
  return normalizeTracker(tracker).jobs.find((job) => (
    job.company.toLowerCase() === companyKey && job.role.toLowerCase() === roleKey
  )) || null;
}

function buildJobDecisionPrompt({ company, role, jdText, careerGoal }) {
  return `You are a senior career strategist deciding whether a candidate should apply to a job.

Career goal:
${careerGoal || 'Not provided'}

Job:
Company: ${company}
Role: ${role}

Original job description:
${jdText}

Decision rules:
- Return exactly one decision: apply_now, do_not_apply, or future_target.
- Missing sponsorship or location information is not a rejection reason; assume sponsorship and location are acceptable unless the JD explicitly says otherwise.
- Only explicit hard red flags justify do_not_apply, such as explicit no sponsorship, citizenship/clearance requirements the candidate cannot satisfy, severe role mismatch, or a clear work-style conflict.
- Use future_target when the role strongly matches the career goal but the candidate lacks material experience that cannot honestly be presented as current experience.
- If decision is apply_now, the local tracker may mark it applied after resume generation or reuse. Do not claim an external application was submitted.

Return JSON only:
{
  "decision": "apply_now|do_not_apply|future_target",
  "reason": "short evidence-based explanation",
  "skillTags": ["..."],
  "domainTags": ["..."],
  "seniority": "...",
  "resumeAction": "generate|reuse|not_applicable"
}`;
}

function buildInterviewStartPrompt({ job, careerGoal, interviewer }) {
  return `You are preparing a candidate for an interview using the complete saved application context.

Career goal:
${careerGoal || 'Not provided'}

Company: ${job.company}
Role: ${job.role}

Original JD:
${job.jdText}

Resume version/context:
${job.artifacts?.resumeText || job.resumePath || 'Not provided'}

Interviewer information:
${interviewer || 'Not provided'}

Produce JSON with:
{
  "interviewerPersona": "...",
  "hiringManagerEvaluation": {"experienceScore": 0, "hardSkills": [], "softSkills": [], "strengths": [], "areasForImprovement": [], "redFlags": [], "finalRating": "..."},
  "prepPackage": {"keyConcerns": [], "storiesToEmphasize": [], "questions": []}
}`;
}

function buildInterviewReviewPrompt({ job, transcript }) {
  return `You are reviewing an interview transcript against the saved application context.

Company: ${job.company}
Role: ${job.role}

Original JD:
${job.jdText}

Resume version/context:
${job.artifacts?.resumeText || job.resumePath || 'Not provided'}

Saved hiring manager evaluation:
${JSON.stringify(job.artifacts?.hiringManagerEvaluation || job.artifacts?.evaluation || {}, null, 2)}

Interview transcript:
${transcript}

Return JSON with:
{
  "summary": "...",
  "strongAnswers": [],
  "weakAnswers": [],
  "missedOpportunities": [],
  "redFlagsExposed": [],
  "nextActions": [],
  "reusableLessons": []
}`;
}

function normalizeDecisionResult(result) {
  const decision = ['apply_now', 'do_not_apply', 'future_target'].includes(result.decision)
    ? result.decision
    : null;
  if (!decision) throw new Error('job decision must be apply_now, do_not_apply, or future_target');
  return {
    decision,
    reason: String(result.reason || '').trim(),
    skillTags: Array.isArray(result.skillTags) ? result.skillTags.map(String) : [],
    domainTags: Array.isArray(result.domainTags) ? result.domainTags.map(String) : [],
    seniority: String(result.seniority || '').trim(),
    resumeAction: String(result.resumeAction || '').trim(),
  };
}

function statusForDecision(decision) {
  return decision === 'do_not_apply' ? 'do_not_apply' : decision === 'future_target' ? 'future_target' : 'applied';
}

async function runJudgeJob(options = {}) {
  const { rootDir, company, role, jdText, careerGoal } = options;
  if (!company || !role || !jdText) throw new Error('judge-job requires company, role, and JD text');

  const tracker = await loadTracker({ rootDir });
  const duplicate = findDuplicateJob(tracker, { company, role, jdText });
  if (duplicate) {
    return { duplicate: true, job: duplicate, reply: formatJobReply(duplicate, true) };
  }

  const provider = options.provider || createProvider(options);
  const rawOutput = await provider.generate(buildJobDecisionPrompt({ company, role, jdText, careerGoal }));
  const result = normalizeDecisionResult(parseProviderObject(rawOutput, 'judge-job'));
  const similar = result.decision === 'apply_now'
    ? findSimilarJob(tracker, { company, role, jdText })
    : null;
  const canReuseResume = Boolean(
    similar
    && similar.job.decision === 'apply_now'
    && similar.job.resumePath
    && ['generated', 'reused'].includes(similar.job.resumeStatus)
  );
  const now = new Date().toISOString();
  const job = createJobRecord({
    company,
    role,
    jdText,
    decision: result.decision,
    status: statusForDecision(result.decision),
    reason: result.reason,
    skillTags: result.skillTags,
    domainTags: result.domainTags,
    seniority: result.seniority,
    resumeStatus: canReuseResume
      ? 'reused'
      : result.resumeAction === 'not_applicable' ? '' : 'pending_generation',
    resumePath: canReuseResume ? similar.job.resumePath : '',
    resumeReusedFrom: canReuseResume ? similar.job.id : '',
    similarityScore: canReuseResume ? similar.score : null,
    createdAt: now,
    updatedAt: now,
  });
  tracker.jobs.push(job);
  const savedTracker = await saveTracker(tracker, { rootDir });
  return { duplicate: false, job: savedTracker.jobs.find((item) => item.id === job.id), result, reply: formatJobReply(job, false) };
}

async function runInterviewStart(options = {}) {
  const tracker = await loadTracker({ rootDir: options.rootDir });
  const job = selectJob(tracker, options.company, options.role);
  if (!job) throw new Error(`No tracked job found for ${options.company} / ${options.role}`);

  const provider = options.provider || createProvider(options);
  const rawOutput = await provider.generate(buildInterviewStartPrompt({
    job,
    careerGoal: options.careerGoal,
    interviewer: options.interviewer,
  }));
  const result = parseProviderObject(rawOutput, 'interview-start');
  const nextJob = {
    ...job,
    status: 'interviewing',
    interviewer: { text: String(options.interviewer || '').trim() },
    artifacts: {
      ...job.artifacts,
      interviewerPersona: result.interviewerPersona || '',
      hiringManagerEvaluation: result.hiringManagerEvaluation || {},
      prepPackage: result.prepPackage || {},
    },
    updatedAt: new Date().toISOString(),
  };
  const nextTracker = normalizeTracker(tracker);
  nextTracker.jobs = nextTracker.jobs.map((item) => item.id === job.id ? nextJob : item);
  const savedTracker = await saveTracker(nextTracker, { rootDir: options.rootDir });
  return { job: savedTracker.jobs.find((item) => item.id === job.id), result, reply: JSON.stringify(result, null, 2) };
}

async function runInterviewReview(options = {}) {
  if (!options.transcript) throw new Error('interview-review requires transcript text');
  const tracker = await loadTracker({ rootDir: options.rootDir });
  const job = selectJob(tracker, options.company, options.role);
  if (!job) throw new Error(`No tracked job found for ${options.company} / ${options.role}`);

  const provider = options.provider || createProvider(options);
  const rawOutput = await provider.generate(buildInterviewReviewPrompt({ job, transcript: options.transcript }));
  const result = parseProviderObject(rawOutput, 'interview-review');
  const nextJob = {
    ...job,
    status: 'interviewed',
    artifacts: {
      ...job.artifacts,
      interviewTranscript: String(options.transcript),
      interviewReview: result,
    },
    updatedAt: new Date().toISOString(),
  };
  const nextTracker = normalizeTracker(tracker);
  nextTracker.jobs = nextTracker.jobs.map((item) => item.id === job.id ? nextJob : item);
  const savedTracker = await saveTracker(nextTracker, { rootDir: options.rootDir });
  return { job: savedTracker.jobs.find((item) => item.id === job.id), result, reply: JSON.stringify(result, null, 2) };
}

function formatJobReply(job, duplicate) {
  return [
    duplicate ? 'Duplicate job found; reused the existing tracker decision.' : 'Job decision recorded.',
    `Company: ${job.company}`,
    `Role: ${job.role}`,
    `Decision: ${job.decision || 'pending'}`,
    `Status: ${job.status}`,
    `Reason: ${job.reason || 'Not provided'}`,
    job.status === 'applied' ? 'Note: this is a local tracker state after resume generation/reuse; no external application was submitted by the agent.' : '',
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildInterviewReviewPrompt,
  buildInterviewStartPrompt,
  buildJobDecisionPrompt,
  runInterviewReview,
  runInterviewStart,
  runJudgeJob,
};
