'use strict';

function median(values) {
  const sorted = values.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function aggregateResults(results) {
  // Group by task name
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.name]) grouped[r.name] = [];
    grouped[r.name].push(r);
  }

  const summary = [];
  for (const [name, runs] of Object.entries(grouped)) {
    const completedRuns = runs.filter(r => r.status === 'completed');
    const errorRuns = runs.filter(r => r.status === 'error');

    // Aggregate judge scores across runs
    const scoresA = [];
    const scoresB = [];
    for (const run of completedRuns) {
      for (const jr of run.judge_results || []) {
        if (jr.score_a !== null && jr.score_a !== undefined) scoresA.push(jr.score_a);
        if (jr.score_b !== null && jr.score_b !== undefined) scoresB.push(jr.score_b);
      }
    }

    // Aggregate contains assertions
    const containsPassA = completedRuns.reduce(
      (sum, r) => sum + (r.assertions_a || []).filter(a => a.pass).length,
      0
    );
    const containsPassB = completedRuns.reduce(
      (sum, r) => sum + (r.assertions_b || []).filter(a => a.pass).length,
      0
    );
    const containsTotal = completedRuns.reduce(
      (sum, r) => sum + (r.assertions_a || []).length,
      0
    );

    const medianA = median(scoresA);
    const medianB = median(scoresB);

    summary.push({
      name,
      runs: runs.length,
      completed: completedRuns.length,
      errors: errorRuns.length,
      score_a: medianA,
      score_b: medianB,
      delta: medianA !== null && medianB !== null ? medianB - medianA : null,
      contains_a: containsTotal > 0 ? `${containsPassA}/${containsTotal}` : '-',
      contains_b: containsTotal > 0 ? `${containsPassB}/${containsTotal}` : '-',
    });
  }

  return summary;
}

function formatTable(summary, costSummary) {
  const lines = [];

  // Header
  const cols = {
    task: 'Task',
    score_a: 'Vanilla',
    score_b: 'Skill',
    delta: 'Delta',
    contains_a: 'Assert A',
    contains_b: 'Assert B',
    status: 'Status',
  };

  // Calculate column widths
  const widths = {};
  for (const key of Object.keys(cols)) {
    widths[key] = cols[key].length;
  }
  for (const row of summary) {
    widths.task = Math.max(widths.task, row.name.length);
    widths.score_a = Math.max(widths.score_a, fmtScore(row.score_a).length);
    widths.score_b = Math.max(widths.score_b, fmtScore(row.score_b).length);
    widths.delta = Math.max(widths.delta, fmtDelta(row.delta).length);
    widths.contains_a = Math.max(widths.contains_a, row.contains_a.length);
    widths.contains_b = Math.max(widths.contains_b, row.contains_b.length);
    widths.status = Math.max(widths.status, fmtStatus(row).length);
  }

  // Header line
  lines.push(
    cols.task.padEnd(widths.task) +
      '  ' +
      cols.score_a.padEnd(widths.score_a) +
      '  ' +
      cols.score_b.padEnd(widths.score_b) +
      '  ' +
      cols.delta.padEnd(widths.delta) +
      '  ' +
      cols.contains_a.padEnd(widths.contains_a) +
      '  ' +
      cols.contains_b.padEnd(widths.contains_b) +
      '  ' +
      cols.status
  );

  // Separator
  lines.push(
    '\u2500'.repeat(widths.task) +
      '  ' +
      '\u2500'.repeat(widths.score_a) +
      '  ' +
      '\u2500'.repeat(widths.score_b) +
      '  ' +
      '\u2500'.repeat(widths.delta) +
      '  ' +
      '\u2500'.repeat(widths.contains_a) +
      '  ' +
      '\u2500'.repeat(widths.contains_b) +
      '  ' +
      '\u2500'.repeat(widths.status)
  );

  // Data rows
  for (const row of summary) {
    lines.push(
      row.name.padEnd(widths.task) +
        '  ' +
        fmtScore(row.score_a).padEnd(widths.score_a) +
        '  ' +
        fmtScore(row.score_b).padEnd(widths.score_b) +
        '  ' +
        fmtDelta(row.delta).padEnd(widths.delta) +
        '  ' +
        row.contains_a.padEnd(widths.contains_a) +
        '  ' +
        row.contains_b.padEnd(widths.contains_b) +
        '  ' +
        fmtStatus(row)
    );
  }

  // Summary
  const allScoresA = summary.map(s => s.score_a).filter(s => s !== null);
  const allScoresB = summary.map(s => s.score_b).filter(s => s !== null);
  const overallA = median(allScoresA);
  const overallB = median(allScoresB);
  const overallDelta =
    overallA !== null && overallB !== null ? overallB - overallA : null;

  lines.push(
    '\u2500'.repeat(widths.task) +
      '  ' +
      '\u2500'.repeat(widths.score_a) +
      '  ' +
      '\u2500'.repeat(widths.score_b) +
      '  ' +
      '\u2500'.repeat(widths.delta) +
      '  ' +
      '\u2500'.repeat(widths.contains_a) +
      '  ' +
      '\u2500'.repeat(widths.contains_b) +
      '  ' +
      '\u2500'.repeat(widths.status)
  );

  lines.push(
    'MEDIAN'.padEnd(widths.task) +
      '  ' +
      fmtScore(overallA).padEnd(widths.score_a) +
      '  ' +
      fmtScore(overallB).padEnd(widths.score_b) +
      '  ' +
      fmtDelta(overallDelta).padEnd(widths.delta)
  );

  // Cost line
  if (costSummary) {
    lines.push('');
    lines.push(
      `Tokens: ${costSummary.input_tokens} in / ${costSummary.output_tokens} out  |  Cost: $${costSummary.total_cost_usd.toFixed(4)}`
    );
  }

  // Win summary
  const wins = summary.filter(s => s.delta !== null && s.delta > 0).length;
  const ties = summary.filter(s => s.delta !== null && s.delta === 0).length;
  const losses = summary.filter(s => s.delta !== null && s.delta < 0).length;
  lines.push(`\nSkill wins: ${wins}  |  Ties: ${ties}  |  Vanilla wins: ${losses}`);

  return lines.join('\n');
}

function formatJson(summary, costSummary) {
  return JSON.stringify({ tasks: summary, cost: costSummary }, null, 2);
}

function fmtScore(s) {
  return s !== null && s !== undefined ? s.toFixed(1) : 'ERR';
}

function fmtDelta(d) {
  if (d === null || d === undefined) return '-';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}`;
}

function fmtStatus(row) {
  if (row.errors > 0) return `\u2717 ${row.errors} err`;
  if (row.delta !== null && row.delta > 0) return '\u2713 skill wins';
  if (row.delta !== null && row.delta < 0) return '\u2717 vanilla wins';
  if (row.delta !== null && row.delta === 0) return '= tie';
  return '-';
}

module.exports = { median, aggregateResults, formatTable, formatJson };
