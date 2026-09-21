import type {
  DnssecChainResult,
  DnssecQueryObservation,
  DnssecRrset,
  DnssecVerdict,
  DnssecZone,
} from './types';

// Which outcome a completed check leads with. This is precedence policy over
// DNSSEC semantics -- what outranks what -- and belongs with the walk that
// produced the evidence, not with the copy that renders it.

/** RRsets worth showing: an absent type was probed and simply isn't there. */
export const visibleRrsets = (zone: DnssecZone | undefined): DnssecRrset[] =>
  (zone?.rrsets ?? []).filter((rrset) => rrset.status !== 'absent');

/** RRsets that exist but failed validation or could not be validated. */
const rrsetProblems = (zone: DnssecZone | undefined): DnssecRrset[] =>
  visibleRrsets(zone).filter((rrset) =>
    ['bogus', 'unsigned', 'unsupported'].includes(rrset.status),
  );

/** RRsets whose status could not be established at all. */
const rrsetUnchecked = (zone: DnssecZone | undefined): DnssecRrset[] =>
  visibleRrsets(zone).filter((rrset) => rrset.status === 'indeterminate');

const types = (rrsets: DnssecRrset[]): string[] =>
  rrsets.map((rrset) => rrset.type);

export const chainVerdict = (
  chain: DnssecChainResult,
  observation: DnssecQueryObservation,
): DnssecVerdict => {
  const leaf = chain.zones.at(-1);
  if (!leaf) return { kind: 'unknown' };

  // An observed nonexistence leads over a secure or unsigned chain. An
  // unregistered name under a signed TLD has no DS of its own, which otherwise
  // reads as an unsigned delegation and advises publishing a DS record for a
  // domain the authoritative servers say does not exist. A bogus chain
  // outranks it: an NXDOMAIN served under a broken link is itself
  // untrustworthy, so the break leads and the observation is appended.
  if (observation === 'unproved-nxdomain' && chain.status !== 'broken') {
    return { kind: 'nxdomain-unproved' };
  }

  if (chain.status === 'secure') {
    if (observation === 'unproved-nodata') return { kind: 'secure-nodata' };

    const problems = rrsetProblems(leaf);
    if (problems.length > 0) {
      return { kind: 'secure-rrset-problems', rrsetTypes: types(problems) };
    }
    const unchecked = rrsetUnchecked(leaf);
    if (unchecked.length > 0) {
      return { kind: 'secure-rrset-unchecked', rrsetTypes: types(unchecked) };
    }
    const validated = visibleRrsets(leaf).filter(
      (rrset) => rrset.status === 'secure',
    );
    if (validated.length > 0) {
      return {
        kind: 'secure-validated',
        validatedRrsetCount: validated.length,
      };
    }
    return { kind: 'secure' };
  }

  // Not secure, so the walk recorded where the chain ended.
  const breakAt = chain.breakAt;
  const breakZone = breakAt === undefined ? undefined : chain.zones[breakAt];
  if (!breakZone) return { kind: 'unknown' };

  if (breakZone.breakReason) {
    return { kind: 'break', reason: breakZone.breakReason };
  }

  // A break with no reason is an observed unsigned delegation: the parent
  // published no DS (the type rules out a reasonless bogus end, and a zone
  // below the break can never be the break itself). Serving no keys either, it
  // is plainly unsigned; with keys it is a signed zone nothing vouches for.
  if (breakZone.keys.length === 0) {
    return { kind: 'unsigned-cut', atLeaf: breakAt === chain.zones.length - 1 };
  }
  return { kind: 'no-authenticated-ds' };
};
