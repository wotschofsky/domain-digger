import { describe, expect, it, vi } from 'vitest';

import { WalkContext } from './walk-context';

type Walk = WalkContext<string, string>;

const run = (walk: (context: Walk) => Promise<string>, deadlineMs?: number) =>
  WalkContext.run<string, string>(walk, deadlineMs);

describe('WalkContext', () => {
  it('bounds the walk by steps and by depth', async () => {
    await run(async (walk) => {
      for (let i = 0; i < 1000; i++) walk.enter('example.com', 'A');
      expect(walk.hasStepsLeft).toBe(false);
      expect(() => walk.enter('example.com', 'A')).toThrow(
        'DNS traversal budget exhausted while resolving example.com',
      );
      return '';
    });

    await run(async (walk) => {
      let deep = walk;
      for (let i = 0; i < 20; i++) deep = deep.deeper();
      deep.enter('example.com', 'A');
      expect(() => deep.deeper().enter('example.com', 'A')).toThrow(
        'Max recursion depth exceeded while resolving example.com (type A)',
      );
      return '';
    });
  });

  it('sends each distinct request once, up to the request cap', async () => {
    await run(async (walk) => {
      const load = vi.fn(async () => 'response');
      const first = walk.send('Example.com.', 'A', '192.0.2.1', load);
      for (let i = 2; i <= 50; i++) {
        walk.send('example.com', 'A', `192.0.2.${i}`, load);
      }
      expect(walk.send('example.com', 'A', '192.0.2.51', load)).toBe(
        'exhausted',
      );
      // A repeat shares the pending response and costs nothing, even past the
      // cap and from another branch.
      expect(walk.deeper().send('example.com', 'A', '192.0.2.1', load)).toBe(
        first,
      );
      expect(load).toHaveBeenCalledTimes(50);
      expect(
        walk.queried('example.com', 'A', ['192.0.2.1', '192.0.2.51']),
      ).toEqual(['192.0.2.1']);
      return '';
    });
  });

  it('detects request and NS-name cycles only within a branch', async () => {
    await run(async (walk) => {
      const load = async () => 'response';
      const branch = walk.via('example.com', 'A', '192.0.2.1').deeper();
      expect(branch.send('EXAMPLE.com', 'A', '192.0.2.1', load)).toBe('loop');
      expect(walk.send('example.com', 'A', '192.0.2.1', load)).not.toBe('loop');

      const nsBranch = walk.resolvingNs('ns1.example.net');
      expect(() => nsBranch.deeper().resolvingNs('NS1.example.net.')).toThrow(
        'circular NS dependency (NS1.example.net.)',
      );
      expect(() => walk.resolvingNs('ns1.example.net')).not.toThrow();
      return '';
    });
  });

  it('adopts the first fallback offered, only if the walk fails', async () => {
    await expect(
      run(async (walk) => {
        walk.offerFallback('parent delegation');
        walk.deeper().offerFallback('later delegation');
        throw new Error('walk failed');
      }),
    ).resolves.toBe('parent delegation');

    await expect(
      run(async (walk) => {
        walk.offerFallback('parent delegation');
        return 'answer';
      }),
    ).resolves.toBe('answer');

    await expect(
      run(async () => {
        throw new Error('walk failed');
      }),
    ).rejects.toThrow('walk failed');
  });

  it('shares one deadline across the walk', async () => {
    await run(async (walk) => {
      expect(walk.pastDeadline).toBe(false);
      return '';
    });
    await run(async (walk) => {
      expect(walk.deeper().pastDeadline).toBe(true);
      return '';
    }, 0);
  });
});
