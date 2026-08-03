const { parseFirstJsonValue } = require('./json');

const INTENTS = [
  ['transform', /bullet|resume bullet|polish|transform|改简历|润色|经历/i],
  ['evaluation', /evaluate|score|analy[sz]e|评分|诊断|评估/i],
  ['gapPlan', /gap|action plan|roadmap|规划|差距|学习计划/i],
  ['preparation', /prep|question|interview prep|刷题|题|面试准备/i],
  ['knowledgeGuide', /knowledge|guide|syllabus|learn|crash course|知识|学习|概念/i],
  ['branding', /brand|branding|pitch|story|tell me about yourself|品牌|叙事|自我介绍/i],
  ['mockInterview', /mock|interview|question me|模拟|面试官/i],
  ['export', /export|download|导出/i],
];

function detectIntent(message) {
  const text = String(message || '');
  const match = INTENTS.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : 'status';
}

function summarizeInputs(session) {
  return [
    `Language: ${session.language}`,
    `Career Goal: ${session.inputs.careerGoal || 'MISSING'}`,
    `Target JD: ${session.inputs.targetJobDescription || 'MISSING'}`,
    `Resume: ${session.inputs.resumeText || 'MISSING'}`,
    `Work Experiences: ${(session.inputs.workExperiences || []).join('\n- ') || 'MISSING'}`,
    `Known Artifacts: ${Object.entries(session.artifacts || {})
      .filter(([, value]) => value && !(Array.isArray(value) && value.length === 0))
      .map(([key]) => key)
      .join(', ') || 'none'}`,
  ].join('\n\n');
}

function buildPrompt(intent, session, userMessage) {
  const shared = `You are a local Career Coach Agent. Reply primarily in Chinese, preserving English technical terms.

User request:
${userMessage}

Session context:
${summarizeInputs(session)}
`;

  const instructions = {
    transform: 'Transform the work experiences into concise STAR resume bullets. Prefer JSON array output with title and bullets.',
    evaluation: 'Evaluate the resume against the JD as a hiring manager. Prefer JSON object with experienceScore, hardSkills, softSkills, strengths, redFlags.',
    gapPlan: 'Create a concrete gap action plan. Prefer JSON object with actionPlan array.',
    preparation: 'Create interview preparation questions. Prefer JSON object with questions array.',
    knowledgeGuide: 'Create a knowledge guide for the JD concepts. Prefer JSON object with guide array.',
    branding: 'Create an elevator pitch and STAR stories. Prefer JSON object with elevatorPitch and stories.',
    mockInterview: 'Ask one realistic interview question or score the latest answer. Prefer JSON object with question or feedback.',
    status: 'Summarize current session status and suggest the next best action in Chinese.',
  };

  return `${shared}\nTask:\n${instructions[intent] || instructions.status}\n`;
}

function artifactKeyForIntent(intent) {
  return {
    transform: 'resumeBullets',
    evaluation: 'evaluation',
    gapPlan: 'gapPlan',
    preparation: 'preparation',
    knowledgeGuide: 'knowledgeGuide',
    branding: 'branding',
    mockInterview: 'mockInterview',
  }[intent] || null;
}

function normalizeArtifact(intent, rawOutput) {
  const parsed = (() => {
    try {
      return parseFirstJsonValue(rawOutput);
    } catch (error) {
      return null;
    }
  })();

  if (parsed !== null) return parsed;
  if (intent === 'transform') return [{ title: 'Resume Bullet Draft', bullets: [String(rawOutput || '').trim()] }];
  if (intent === 'mockInterview') return { currentQuestion: String(rawOutput || '').trim(), history: [] };
  return String(rawOutput || '').trim();
}

function formatReply(intent, artifact, providerName) {
  const prefix = providerName ? `[${providerName}] ` : '';
  if (typeof artifact === 'string') return `${prefix}${artifact}`;
  if (intent === 'branding' && artifact?.elevatorPitch) return `${prefix}${artifact.elevatorPitch}`;
  if (intent === 'preparation' && Array.isArray(artifact?.questions)) {
    return `${prefix}${artifact.questions.map((q, index) => `${index + 1}. ${q.title || q.question || q.description}`).join('\n')}`;
  }
  if (intent === 'transform' && Array.isArray(artifact)) {
    return `${prefix}${artifact.map((item) => item.title || JSON.stringify(item)).join('\n')}`;
  }
  if (intent === 'mockInterview' && artifact?.currentQuestion) return `${prefix}${artifact.currentQuestion}`;
  return `${prefix}${JSON.stringify(artifact, null, 2)}`;
}

module.exports = {
  artifactKeyForIntent,
  buildPrompt,
  detectIntent,
  formatReply,
  normalizeArtifact,
  summarizeInputs,
};
