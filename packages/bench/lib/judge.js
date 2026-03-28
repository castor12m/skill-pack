'use strict';

class JudgeParseError extends Error {
  constructor(reason, raw) {
    super(`Judge parse failed: ${reason}`);
    this.name = 'JudgeParseError';
    this.reason = reason;
    this.raw = raw;
  }
}

function evaluateContains(response, value) {
  const pass = response.includes(value);
  return { type: 'contains', value, pass, detail: pass ? 'found' : 'not found' };
}

function parseScore(text) {
  // Try SCORE: N format first
  const scoreMatch = text.match(/SCORE:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (scoreMatch) {
    const score = parseFloat(scoreMatch[1]);
    if (score >= 1 && score <= 5) return score;
    if (score > 5) return 5; // clamp
    if (score < 1 && score > 0) return 1; // clamp
  }

  // Fallback: find any standalone number 1-5
  const numbers = text.match(/\b([1-5])\b/g);
  if (numbers && numbers.length > 0) {
    // Use last occurrence (likely the final verdict)
    return parseInt(numbers[numbers.length - 1], 10);
  }

  return null;
}

function buildJudgePrompt(rubric, responseA, responseB, taskDescription) {
  return `You are an expert evaluator comparing two AI responses to the same task.

<task_description>
${taskDescription}
</task_description>

<rubric>
${rubric}
</rubric>

<response_a>
${responseA}
</response_a>

<response_b>
${responseB}
</response_b>

Evaluate both responses according to the rubric above.
First, briefly explain your reasoning (2-3 sentences).
Then provide your final scores in this exact format:

SCORE_A: [1-5]
SCORE_B: [1-5]`;
}

function parseJudgeResponse(text) {
  const scoreAMatch = text.match(/SCORE_A:\s*([0-9]+(?:\.[0-9]+)?)/i);
  const scoreBMatch = text.match(/SCORE_B:\s*([0-9]+(?:\.[0-9]+)?)/i);

  const scoreA = scoreAMatch ? parseFloat(scoreAMatch[1]) : null;
  const scoreB = scoreBMatch ? parseFloat(scoreBMatch[1]) : null;

  // Clamp to 1-5
  const clamp = s => {
    if (s === null) return null;
    if (s < 1) return 1;
    if (s > 5) return 5;
    return Math.round(s);
  };

  return {
    score_a: clamp(scoreA),
    score_b: clamp(scoreB),
    reasoning: text.split(/SCORE_[AB]:/i)[0].trim(),
    raw: text,
  };
}

async function evaluateLlmJudge(client, config, task, responseA, responseB, assertion) {
  const judgeModel = (config.judge && config.judge.model) || config.model;
  const rubric = assertion.rubric;

  const prompt = buildJudgePrompt(rubric, responseA, responseB, task.user);

  const result = await client.call(client.instance, {
    model: judgeModel,
    user: prompt,
    maxTokens: 1024,
    temperature: 0,
  });

  const parsed = parseJudgeResponse(result.text);

  if (parsed.score_a === null || parsed.score_b === null) {
    return {
      type: 'llm-judge',
      pass: false,
      score_a: parsed.score_a,
      score_b: parsed.score_b,
      reasoning: parsed.reasoning,
      error: 'JUDGE_PARSE_FAILED',
      usage: result.usage,
    };
  }

  const minScore = assertion.min_score || 1;
  const pass = parsed.score_b >= minScore;

  return {
    type: 'llm-judge',
    pass,
    score_a: parsed.score_a,
    score_b: parsed.score_b,
    delta: parsed.score_b - parsed.score_a,
    reasoning: parsed.reasoning,
    min_score: minScore,
    usage: result.usage,
  };
}

function evaluateAssertions(response, assertions) {
  const results = [];
  for (const a of assertions) {
    if (a.type === 'contains') {
      results.push(evaluateContains(response, a.value));
    }
    // llm-judge handled separately (async)
  }
  return results;
}

module.exports = {
  evaluateContains,
  parseScore,
  buildJudgePrompt,
  parseJudgeResponse,
  evaluateLlmJudge,
  evaluateAssertions,
  JudgeParseError,
};
