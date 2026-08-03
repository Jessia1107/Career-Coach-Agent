const { loadSession, saveSession, applySessionInputs } = require('./state');
const { createProvider } = require('./providers/local_cli');
const {
  artifactKeyForIntent,
  buildPrompt,
  detectIntent,
  formatReply,
  normalizeArtifact,
  summarizeInputs,
} = require('./tasks');

function hasMeaningfulArtifact(key, value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (key === 'mockInterview') {
    return Boolean(value.currentQuestion) || (Array.isArray(value.history) && value.history.length > 0);
  }
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function formatStatus(session) {
  return [
    `Session: ${session.id}`,
    `JD: ${session.inputs.targetJobDescription ? 'ready' : 'missing'}`,
    `Resume: ${session.inputs.resumeText ? 'ready' : 'missing'}`,
    `Work experiences: ${session.inputs.workExperiences.length}`,
    `Artifacts: ${Object.entries(session.artifacts || {})
      .filter(([key, value]) => hasMeaningfulArtifact(key, value))
      .map(([key]) => key)
      .join(', ') || 'none'}`,
  ].join('\n');
}

async function runAgentTurn(sessionId, message, options = {}) {
  let session = await loadSession(sessionId, options);
  session = applySessionInputs(session, options.inputs || {});

  const intent = detectIntent(message);
  let reply = '';

  session.conversation.push({
    role: 'user',
    content: String(message || ''),
    at: new Date().toISOString(),
  });

  if (intent === 'status' || intent === 'export') {
    reply = intent === 'status' ? formatStatus(session) : 'Use `./career-coach export` to write the markdown package.';
  } else {
    const provider = createProvider(options);
    const prompt = buildPrompt(intent, session, message);
    const rawOutput = await provider.generate(prompt);
    const artifact = normalizeArtifact(intent, rawOutput);
    const artifactKey = artifactKeyForIntent(intent);

    if (artifactKey) {
      session.artifacts[artifactKey] = artifact;
    }

    reply = formatReply(intent, artifact, provider.name);
  }

  session.conversation.push({
    role: 'assistant',
    content: reply,
    at: new Date().toISOString(),
    intent,
  });

  await saveSession(session, options);
  return { intent, reply, session };
}

module.exports = {
  formatStatus,
  hasMeaningfulArtifact,
  runAgentTurn,
  summarizeInputs,
};
