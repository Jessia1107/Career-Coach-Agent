const fs = require('node:fs/promises');
const readline = require('node:readline/promises');
const { stdin: defaultStdin, stdout: defaultStdout, stderr: defaultStderr } = require('node:process');
const { runAgentTurn, formatStatus } = require('./agent');
const { loadSession, saveSession, applySessionInputs } = require('./state');
const { exportSession } = require('./exporter');
const {
  JOB_STATUSES,
  cleanupTracker,
  renderTrackerMarkdown,
  loadTracker,
  saveTracker,
} = require('./tracker');
const { runInterviewReview, runInterviewStart, runJudgeJob } = require('./workflows');
const {
  initProfile,
  profileStatus,
  renderInitReport,
  renderProfileStatus,
} = require('./profile');

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || 'help';
  const options = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--session') {
      options.session = args[++index];
    } else if (token === '--jd') {
      options.jd = args[++index];
    } else if (token === '--resume') {
      options.resume = args[++index];
    } else if (token === '--experience') {
      options.experience = args[++index];
    } else if (token === '--jd-file') {
      options.jdFile = args[++index];
    } else if (token === '--transcript-file') {
      options.transcriptFile = args[++index];
    } else if (token === '--company') {
      options.company = args[++index];
    } else if (token === '--role') {
      options.role = args[++index];
    } else if (token === '--career-goal') {
      options.careerGoal = args[++index];
    } else if (token === '--interviewer') {
      options.interviewer = args[++index];
    } else if (token === '--status') {
      options.status = args[++index];
    } else if (token === '--now') {
      options.now = args[++index];
    } else if (token === '--force') {
      options.force = true;
    } else if (token === '--keywords') {
      options.keywords = args[++index];
    } else if (token === '--location') {
      options.location = args[++index];
    } else if (token === '--limit') {
      options.limit = Number(args[++index]);
    } else if (token === '--jobage') {
      options.jobage = Number(args[++index]);
    } else if (token === '--experience-level') {
      options.experienceLevel = args[++index];
    } else if (token === '--remote') {
      options.remote = args[++index];
    } else {
      options._.push(token);
    }
  }

  return { command, options };
}

function usage() {
  return [
    'Career Coach CLI Agent',
    '',
    'Commands:',
    '  ./career-coach init',
    '  ./career-coach chat [--session default]',
    '  ./career-coach ask "generate branding" [--session default]',
    '  ./career-coach run --jd jd.txt --resume resume.txt [--session default]',
    '  ./career-coach judge-job --company "Company" --role "Role" --jd-file jd.txt [--career-goal "..."]',
    '  ./career-coach interview-start --company "Company" --role "Role" [--interviewer "..."]',
    '  ./career-coach interview-review --company "Company" --role "Role" --transcript-file transcript.txt',
    '  ./career-coach tracker',
    '  ./career-coach update-status --company "Company" --role "Role" --status offer',
    '  ./career-coach cleanup [--force]',
    '  ./career-coach status [--session default]',
    '  ./career-coach export [--session default]',
    '  ./career-coach discover [--keywords "..."] [--location "..."] [--limit <number>]',
    '',
    'First run:',
    '  ./career-coach init   scaffolds .career-coach/profile/ from setup/templates/',
    '                        then ask your AI assistant to use the',
    '                        career-profile-builder skill to fill it in.',
    '',
    'Optional local model provider:',
    '  CAREER_COACH_PROVIDER_COMMAND=<command>',
    '  CAREER_COACH_PROVIDER_ARGS="<args>"',
  ].join('\n');
}


async function readTextFile(filePath) {
  if (!filePath) return '';
  return fs.readFile(filePath, 'utf8');
}

async function hydrateInputsFromFiles(options) {
  const inputs = {};
  if (options.jd) inputs.targetJobDescription = await readTextFile(options.jd);
  if (options.resume) inputs.resumeText = await readTextFile(options.resume);
  if (options.experience) inputs.workExperience = options.experience;
  if (options.careerGoal) inputs.careerGoal = options.careerGoal;
  return inputs;
}

async function runChat(sessionId, runtime) {
  const stdin = runtime.stdin || defaultStdin;
  const stdout = runtime.stdout || defaultStdout;
  const rl = readline.createInterface({ input: stdin, output: stdout });

  stdout.write('Career Coach Agent. Type "exit" to quit.\n');
  while (true) {
    const answer = await rl.question('career-coach> ');
    if (/^(exit|quit)$/i.test(answer.trim())) break;
    const result = await runAgentTurn(sessionId, answer, runtime);
    stdout.write(`${result.reply}\n`);
  }
  rl.close();
  return 0;
}

