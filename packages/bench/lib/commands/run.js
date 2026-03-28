'use strict';

const { load } = require('../config');
const clientModule = require('../client');
const { estimateTotalCost, createTracker } = require('../cost');
const { run } = require('../runner');
const { aggregateResults, formatTable, formatJson } = require('../report');
const readline = require('readline');

module.exports = async function benchRun(args) {
  const jsonOutput = args.includes('--json');
  const yesFlag = args.includes('--yes');
  const noLimit = args.includes('--no-limit');

  // Parse --runs N
  const runsIdx = args.indexOf('--runs');
  const runsOverride = runsIdx !== -1 ? parseInt(args[runsIdx + 1], 10) : null;

  // Parse --concurrency N
  const concIdx = args.indexOf('--concurrency');
  const concOverride = concIdx !== -1 ? parseInt(args[concIdx + 1], 10) : null;

  // Parse --config path
  const configIdx = args.indexOf('--config');
  const configPath = configIdx !== -1 ? args[configIdx + 1] : undefined;

  // 1. Load and validate config
  let config;
  try {
    config = load(configPath);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  // Apply overrides
  if (runsOverride !== null) {
    if (isNaN(runsOverride) || runsOverride < 1) {
      console.error('\u2717 --runs must be a positive integer');
      process.exitCode = 1;
      return;
    }
    config.runs = runsOverride;
  }
  if (concOverride !== null) {
    config.concurrency = concOverride;
  }

  // 2. Check API key early
  let client;
  try {
    client = clientModule.createClient();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  // 3. Cost estimation
  const costCap = noLimit ? Infinity : config.cost_cap_usd;
  const { estimatedCost, estimatedCalls } = estimateTotalCost(config);

  if (!noLimit && estimatedCost > costCap) {
    console.error(
      `\u2717 Estimated cost $${estimatedCost.toFixed(2)} exceeds cap $${costCap.toFixed(2)}.` +
        `\n  Reduce tasks/runs or increase cost_cap_usd. Use --no-limit to remove cap.`
    );
    process.exitCode = 1;
    return;
  }

  // 4. Confirmation prompt
  if (!yesFlag) {
    const proceed = await confirm(
      `Estimated: ${estimatedCalls} API calls, ~$${estimatedCost.toFixed(2)}. Continue? (y/N) `
    );
    if (!proceed) {
      console.log('Cancelled.');
      return;
    }
  } else {
    console.log(
      `Estimated: ${estimatedCalls} API calls, ~$${estimatedCost.toFixed(2)}`
    );
  }

  // 5. Run
  const costTracker = createTracker(costCap);
  const abortController = new AbortController();

  // SIGINT handler
  let sigintCount = 0;
  const sigintHandler = () => {
    sigintCount++;
    if (sigintCount === 1) {
      process.stderr.write(
        '\n\u26a0 Interrupted. Waiting for in-flight requests... (Ctrl+C again to force quit)\n'
      );
      abortController.abort();
    } else {
      process.exit(130);
    }
  };
  process.on('SIGINT', sigintHandler);

  let results;
  try {
    // Prepare client module for runner
    const runnerClient = {
      instance: client,
      call: clientModule.call,
    };

    results = await run(config, runnerClient, {
      costTracker,
      signal: abortController.signal,
      onProgress: ({ completed, total, task }) => {
        if (!jsonOutput) {
          process.stderr.write(
            `\r  ${completed}/${total} tasks  [${task}]`.padEnd(60)
          );
        }
      },
    });
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }

  if (!jsonOutput) {
    process.stderr.write('\r' + ' '.repeat(60) + '\r');
  }

  // 6. Report
  const summary = aggregateResults(results);
  const costSummary = costTracker.summary;

  if (jsonOutput) {
    console.log(formatJson(summary, costSummary));
  } else {
    console.log('\nSkillPack Bench Report');
    console.log('\u2500'.repeat(40));
    console.log(formatTable(summary, costSummary));
  }

  // Exit code: 1 if any errors
  const hasErrors = results.some(r => r.status === 'error');
  if (hasErrors) {
    process.exitCode = 1;
  }
};

function confirm(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
