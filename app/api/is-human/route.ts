import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';

// BotID's verdict for a visitor (app/providers.tsx). Firewall
// bypass rules and local dev skip BotID but still report a human, so they
// don't count.
export const POST = withEvlog(async () => {
  const log = useLogger();
  const { isHuman, bypassed } = await checkBotId();
  log.set({ isHuman, bypassed });

  return NextResponse.json({ isHuman: isHuman && !bypassed });
});
