export const shortenIp = (ip: string) =>
  ip.length > 22 ? `${ip.slice(0, 12)}…${ip.slice(-6)}` : ip;
