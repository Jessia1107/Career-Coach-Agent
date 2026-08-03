const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { runAgentTurn } = require('../career_agent/agent');
const { createDefaultSession, loadSession, saveSession } = require('../career_agent/state');
const { createLocalCliProvider } = require('../career_agent/providers/local_cli');

test('runAgentTurn stores provider output under the routed artifact', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-run-'));
  const session = createDefaultSession('agent');
  session.inputs.targetJobDescription = 'Data analyst role with SQL, Python, and stakeholder communication';
  session.inputs.resumeText = 'Built dashboards and automated reporting.';
  await saveSession(session, { rootDir });

  const provider = {
    name: 'test-provider',
    generate: async () => JSON.stringify({
      elevatorPitch: 'I turn messy business data into decisions.',
      stories: [{ title: 'Dashboard automation', situation: 'Manual reporting', action: 'Automated it', result: 'Saved time' }],
    }),
  };

  const result = await runAgentTurn('agent', 'generate my branding', { rootDir, provider });
  const loaded = await loadSession('agent', { rootDir });

  assert.equal(result.intent, 'branding');
  assert.match(result.reply, /I turn messy business data/);
  assert.equal(loaded.artifacts.branding.elevatorPitch, 'I turn messy business data into decisions.');
  assert.equal(loaded.conversation.length, 2);
});

test('runAgentTurn can update session inputs from explicit fields', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-inputs-'));

  const result = await runAgentTurn('agent', 'status', {
    rootDir,
    inputs: {
      targetJobDescription: 'Backend engineer role',
      resumeText: 'Node.js services',
      workExperience: 'Owned service reliability',
    },
  });
  const loaded = await loadSession('agent', { rootDir });

  assert.equal(result.intent, 'status');
  assert.equal(loaded.inputs.targetJobDescription, 'Backend engineer role');
  assert.deepEqual(loaded.inputs.workExperiences, ['Owned service reliability']);
});

test('local CLI provider sends prompt through stdin and returns stdout', async () => {
  const provider = createLocalCliProvider({
    command: process.execPath,
    args: ['-e', 'process.stdin.on("data", c => process.stdout.write("echo:" + c.toString().slice(0, 5)))'],
  });

  const output = await provider.generate('hello world');

  assert.equal(output, 'echo:hello');
});

test('runAgentTurn includes the stored career goal in provider context', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-agent-career-goal-prompt-'));
  const session = createDefaultSession('goal-prompt');
  session.inputs.careerGoal = 'Move into quantitative model risk data science.';
  await saveSession(session, { rootDir });
  let prompt = '';

  await runAgentTurn('goal-prompt', 'generate my branding', {
    rootDir,
    provider: {
      name: 'test-provider',
      generate: async (value) => {
        prompt = value;
        return JSON.stringify({ elevatorPitch: 'A focused story.', stories: [] });
      },
    },
  });

  assert.match(prompt, /Move into quantitative model risk data science/);
});
