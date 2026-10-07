# Lunar domain exposure

Implements [Issue #107](https://github.com/wotschofsky/domain-digger/issues/107).

The Exposure tab uses the existing `LOOKUP_FEATURES` registry, result routes,
error boundary and lookup logging. `/exposure` is the corresponding search
landing page. Ordinary domain lookups, link prefetching and sitemap URLs never
query Lunar: the result page requires the explicit **Check exposure** GET form
(`?run=1`). The form explains that the domain is sent to Lunar.

`lib/lunar.ts` calls the fixed HTTPS endpoint without credentials. It normalizes
case, trailing dots and internationalized names, rejects invalid names,
wildcards and bare TLDs, and preserves the requested subdomain rather than
silently broadening it to the registrable domain.

Zod validates the documented envelope, summary and optional malware, service,
OS and antivirus breakdowns. Unknown additions are stripped; malformed consumed
fields, unknown statuses and mismatched domain/period metadata are errors.
`GENERATING_REPORT` is distinct from a ready report with zero events.
`NOT_AUTHORIZED` produces a non-retryable domain-specific message.

Ready reports are cached for one hour in a bounded process-local FIFO cache
(128 domains). Concurrent requests for the same normalized name share a promise.
Pending reports and failures are not cached. Cache state is not shared between
serverless instances and is lost on cold starts. Raw fetch uses `no-store` so
invalid responses cannot enter Next.js's data cache. An eight-second abort
deadline covers the request and response body. Network/schema errors and HTTP
408/429/5xx are retryable; other HTTP failures are not. There is no automatic
retry or polling loop; pending reports can be checked again manually.

Only ready reports are logged as completed lookups. Event counts do not imply
unique affected people or establish that the domain's own systems were breached.

## Upstream contract

- [Endpoint and parameters](https://docs.webz.io/docs/webz/dea-api-reference)
- [Response fields and statuses](https://docs.webz.io/docs/webz/dea-response-fields)
- [Definitions and terms](https://docs.webz.io/docs/webz/dea-introduction)

No new dependency or API token is required. Tests use synthetic responses and
mocked fetch; they do not make external requests.
