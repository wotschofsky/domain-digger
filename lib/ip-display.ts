export const shortenIp = (ip: string) =>
  ip.length > 22 ? `${ip.slice(0, 12)}…${ip.slice(-6)}` : ip;

export const anonymizeIp = (ip: string) =>
  ip.includes(':')
    ? `${ip.split(':')[0]}:xxxx:xxxx:xxxx:…`
    : `${ip.split('.')[0]}.xxx.xxx.xxx`;
