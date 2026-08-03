const fs = require('node:fs/promises');
const path = require('node:path');

function defaultRootDir() {
  return path.join(process.cwd(), '.career-coach');
}

function safeSessionId(sessionId) {
  const value = String(sessionId || 'default').trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error('Session id may only contain letters, numbers, dots, underscores, and dashes');
  }
  return value;
}

function getSessionPaths(sessionId = 'default', options = {}) {
  const id = safeSessionId(sessionId);
  const rootDir = options.rootDir || defaultRootDir();
  const sessionsDir = path.join(rootDir, 'sessions');
  const outputsDir = path.join(rootDir, 'outputs');

  return {
    rootDir,
    sessionsDir,
    outputsDir,
    sessionFile: path.join(sessionsDir, `${id}.json`),
    outputFile: path.join(outputsDir, `${id}.md`),
  };
}

function createDefaultSession(sessionId = 'default') {
  return {
    id: safeSessionId(sessionId),
    version: 1,
    language: 'zh',
    updatedAt: new Date().toISOString(),
    inputs: {
      targetJobDescription: '',
      resumeText: '',
      careerGoal: '',
      workExperiences: [],
      resources: [],
    },
    artifacts: {
      resumeBullets: [],
      evaluation: null,
      gapPlan: null,
      preparation: null,
      knowledgeGuide: null,
      branding: null,
      mockInterview: {
        currentQuestion: null,
        history: [],
      },
    },
    conversation: [],
  };
}

function normalizeSession(raw, sessionId = 'default') {
  const base = createDefaultSession(sessionId);
  const session = raw && typeof raw === 'object' ? raw : {};

  return {
    ...base,
    ...session,
    id: safeSessionId(session.id || sessionId),
    inputs: {
      ...base.inputs,
      ...(session.inputs || {}),
      workExperiences: Array.isArray(session.inputs?.workExperiences) ? session.inputs.workExperiences : [],
      resources: Array.isArray(session.inputs?.resources) ? session.inputs.resources : [],
    },
    artifacts: {
      ...base.artifacts,
      ...(session.artifacts || {}),
      mockInterview: {
        ...base.artifacts.mockInterview,
        ...(session.artifacts?.mockInterview || {}),
        history: Array.isArray(session.artifacts?.mockInterview?.history)
          ? session.artifacts.mockInterview.history
          : [],
      },
    },
    conversation: Array.isArray(session.conversation) ? session.conversation : [],
  };
}

async function loadSession(sessionId = 'default', options = {}) {
  const paths = getSessionPaths(sessionId, options);

  try {
    const raw = await fs.readFile(paths.sessionFile, 'utf8');
    return normalizeSession(JSON.parse(raw), sessionId);
  } catch (error) {
    if (error.code === 'ENOENT') return createDefaultSession(sessionId);
    throw error;
  }
}

async function saveSession(session, options = {}) {
  const normalized = normalizeSession(session, session?.id || 'default');
  normalized.updatedAt = new Date().toISOString();
  const paths = getSessionPaths(normalized.id, options);

  await fs.mkdir(paths.sessionsDir, { recursive: true });
  await fs.writeFile(paths.sessionFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function applySessionInputs(session, inputs = {}) {
  const next = normalizeSession(session, session?.id || 'default');

  if (typeof inputs.targetJobDescription === 'string') {
    next.inputs.targetJobDescription = inputs.targetJobDescription;
  }
  if (typeof inputs.resumeText === 'string') {
    next.inputs.resumeText = inputs.resumeText;
  }
  if (typeof inputs.careerGoal === 'string') {
    next.inputs.careerGoal = inputs.careerGoal;
  }
  if (typeof inputs.workExperience === 'string' && inputs.workExperience.trim()) {
    next.inputs.workExperiences.push(inputs.workExperience.trim());
  }
  if (Array.isArray(inputs.workExperiences)) {
    next.inputs.workExperiences = inputs.workExperiences.map(String).filter((item) => item.trim());
  }
  if (Array.isArray(inputs.resources)) {
    next.inputs.resources = inputs.resources;
  }

  return next;
}

module.exports = {
  applySessionInputs,
  createDefaultSession,
  getSessionPaths,
  loadSession,
  normalizeSession,
  saveSession,
};
