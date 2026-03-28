'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { run, buildUserPrompt } = require('../lib/runner');
const { createTracker } = require('../lib/cost');

function mockClientModule(responses = {}) {
  let callCount = 0;
  return {
    instance: {},
    call: async (_instance, params) => {
      callCount++;
      const key = params.system ? 'b' : 'a';
      const resp = responses[key] || { text: `mock-${key}-response`, usage: { input_tokens: 10, output_tokens: 20 } };
      return resp;
    },
    get callCount() { return callCount; },
  };
}

describe('buildUserPrompt', () => {
  it('returns user prompt alone', () => {
    const prompt = buildUserPrompt({ user: 'test', context_files: [] });
    assert.equal(prompt, 'test');
  });

  it('appends context files', () => {
    const prompt = buildUserPrompt({
      user: 'review',
      context_files: [{ path: '/tmp/code.py', content: 'print("hi")' }],
    });
    assert.ok(prompt.includes('review'));
    assert.ok(prompt.includes('print("hi")'));
    assert.ok(prompt.includes('<context'));
  });
});

describe('run', () => {
  it('runs tasks and returns results', async () => {
    const client = mockClientModule();
    const config = {
      model: 'test-model',
      skill_content: 'test skill',
      runs: 1,
      concurrency: 1,
      tasks: [
        { name: 't1', user: 'hello', context_files: [], assertions: [] },
      ],
    };
    const tracker = createTracker(100);
    const results = await run(config, client, { costTracker: tracker });

    assert.equal(results.length, 1);
    assert.equal(results[0].name, 't1');
    assert.equal(results[0].status, 'completed');
    assert.equal(client.callCount, 2); // A + B
  });

  it('runs multiple tasks with concurrency', async () => {
    const client = mockClientModule();
    const config = {
      model: 'test-model',
      skill_content: 'skill',
      runs: 1,
      concurrency: 3,
      tasks: [
        { name: 't1', user: 'a', context_files: [], assertions: [] },
        { name: 't2', user: 'b', context_files: [], assertions: [] },
        { name: 't3', user: 'c', context_files: [], assertions: [] },
      ],
    };
    const tracker = createTracker(100);
    const results = await run(config, client, { costTracker: tracker });

    assert.equal(results.length, 3);
    assert.equal(client.callCount, 6); // 3 tasks × 2 (A+B)
  });

  it('multiplies tasks by runs', async () => {
    const client = mockClientModule();
    const config = {
      model: 'test-model',
      skill_content: 'skill',
      runs: 2,
      concurrency: 1,
      tasks: [
        { name: 't1', user: 'a', context_files: [], assertions: [] },
      ],
    };
    const tracker = createTracker(100);
    const results = await run(config, client, { costTracker: tracker });

    assert.equal(results.length, 2);
    assert.equal(client.callCount, 4); // 1 task × 2 runs × 2 (A+B)
  });

  it('handles task error gracefully', async () => {
    let callNum = 0;
    const client = {
      instance: {},
      call: async () => {
        callNum++;
        if (callNum === 1) throw Object.assign(new Error('timeout'), { status: 408 });
        return { text: 'ok', usage: { input_tokens: 1, output_tokens: 1 } };
      },
    };
    const config = {
      model: 'test-model',
      skill_content: 'skill',
      runs: 1,
      concurrency: 1,
      tasks: [
        { name: 'fail-task', user: 'x', context_files: [], assertions: [] },
        { name: 'ok-task', user: 'y', context_files: [], assertions: [] },
      ],
    };
    const tracker = createTracker(100);
    const results = await run(config, client, { costTracker: tracker });

    assert.equal(results.length, 2);
    const failResult = results.find(r => r.name === 'fail-task');
    const okResult = results.find(r => r.name === 'ok-task');
    assert.equal(failResult.status, 'error');
    assert.equal(okResult.status, 'completed');
  });

  it('stops when cost cap exceeded', async () => {
    const client = mockClientModule();
    const config = {
      model: 'claude-opus-4-20250115', // expensive model
      skill_content: 'skill',
      runs: 1,
      concurrency: 1,
      tasks: [
        { name: 't1', user: 'a', context_files: [], assertions: [] },
        { name: 't2', user: 'b', context_files: [], assertions: [] },
        { name: 't3', user: 'c', context_files: [], assertions: [] },
      ],
    };
    const tracker = createTracker(0.000001); // extremely low cap
    const results = await run(config, client, { costTracker: tracker });

    // Should have stopped early
    assert.ok(results.length < 3);
    assert.ok(tracker.exceeded);
  });

  it('calls onProgress', async () => {
    const client = mockClientModule();
    const config = {
      model: 'test-model',
      skill_content: 'skill',
      runs: 1,
      concurrency: 1,
      tasks: [{ name: 't1', user: 'a', context_files: [], assertions: [] }],
    };
    const tracker = createTracker(100);
    const progress = [];
    await run(config, client, {
      costTracker: tracker,
      onProgress: p => progress.push(p),
    });

    assert.equal(progress.length, 1);
    assert.equal(progress[0].completed, 1);
    assert.equal(progress[0].total, 1);
  });
});
