# Verifying lookup reliability

Compare fixed UTC windows before and after a deployment. Record the deployment
commit and effective platform maximum duration. The subdomain and certificate
changes request 60 seconds; the DNSSEC walk keeps a 12-second application budget.
Verify the emitted deployment configuration rather than relying on a dashboard
setting alone.

Export **all levels** of production request logs with `vercel logs --environment
production --since <start> --until <end> --limit 1000 --json`. If a query reaches
1,000 rows, split its time window and export every smaller window. Record the
requested boundaries separately: the first and last observed requests do not
prove complete coverage. Keep raw exports outside the repository.

Feed concatenated JSONL exports into `node scripts/summarize-runtime-logs.mjs`.
The script deduplicates request IDs, counts each named event once per request,
counts platform timeouts independently of HTTP status, and reports stage latency
percentiles without double-counting repeated message/log entries. It deliberately
does not calculate failure rates from potentially filtered or truncated exports.

A request-level `info` can contain a nested WHOIS warning. Search embedded events,
not just the outer severity. A streaming page can send HTTP 200 before a platform
timeout, so HTTP status alone is insufficient. Browser boundary reports arrive
through separate ingest requests; do not add them to server failures. Correlate
using page, digest, timestamp, and browser/server deployment, where available.

`lookup_stage_completed` means a promise returned. Registration can still be
`unknown`, and DNSSEC can still be `unavailable`: use the domain-summary event's
returned states to measure data availability. Use `subdomains_lookup_completed`
and `certificate_lookup_completed` to distinguish full, partial and timed-out
work. Compare human and bot traffic and cache outcomes separately before
interpreting changes in completion rates or latency. Check compute usage too.

Expected checks after deployment:

- Subdomain/certificate platform terminations fall; partial results are labelled.
- No DNS work continues after the DNSSEC cancellation deadline.
- WHOIS outages leave the DNSSEC delegation tile usable.
- RDAP improves registration-data availability without converting outages into
  unregistered results.
- Remaining React connection-closed reports can be traced to their originating
  browser deployment and page, then compared with server failures.

A larger timeout is mitigation, not evidence that an upstream now finishes.
