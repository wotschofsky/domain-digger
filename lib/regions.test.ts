import { describe, expect, it } from 'vitest';

import vercelConfig from '../vercel.json';
import { REGIONS } from './data';

const functions: Record<string, { regions?: string[] }> =
  vercelConfig.functions;

describe('vercel.json', () => {
  it.each(Object.keys(REGIONS))(
    'pins the %s resolve route to its Vercel region',
    (code) => {
      expect(
        functions[`app/api/internal/resolve/${code}/route.ts`]?.regions,
      ).toEqual([`${code}1`]);
    },
  );
});
