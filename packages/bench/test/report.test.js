'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { median, aggregateResults, formatTable, formatJson } = require('../lib/report');

describe('median', () => {
  it('returns middle value for odd count', () => {
    assert.equal(median([3, 5, 7]), 5);
  });

  it('returns average of middle values for even count', () => {
    assert.equal(median([3, 5]), 4);
  });

  it('returns single value', () => {
    assert.equal(median([4]), 4);
  });

  it('returns null for empty array', () => {
    assert.equal(median([]), null);
  });

  it('filters out null values', () => {
    assert.equal(median([null, 3, null, 5, null]), 4);
  });

  it('sorts numerically not lexicographically', () => {
    assert.equal(median([10, 2, 30]), 10);
  });
});

describe('aggregateResults', () => {
  it('groups by task name', () => {
    const results = [
      {
        name: 'task1',
        status: 'completed',
        run_index: 0,
        assertions_a: [{ pass: true }],
        assertions_b: [{ pass: true }],
        judge_results: [{ score_a: 2, score_b: 4 }],
      },
      {
        name: 'task1',
        status: 'completed',
        run_index: 1,
        assertions_a: [{ pass: true }],
        assertions_b: [{ pass: false }],
        judge_results: [{ score_a: 3, score_b: 5 }],
      },
    ];
    const summary = aggregateResults(results);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].name, 'task1');
    assert.equal(summary[0].runs, 2);
    assert.equal(summary[0].score_a, 2.5); // median of [2,3]
    assert.equal(summary[0].score_b, 4.5); // median of [4,5]
  });

  it('handles error results', () => {
    const results = [
      { name: 'fail', status: 'error', error: 'timeout', run_index: 0 },
    ];
    const summary = aggregateResults(results);
    assert.equal(summary[0].errors, 1);
    assert.equal(summary[0].score_a, null);
  });
});

describe('formatTable', () => {
  it('produces table with header and data', () => {
    const summary = [
      {
        name: 'test-task',
        runs: 1,
        completed: 1,
        errors: 0,
        score_a: 2.0,
        score_b: 4.0,
        delta: 2.0,
        contains_a: '1/1',
        contains_b: '1/1',
      },
    ];
    const table = formatTable(summary, { input_tokens: 100, output_tokens: 50, total_cost_usd: 0.01 });
    assert.ok(table.includes('Task'));
    assert.ok(table.includes('test-task'));
    assert.ok(table.includes('Vanilla'));
    assert.ok(table.includes('Skill'));
    assert.ok(table.includes('+2.0'));
    assert.ok(table.includes('$0.0100'));
  });
});

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const summary = [{ name: 'x', score_a: 1, score_b: 2 }];
    const cost = { input_tokens: 0, output_tokens: 0, total_cost_usd: 0 };
    const json = formatJson(summary, cost);
    const parsed = JSON.parse(json);
    assert.equal(parsed.tasks.length, 1);
    assert.ok(parsed.cost !== undefined);
  });
});
