import { canonicalDnsName, type RecordType } from './base';

const MAX_RECURSION_DEPTH = 20;
// Caps distinct requests (name, type, nameserver) for one walk -- reusing
// one is free and bounded by the walk's step budget instead -- like BIND's
// max-recursion-queries: the depth cap alone still lets a crafted zone
// answer every glueless delegation with 4 fresh NS names and fork
// 4^depth sub-walks. One attempt costs up to 4 UDP tries plus a TCP
// fallback each (see the resolver's requestLoader/sendRequest), so this also
// caps the walk's packet ceiling at ~8x this value. Far above any honest
// lookup's needs (a deep all-glueless walk stays under ~30).
const MAX_CANDIDATES_PER_WALK = 50;
// Must exceed one candidate's full retry budget (4 attempts x 3s = ~12s):
// a single blackholed first server has to leave room to reach a healthy
// fallback, while all-blackholed candidates stay bounded (~2 budgets).
const FALLBACK_DEADLINE_MS = 15_000;

// Name case and a trailing dot don't make a request distinct.
const requestKey = (
  domain: string,
  recordType: RecordType,
  nameserver: string,
) => `${canonicalDnsName(domain)} ${recordType} ${nameserver}`;

type SharedState<Response, Result> = {
  deadlineAt: number;
  remaining: number;
  remainingSteps: number;
  requests: Map<string, Promise<Response>>;
  fallback?: Result;
};

// The state of one top-level authoritative walk and its rules. The deadline,
// request cap, step budget, sent requests and fallback are shared by every
// branch -- referrals and glueless sub-lookups inherit them -- so no
// delegation level can stack a fresh allowance. Depth and ancestry belong to
// one branch: each context is an immutable view of a branch, and deeper
// steps get derived ones.
//
// Reusing a sent request (including a rejection) consumes neither another
// slot nor packets. A new walk gets a fresh budget and can retry requests
// that rejected (transport failures); resolved responses, rcode failures
// included, stay cached by the resolver.
export class WalkContext<Response, Result> {
  private constructor(
    private readonly shared: SharedState<Response, Result>,
    private readonly depth: number,
    // Request keys ("name type nameserver") and NS-name keys ("NS name")
    // this branch descends from.
    private readonly ancestors: ReadonlySet<string>,
  ) {}

  // Runs one walk under a fresh context. A recorded fallback is adopted only
  // if the whole walk fails, so a sibling path that answers still wins.
  static async run<Response, Result>(
    walk: (context: WalkContext<Response, Result>) => Promise<Result>,
    fallbackDeadlineMs = FALLBACK_DEADLINE_MS,
  ): Promise<Result> {
    const context = new WalkContext<Response, Result>(
      {
        deadlineAt: Date.now() + fallbackDeadlineMs,
        remaining: MAX_CANDIDATES_PER_WALK,
        remainingSteps: MAX_CANDIDATES_PER_WALK * MAX_RECURSION_DEPTH,
        requests: new Map(),
      },
      0,
      new Set(),
    );
    try {
      return await walk(context);
    } catch (error) {
      if (context.shared.fallback) return context.shared.fallback;
      throw error;
    }
  }

  // Counts one step of the walk. Cached responses cost no packets, but a
  // crafted or misconfigured graph can still fork exponentially through
  // shared requests, so processing is bounded separately from requests.
  enter(domain: string, recordType: RecordType): void {
    if (this.shared.remainingSteps-- <= 0) {
      throw new Error(
        `DNS traversal budget exhausted while resolving ${domain}`,
      );
    }
    if (this.depth > MAX_RECURSION_DEPTH) {
      throw new Error(
        `Max recursion depth exceeded while resolving ${domain} (type ${recordType})`,
      );
    }
  }

  get hasStepsLeft(): boolean {
    return this.shared.remainingSteps > 0;
  }

  // Past the deadline, a step stops trying fallback nameservers.
  get pastDeadline(): boolean {
    return Date.now() >= this.shared.deadlineAt;
  }

  // Sends a request at most once per walk; a repeat shares the pending
  // response. 'loop' when this branch already descends from the same
  // request: a circular glueless dependency, whose replies are cached after a
  // round trip or two and then recurse in microtasks, is stopped before it
  // spends the step budget a slower sibling needs. 'exhausted' once the
  // walk's distinct-request cap is spent.
  send(
    domain: string,
    recordType: RecordType,
    nameserver: string,
    load: () => Promise<Response>,
  ): Promise<Response> | 'loop' | 'exhausted' {
    const key = requestKey(domain, recordType, nameserver);
    if (this.ancestors.has(key)) return 'loop';
    let pending = this.shared.requests.get(key);
    if (!pending) {
      if (this.shared.remaining <= 0) return 'exhausted';
      this.shared.remaining--;
      pending = load();
      this.shared.requests.set(key, pending);
    }
    return pending;
  }

  // Of `nameservers`, those this walk sent the request to.
  queried(
    domain: string,
    recordType: RecordType,
    nameservers: string[],
  ): string[] {
    return nameservers.filter((nameserver) =>
      this.shared.requests.has(requestKey(domain, recordType, nameserver)),
    );
  }

  // This branch, continuing from a response to the request.
  via(
    domain: string,
    recordType: RecordType,
    nameserver: string,
  ): WalkContext<Response, Result> {
    return this.branch(this.depth, requestKey(domain, recordType, nameserver));
  }

  // This branch, one delegation level down.
  deeper(): WalkContext<Response, Result> {
    return this.branch(this.depth + 1);
  }

  // A sub-walk resolving an NS hostname, one level down. An NS name already
  // being resolved further up this branch is a circular dependency whichever
  // servers it goes through, so it is stopped once rather than once per
  // server ordering.
  resolvingNs(name: string): WalkContext<Response, Result> {
    const key = `NS ${canonicalDnsName(name)}`;
    if (this.ancestors.has(key)) {
      throw new Error(`circular NS dependency (${name})`);
    }
    return this.branch(this.depth + 1, key);
  }

  // The first fallback offered anywhere in the walk is kept; see run.
  // ponytail: callers build a fallback even once one is kept and it is
  // dropped here; that is a few strings per failed NS referral. Expose a
  // check first if building one ever gets expensive.
  offerFallback(result: Result): void {
    this.shared.fallback ??= result;
  }

  private branch(depth: number, ancestor?: string) {
    return new WalkContext(
      this.shared,
      depth,
      ancestor ? new Set([...this.ancestors, ancestor]) : this.ancestors,
    );
  }
}
