import { isbot } from 'isbot';

export const getVisitorIp = (headers: Headers) => {
  const forwardedFor = headers.get('x-forwarded-for');
  const ip = (forwardedFor ?? '127.0.0.1').split(',')[0];
  return ip;
};

export const isUserBot = (headers: Headers) => {
  const userAgent = headers.get('user-agent');
  const isBot = !userAgent || isbot(userAgent);
  return { isBot, userAgent };
};
