import { handler } from '../base';

// Do not remove: Vercel only honours `preferredRegion` for functions on the edge
// runtime. Without it this route falls back to the project's default region and
// silently stops resolving DNS from the location its path name promises.
// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion
export const runtime = 'edge';
export const preferredRegion = 'icn1';

export const GET = handler;
