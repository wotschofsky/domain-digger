import { handler } from '../base';

// Pinned to sin1 in vercel.json. Without that entry this route runs in the
// project's default region and stops resolving from the location it promises.
export const GET = handler;
