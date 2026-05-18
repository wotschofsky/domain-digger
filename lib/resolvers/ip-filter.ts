import net from 'node:net';

const isPublicIpv4 = (ip: string): boolean => {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b, c] = octets;

  // 0.0.0.0/8 - "this network"
  if (a === 0) return false;
  // 10.0.0.0/8 - private
  if (a === 10) return false;
  // 100.64.0.0/10 - shared address space (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return false;
  // 127.0.0.0/8 - loopback
  if (a === 127) return false;
  // 169.254.0.0/16 - link-local
  if (a === 169 && b === 254) return false;
  // 172.16.0.0/12 - private
  if (a === 172 && b >= 16 && b <= 31) return false;
  // 192.0.0.0/24 - IETF protocol assignments
  if (a === 192 && b === 0 && c === 0) return false;
  // 192.0.2.0/24 - TEST-NET-1 (documentation)
  if (a === 192 && b === 0 && c === 2) return false;
  // 192.168.0.0/16 - private
  if (a === 192 && b === 168) return false;
  // 198.18.0.0/15 - benchmarking
  if (a === 198 && (b === 18 || b === 19)) return false;
  // 198.51.100.0/24 - TEST-NET-2 (documentation)
  if (a === 198 && b === 51 && c === 100) return false;
  // 203.0.113.0/24 - TEST-NET-3 (documentation)
  if (a === 203 && b === 0 && c === 113) return false;
  // 224.0.0.0/4 - multicast
  if (a >= 224 && a <= 239) return false;
  // 240.0.0.0/4 - reserved (including 255.255.255.255 broadcast)
  if (a >= 240) return false;

  return true;
};

const expandIpv6 = (ip: string): number[] | null => {
  if (!net.isIPv6(ip)) return null;

  let normalized = ip.toLowerCase();

  // Strip zone identifier (e.g. fe80::1%eth0)
  const zoneIdx = normalized.indexOf('%');
  if (zoneIdx !== -1) {
    normalized = normalized.slice(0, zoneIdx);
  }

  // Handle embedded IPv4 (e.g. ::ffff:192.0.2.1)
  const lastColon = normalized.lastIndexOf(':');
  const tail = normalized.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (!net.isIPv4(tail)) return null;
    const octets = tail.split('.').map(Number);
    const seg1 = ((octets[0] << 8) | octets[1]).toString(16);
    const seg2 = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = normalized.slice(0, lastColon + 1) + seg1 + ':' + seg2;
  }

  let segments: string[];
  if (normalized.includes('::')) {
    const [head, rest] = normalized.split('::');
    const headSegs = head ? head.split(':') : [];
    const tailSegs = rest ? rest.split(':') : [];
    const missing = 8 - headSegs.length - tailSegs.length;
    if (missing < 0) return null;
    segments = [...headSegs, ...Array(missing).fill('0'), ...tailSegs];
  } else {
    segments = normalized.split(':');
  }

  if (segments.length !== 8) return null;
  const numeric = segments.map((s) => parseInt(s, 16));
  if (numeric.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) {
    return null;
  }
  return numeric;
};

const isPublicIpv6 = (ip: string): boolean => {
  const parts = expandIpv6(ip);
  if (!parts) return false;

  // ::/128 - unspecified
  if (parts.every((p) => p === 0)) return false;
  // ::1/128 - loopback
  if (parts.slice(0, 7).every((p) => p === 0) && parts[7] === 1) return false;
  // ::ffff:0:0/96 - IPv4-mapped IPv6 -- defer to IPv4 policy
  if (parts.slice(0, 5).every((p) => p === 0) && parts[5] === 0xffff) {
    const embedded = `${(parts[6] >> 8) & 0xff}.${parts[6] & 0xff}.${
      (parts[7] >> 8) & 0xff
    }.${parts[7] & 0xff}`;
    return isPublicIpv4(embedded);
  }
  // 64:ff9b::/96 - well-known NAT64 prefix
  if (
    parts[0] === 0x0064 &&
    parts[1] === 0xff9b &&
    parts[2] === 0 &&
    parts[3] === 0 &&
    parts[4] === 0 &&
    parts[5] === 0
  ) {
    return false;
  }
  // 100::/64 - discard prefix
  if (
    parts[0] === 0x0100 &&
    parts[1] === 0 &&
    parts[2] === 0 &&
    parts[3] === 0
  ) {
    return false;
  }
  // 2001:db8::/32 - documentation
  if (parts[0] === 0x2001 && parts[1] === 0x0db8) return false;
  // fc00::/7 - unique-local
  if ((parts[0] & 0xfe00) === 0xfc00) return false;
  // fe80::/10 - link-local
  if ((parts[0] & 0xffc0) === 0xfe80) return false;
  // ff00::/8 - multicast
  if ((parts[0] & 0xff00) === 0xff00) return false;

  return true;
};

/**
 * Returns true only for IP addresses that are public/routable on the Internet.
 * Rejects loopback, RFC1918 private, link-local, multicast, documentation,
 * unspecified, and other reserved ranges in both IPv4 and IPv6.
 *
 * Used to prevent attacker-controlled DNS referrals from forcing the
 * authoritative resolver to send DNS traffic to internal hosts.
 */
export const isPublicIp = (ip: string): boolean => {
  const version = net.isIP(ip);
  if (version === 4) return isPublicIpv4(ip);
  if (version === 6) return isPublicIpv6(ip);
  return false;
};
