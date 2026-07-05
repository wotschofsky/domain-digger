import { describe, expect, it } from 'vitest';

import { dnskeyToPublicKey } from './crypto';
import { genKey } from './test-helpers';
import { ROOT_DNSKEYS, WSKY_DNSKEYS } from './test-vectors';

describe('dnskeyToPublicKey', () => {
  it('reconstructs RSA, ECDSA, and Ed25519 keys', () => {
    expect(dnskeyToPublicKey(8, ROOT_DNSKEYS[1].key)).not.toBeNull(); // RSA
    expect(dnskeyToPublicKey(13, WSKY_DNSKEYS[0].key)).not.toBeNull(); // ECDSA
    expect(dnskeyToPublicKey(15, genKey(15).dnskey.key)).not.toBeNull(); // Ed25519
  });

  it('returns null for unknown or malformed keys', () => {
    expect(dnskeyToPublicKey(99, Buffer.alloc(10))).toBeNull(); // unknown alg
    expect(dnskeyToPublicKey(13, Buffer.alloc(10))).toBeNull(); // wrong EC size
    expect(dnskeyToPublicKey(8, Buffer.alloc(0))).toBeNull(); // empty RSA
  });
});
