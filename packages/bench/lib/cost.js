'use strict';

// Pricing per 1M tokens (USD) as of 2026-03
const PRICING = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6-20250627': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-opus-4-20250115': { input: 15.0, output: 75.0 },
  'claude-opus-4-6-20250626': { input: 15.0, output: 75.0 },
};

// Fallback pricing for unknown models
const FALLBACK_PRICING = { input: 3.0, output: 15.0 };

function getPricing(model) {
  return PRICING[model] || FALLBACK_PRICING;
}

function estimateTokens(text) {
  // ~4 chars per token approximation
  return Math.ceil((text || '').length / 4);
}

function estimateTaskCost(task, config) {
  const pricing = getPricing(config.model);
  const judgePricing = getPricing((config.judge && config.judge.model) || config.model);

  // Build input text for estimation
  let inputText = task.user;
  if (task.context_files) {
    for (const cf of task.context_files) {
      inputText += cf.content || '';
    }
  }

  const inputTokens = estimateTokens(inputText);
  const systemTokens = estimateTokens(config.skill_content);
  const outputTokensEst = 1000; // ~1K output tokens estimate

  // A call (no system) + B call (with system)
  const aCost =
    (inputTokens * pricing.input + outputTokensEst * pricing.output) / 1_000_000;
  const bCost =
    ((inputTokens + systemTokens) * pricing.input +
      outputTokensEst * pricing.output) /
    1_000_000;

  // Judge calls (one per llm-judge assertion)
  const judgeAssertions = (task.assertions || []).filter(
    a => a.type === 'llm-judge'
  ).length;
  const judgeInputEst = inputTokens + outputTokensEst * 2 + 500; // rubric + A output + B output
  const judgeCost =
    judgeAssertions *
    ((judgeInputEst * judgePricing.input + 500 * judgePricing.output) /
      1_000_000);

  return (aCost + bCost + judgeCost) * config.runs;
}

function estimateTotalCost(config) {
  let total = 0;
  for (const task of config.tasks) {
    total += estimateTaskCost(task, config);
  }

  const totalCalls =
    config.tasks.length *
    config.runs *
    (2 +
      config.tasks.reduce(
        (sum, t) =>
          sum + (t.assertions || []).filter(a => a.type === 'llm-judge').length,
        0
      ) /
        config.tasks.length);

  return { estimatedCost: total, estimatedCalls: Math.ceil(totalCalls) };
}

function createTracker(costCap) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  return {
    add(usage, model) {
      const pricing = getPricing(model);
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;
      const cost =
        (usage.input_tokens * pricing.input +
          usage.output_tokens * pricing.output) /
        1_000_000;
      totalCostUsd += cost;
      return totalCostUsd;
    },

    get exceeded() {
      return costCap > 0 && totalCostUsd >= costCap;
    },

    get summary() {
      return {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_cost_usd: totalCostUsd,
      };
    },
  };
}

module.exports = {
  PRICING,
  FALLBACK_PRICING,
  getPricing,
  estimateTokens,
  estimateTaskCost,
  estimateTotalCost,
  createTracker,
};
