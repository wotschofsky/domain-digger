import { handler } from '../base';

// Pinned to icn1 in vercel.json. Without that entry this route runs in the
// project's default region and stops resolving from the location it promises.
export const GET = handler;
