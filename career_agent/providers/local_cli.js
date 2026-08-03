const { spawn } = require('node:child_process');

function createLocalCliProvider(options = {}) {
  const command = options.command || process.env.CAREER_COACH_PROVIDER_COMMAND;
  const args = Array.isArray(options.args)
    ? options.args
    : String(options.args || process.env.CAREER_COACH_PROVIDER_ARGS || '')
      .split(/\s+/)
      .filter(Boolean);

  if (!command) {
    throw new Error('Missing CAREER_COACH_PROVIDER_COMMAND');
  }

  return {
    name: `local-cli:${command}`,
    generate(prompt) {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...(options.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Local CLI provider exited ${code}: ${stderr.trim()}`));
            return;
          }
          resolve(stdout.trim());
        });

        child.stdin.end(String(prompt || ''));
      });
    },
  };
}

function createFallbackProvider() {
  return {
    name: 'fallback-scaffold',
    async generate(prompt) {
      return [
        '本地模型 provider 还没有配置，所以我先给出可保存的结构化草稿。',
        '',
        '要接 Codex/Antigravity/Ollama，请设置：',
        '`CAREER_COACH_PROVIDER_COMMAND` 和可选的 `CAREER_COACH_PROVIDER_ARGS`。',
        '',
        '当前任务上下文摘要：',
        String(prompt || '').slice(0, 1200),
      ].join('\n');
    },
  };
}

function createProvider(options = {}) {
  if (options.provider) return options.provider;
  if (options.command || process.env.CAREER_COACH_PROVIDER_COMMAND) {
    return createLocalCliProvider(options);
  }
  return createFallbackProvider();
}

module.exports = {
  createFallbackProvider,
  createLocalCliProvider,
  createProvider,
};
