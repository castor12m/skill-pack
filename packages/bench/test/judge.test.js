'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateContains,
  parseScore,
  parseJudgeResponse,
  buildJudgePrompt,
  evaluateAssertions,
} = require('../lib/judge');

describe('evaluateContains', () => {
  it('passes when substring present', () => {
    const r = evaluateContains('hello world', 'world');
    assert.ok(r.pass);
  });

  it('fails when substring absent', () => {
    const r = evaluateContains('hello world', 'foo');
    assert.ok(!r.pass);
  });

  it('is case-sensitive', () => {
    const r = evaluateContains('Hello', 'hello');
    assert.ok(!r.pass);
  });
});

describe('parseScore', () => {
  it('parses SCORE: N format', () => {
    assert.equal(parseScore('Good response. SCORE: 4'), 4);
  });

  it('parses lowercase score:', () => {
    assert.equal(parseScore('score: 3'), 3);
  });

  it('clamps score > 5 to 5', () => {
    assert.equal(parseScore('SCORE: 8'), 5);
  });

  it('returns null for no number', () => {
    assert.equal(parseScore('I cannot evaluate this.'), null);
  });

  it('falls back to standalone number 1-5', () => {
    assert.equal(parseScore('The quality is 4 out of 5'), 5); // last match wins
  });

  it('uses last standalone number as fallback', () => {
    assert.equal(parseScore('I give this a 3. Actually, 5.'), 5);
  });
});

describe('parseJudgeResponse', () => {
  it('parses SCORE_A and SCORE_B', () => {
    const r = parseJudgeResponse('Good.\nSCORE_A: 2\nSCORE_B: 4');
    assert.equal(r.score_a, 2);
    assert.equal(r.score_b, 4);
  });

  it('returns null for missing scores', () => {
    const r = parseJudgeResponse('I refuse to judge.');
    assert.equal(r.score_a, null);
    assert.equal(r.score_b, null);
  });

  it('clamps out-of-range scores', () => {
    const r = parseJudgeResponse('SCORE_A: 0\nSCORE_B: 7');
    assert.equal(r.score_a, 1);
    assert.equal(r.score_b, 5);
  });

  it('extracts reasoning before scores', () => {
    const r = parseJudgeResponse('B is clearly better.\nSCORE_A: 2\nSCORE_B: 5');
    assert.ok(r.reasoning.includes('clearly better'));
  });
});

describe('buildJudgePrompt', () => {
  it('includes rubric and responses', () => {
    const prompt = buildJudgePrompt('Score 1-5', 'Response A', 'Response B', 'task desc');
    assert.ok(prompt.includes('Score 1-5'));
    assert.ok(prompt.includes('Response A'));
    assert.ok(prompt.includes('Response B'));
    assert.ok(prompt.includes('task desc'));
    assert.ok(prompt.includes('SCORE_A'));
    assert.ok(prompt.includes('SCORE_B'));
  });

  it('uses XML delimiters', () => {
    const prompt = buildJudgePrompt('r', 'a', 'b', 'd');
    assert.ok(prompt.includes('<response_a>'));
    assert.ok(prompt.includes('</response_a>'));
    assert.ok(prompt.includes('<response_b>'));
  });
});

describe('evaluateAssertions', () => {
  it('evaluates contains assertions', () => {
    const results = evaluateAssertions('hello world', [
      { type: 'contains', value: 'hello' },
      { type: 'contains', value: 'missing' },
    ]);
    assert.equal(results.length, 2);
    assert.ok(results[0].pass);
    assert.ok(!results[1].pass);
  });

  it('skips llm-judge assertions (handled separately)', () => {
    const results = evaluateAssertions('hello', [
      { type: 'llm-judge', rubric: 'score' },
    ]);
    assert.equal(results.length, 0);
  });

  it('returns empty for no assertions', () => {
    const results = evaluateAssertions('hello', []);
    assert.equal(results.length, 0);
  });
});
