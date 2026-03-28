'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { estimateTokens, getPricing, estimateTotalCost, createTracker, FALLBACK_PRICING } = require('../lib/cost');

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    assert.equal(estimateTokens('hello world'), 3); // 11 chars / 4 = 2.75 → ceil 3
  });

  it('returns 0 for empty string', () => {
    assert.equal(estimateTokens(''), 0);
  });

  it('returns 0 for null', () => {
    assert.equal(estimateTokens(null), 0);
  });
});

describe('getPricing', () => {
  it('returns known model pricing', () => {
    const p = getPricing('claude-sonnet-4-20250514');
    assert.equal(p.input, 3.0);
    assert.equal(p.output, 15.0);
  });

  it('returns fallback for unknown model', () => {
    const p = getPricing('unknown-model-v99');
    assert.deepEqual(p, FALLBACK_PRICING);
  });
});

describe('estimateTotalCost', () => {
  it('estimates cost for simple config', () => {
    const config = {
      model: 'claude-sonnet-4-20250514',
      skill_content: 'Do review.',
      runs: 1,
      tasks: [
        {
          user: 'Review this code',
          context_files: [],
          assertions: [{ type: 'llm-judge', rubric: 'score 1-5' }],
        },
      ],
    };
    const { estimatedCost, estimatedCalls } = estimateTotalCost(config);
    assert.ok(estimatedCost > 0);
    assert.ok(estimatedCalls >= 3); // A + B + judge
  });

  it('multiplies by runs', () => {
    const config = {
      model: 'claude-sonnet-4-20250514',
      skill_content: 'x',
      runs: 3,
      tasks: [{ user: 'test', context_files: [], assertions: [] }],
    };
    const r1 = estimateTotalCost({ ...config, runs: 1 });
    const r3 = estimateTotalCost(config);
    assert.ok(r3.estimatedCost > r1.estimatedCost);
  });
});

describe('createTracker', () => {
  it('tracks cost', () => {
    const tracker = createTracker(10.0);
    tracker.add({ input_tokens: 1000, output_tokens: 500 }, 'claude-sonnet-4-20250514');
    assert.ok(tracker.summary.total_cost_usd > 0);
    assert.equal(tracker.summary.input_tokens, 1000);
    assert.equal(tracker.summary.output_tokens, 500);
  });

  it('detects cost cap exceeded', () => {
    const tracker = createTracker(0.001); // very low cap
    tracker.add({ input_tokens: 100000, output_tokens: 100000 }, 'claude-opus-4-20250115');
    assert.ok(tracker.exceeded);
  });

  it('does not exceed with high cap', () => {
    const tracker = createTracker(1000);
    tracker.add({ input_tokens: 100, output_tokens: 50 }, 'claude-sonnet-4-20250514');
    assert.ok(!tracker.exceeded);
  });
});
