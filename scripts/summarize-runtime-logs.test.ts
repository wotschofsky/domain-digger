// @vitest-environment node
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { summarizeRuntimeLogs } from './summarize-runtime-logs.mjs';

describe('runtime log aggregation', () => {
  it('deduplicates requests, repeated events and timeouts in an exported request', () => {
    const event = JSON.stringify({
      message: 'lookup_stage_completed',
      operation: 'dnssec_summary',
      durationMs: 100,
    });

    const row = {
      id: 'request-1',
      timestamp: 1,
      requestPath: '/api/domain-summary',
      message: event,
      logs: [
        { message: event },
        { message: JSON.stringify({ message: 'whois_summary_failed' }) },
      ],
    };

    const timeout = {
      id: 'request-2',
      timestamp: 2,
      requestPath: '/lookup/example.com/subdomains',
      message: 'Vercel Runtime Timeout Error: Task timed out after 15 seconds',
      logs: [
        {
          message:
            'Vercel Runtime Timeout Error: Task timed out after 15 seconds',
        },
      ],
    };

    const result = summarizeRuntimeLogs([row, row, timeout]);
    expect(result.uniqueRequests).toBe(2);

    expect(result.requestsWithEvent).toMatchObject({
      lookup_stage_completed: 1,
      whois_summary_failed: 1,
    });

    expect(result.platformTimeoutsByFeature).toEqual({ subdomains: 1 });

    expect(result.stageDurations.dnssec_summary).toEqual({
      samples: 1,
      p50Ms: 100,
      p95Ms: 100,
    });
  });

  it('accepts JSONL on stdin and labels counts without claiming a failure rate', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/summarize-runtime-logs.mjs'],
      {
        input:
          JSON.stringify({ id: 'request-1', timestamp: 0, logs: [] }) + '\n',
        encoding: 'utf8',
      },
    );

    expect(JSON.parse(output)).toMatchObject({
      uniqueRequests: 1,
      coverage: expect.stringContaining('Counts only'),
    });
  });
});