async function main(argv = process.argv.slice(2), runtime = {}) {
  const stdout = runtime.stdout || defaultStdout;
  const stderr = runtime.stderr || defaultStderr;
  const { command, options } = parseArgs(argv);
  const sessionId = options.session || 'default';
  const agentOptions = {
    ...runtime,
    rootDir: runtime.rootDir,
    provider: runtime.provider,
  };

  try {
    if (command === 'help' || command === '--help' || command === '-h') {
      stdout.write(`${usage()}\n`);
      return 0;
    }

    if (command === 'init') {
      const result = await initProfile(agentOptions);
      stdout.write(`${renderInitReport(result)}\n`);
      return 0;
    }

    if (command === 'status') {
      const session = await loadSession(sessionId, agentOptions);
      const profile = await profileStatus(agentOptions);
      stdout.write(`${formatStatus(session)}\n\n${renderProfileStatus(profile)}\n`);
      return 0;
    }

    if (command === 'run') {
      const inputs = await hydrateInputsFromFiles(options);
      const result = await runAgentTurn(sessionId, 'generate a full career coach preparation package', {
        ...agentOptions,
        inputs,
      });
      stdout.write(`${result.reply}\n`);
      return 0;
    }

    if (command === 'judge-job') {
      const jdText = await readTextFile(options.jdFile || options.jd);
      const storedSession = await loadSession(sessionId, agentOptions);
      const result = await runJudgeJob({
        ...agentOptions,
        company: options.company,
        role: options.role,
        jdText,
        careerGoal: options.careerGoal || storedSession.inputs.careerGoal,
      });
      stdout.write(`${result.reply}\n`);
      return 0;
    }

    if (command === 'interview-start') {
      const storedSession = await loadSession(sessionId, agentOptions);
      const result = await runInterviewStart({
        ...agentOptions,
        company: options.company,
        role: options.role,
        careerGoal: options.careerGoal || storedSession.inputs.careerGoal,
        interviewer: options.interviewer,
      });
      stdout.write(`${result.reply}\n`);
      return 0;
    }

    if (command === 'interview-review') {
      const transcript = await readTextFile(options.transcriptFile);
      const result = await runInterviewReview({
        ...agentOptions,
        company: options.company,
        role: options.role,
        transcript,
      });
      stdout.write(`${result.reply}\n`);
      return 0;
    }

    if (command === 'tracker') {
      const tracker = await loadTracker(agentOptions);
      stdout.write(`${renderTrackerMarkdown(tracker)}\n`);
      return 0;
    }

    if (command === 'update-status') {
      if (!JOB_STATUSES.includes(options.status)) {
        throw new Error(`Invalid status. Use one of: ${JOB_STATUSES.join(', ')}`);
      }
      const tracker = await loadTracker(agentOptions);
      const companyKey = String(options.company || '').trim().toLowerCase();
      const roleKey = String(options.role || '').trim().toLowerCase();
      const job = tracker.jobs.find((item) => (
        item.company.toLowerCase() === companyKey && item.role.toLowerCase() === roleKey
      ));
      if (!job) throw new Error(`No tracked job found for ${options.company} / ${options.role}`);
      job.status = options.status;
      job.updatedAt = new Date().toISOString();
      const savedTracker = await saveTracker(tracker, agentOptions);
      const savedJob = savedTracker.jobs.find((item) => item.id === job.id);
      stdout.write(`Status updated: ${savedJob.company} / ${savedJob.role}\nStatus: ${savedJob.status}\n`);
      return 0;
    }

    if (command === 'cleanup') {
      const tracker = await loadTracker(agentOptions);
      const result = cleanupTracker(tracker, { now: options.now, force: options.force });
      if (!result.skipped) await saveTracker(result.tracker, agentOptions);
      stdout.write(result.skipped
        ? 'Cleanup skipped: it ran less than 30 days ago.\n'
        : `Cleanup complete: ${result.archived} job(s) archived.\n`);
      return 0;
    }

    if (command === 'discover') {
      const { scrapeJobs } = require('./linkedin_scraper');
      stdout.write('Scanning public LinkedIn listings...\n');
      const results = await scrapeJobs({
        keywords: options.keywords || 'quantitative analyst',
        location: options.location || 'New York, NY',
        limit: options.limit || 5,
        jobage: options.jobage,
        experienceLevel: options.experienceLevel,
        remote: options.remote
      });
      if (results.length === 0) {
        stdout.write('No new jobs found.\n');
        return 0;
      }
      stdout.write(`Found ${results.length} jobs:\n`);
      for (const job of results) {
        stdout.write(`- [${job.company || 'Unknown'}] ${job.title} (${job.location || 'Unknown'})\n  URL: ${job.url}\n`);
      }
      return 0;
    }

    if (command === 'ask') {
      const inputs = await hydrateInputsFromFiles(options);
      const message = options._.join(' ').trim();
      if (!message) throw new Error('Missing ask message');
      const result = await runAgentTurn(sessionId, message, { ...agentOptions, inputs });
      stdout.write(`${result.reply}\n`);
      return 0;
    }

    if (command === 'export') {
      const session = await loadSession(sessionId, agentOptions);
      const outputFile = await exportSession(session, agentOptions);
      await saveSession(applySessionInputs(session, {}), agentOptions);
      stdout.write(`Exported: ${outputFile}\n`);
      return 0;
    }

    if (command === 'chat') {
      return runChat(sessionId, agentOptions);
    }

    stderr.write(`Unknown command: ${command}\n${usage()}\n`);
    return 1;
  } catch (error) {
    stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  main,
  parseArgs,
  usage,
};
