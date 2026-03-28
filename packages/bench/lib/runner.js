'use strict';

const { evaluateAssertions, evaluateLlmJudge } = require('./judge');

async function runTask(task, config, clientModule, costTracker) {
  const userPrompt = buildUserPrompt(task);

  // Run A: vanilla (no system prompt)
  const resultA = await callWithRetry(clientModule, {
    model: config.model,
    user: userPrompt,
    system: null,
  });
  costTracker.add(resultA.usage, config.model);

  // Run B: with skill
  const resultB = await callWithRetry(clientModule, {
    model: config.model,
    user: userPrompt,
    system: config.skill_content,
  });
  costTracker.add(resultB.usage, config.model);

  // Evaluate contains assertions on both
  const assertionsA = evaluateAssertions(resultA.text, task.assertions);
  const assertionsB = evaluateAssertions(resultB.text, task.assertions);

  // Evaluate llm-judge assertions
  const judgeResults = [];
  for (const assertion of task.assertions) {
    if (assertion.type === 'llm-judge') {
      try {
        const judgeResult = await evaluateLlmJudge(
          clientModule,
          config,
          task,
          resultA.text,
          resultB.text,
          assertion
        );
        if (judgeResult.usage) {
          const judgeModel =
            (config.judge && config.judge.model) || config.model;
          costTracker.add(judgeResult.usage, judgeModel);
        }
        judgeResults.push(judgeResult);
      } catch (err) {
        judgeResults.push({
          type: 'llm-judge',
          pass: false,
          score_a: null,
          score_b: null,
          error: err.message,
        });
      }
    }
  }

  return {
    name: task.name,
    status: 'completed',
    response_a: resultA.text,
    response_b: resultB.text,
    assertions_a: assertionsA,
    assertions_b: assertionsB,
    judge_results: judgeResults,
    usage: {
      a: resultA.usage,
      b: resultB.usage,
    },
  };
}

function buildUserPrompt(task) {
  let prompt = task.user;
  if (task.context_files && task.context_files.length > 0) {
    for (const cf of task.context_files) {
      prompt += `\n\n<context file="${cf.path}">\n${cf.content}\n</context>`;
    }
  }
  return prompt;
}

const RETRY_DELAYS = [2000, 4000, 8000];
const RETRYABLE_STATUS = [429, 529];

async function callWithRetry(clientModule, params) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await clientModule.call(clientModule.instance, params);
    } catch (err) {
      lastError = err;

      // 401: abort immediately — no retry
      if (err.status === 401) {
        throw new Error(
          `Auth error (401). Check ANTHROPIC_API_KEY and rerun.\n  ${err.message}`
        );
      }

      // 500: retry once
      if (err.status === 500 && attempt === 0) {
        await sleep(5000);
        continue;
      }

      // 429/529: exponential backoff
      if (RETRYABLE_STATUS.includes(err.status) && attempt < RETRY_DELAYS.length) {
        process.stderr.write(
          `\u26a0 Rate limited (${err.status}), retrying (${attempt + 1}/${RETRY_DELAYS.length})...\n`
        );
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      // Timeout or other: skip
      throw err;
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(config, clientModule, options = {}) {
  const { costTracker, onProgress, signal } = options;
  const results = [];
  const taskQueue = [];

  // Build task queue: each task × runs
  for (let r = 0; r < config.runs; r++) {
    for (const task of config.tasks) {
      taskQueue.push({ task, runIndex: r });
    }
  }

  let completed = 0;
  const total = taskQueue.length;

  // Bounded concurrency pool
  const concurrency = config.concurrency || 5;
  let running = 0;
  let queueIndex = 0;

  await new Promise((resolve, reject) => {
    function next() {
      // Check abort signal
      if (signal && signal.aborted) {
        if (running === 0) resolve();
        return;
      }

      // Check cost cap
      if (costTracker && costTracker.exceeded) {
        process.stderr.write(
          `\n\u26a0 Cost cap reached ($${costTracker.summary.total_cost_usd.toFixed(2)}). Stopping.\n`
        );
        if (running === 0) resolve();
        return;
      }

      while (running < concurrency && queueIndex < total) {
        const { task, runIndex } = taskQueue[queueIndex++];
        running++;

        runTask(task, config, clientModule, costTracker)
          .then(result => {
            result.run_index = runIndex;
            results.push(result);
          })
          .catch(err => {
            results.push({
              name: task.name,
              run_index: runIndex,
              status: 'error',
              error: err.message,
            });
          })
          .finally(() => {
            running--;
            completed++;
            if (onProgress) {
              onProgress({ completed, total, task: task.name });
            }
            if (completed === total || (signal && signal.aborted) || (costTracker && costTracker.exceeded)) {
              if (running === 0) resolve();
            } else {
              next();
            }
          });
      }

      if (running === 0 && queueIndex >= total) {
        resolve();
      }
    }

    next();
  });

  return results;
}

module.exports = { run, runTask, buildUserPrompt, callWithRetry };
