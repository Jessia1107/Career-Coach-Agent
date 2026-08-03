const fs = require('node:fs/promises');
const { getSessionPaths } = require('./state');

function section(title, body) {
  if (!body) return '';
  const content = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  if (!content || content === 'null' || content === '[]') return '';
  return `## ${title}\n\n${content}\n\n`;
}

function renderSessionMarkdown(session) {
  return [
    `# Career Coach Session: ${session.id}`,
    '',
    `Updated: ${session.updatedAt}`,
    '',
    '## Inputs',
    '',
    `### Target Job Description\n\n${session.inputs.targetJobDescription || 'Not provided'}`,
    '',
    `### Resume\n\n${session.inputs.resumeText || 'Not provided'}`,
    '',
    section('Resume Bullets', session.artifacts.resumeBullets),
    section('Evaluation', session.artifacts.evaluation),
    section('Gap Plan', session.artifacts.gapPlan),
    section('Interview Preparation', session.artifacts.preparation),
    section('Knowledge Guide', session.artifacts.knowledgeGuide),
    section('Branding', session.artifacts.branding),
    section('Mock Interview', session.artifacts.mockInterview),
  ].join('\n');
}

async function exportSession(session, options = {}) {
  const paths = getSessionPaths(session.id, options);
  await fs.mkdir(paths.outputsDir, { recursive: true });
  await fs.writeFile(paths.outputFile, renderSessionMarkdown(session), 'utf8');
  return paths.outputFile;
}

module.exports = {
  exportSession,
  renderSessionMarkdown,
};
