import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();

// IPv4 reserved / non-routable ranges
blocked.addSubnet('0.0.0.0', 8); // "this network"
blocked.addSubnet('10.0.0.0', 8); // private
blocked.addSubnet('100.64.0.0', 10); // carrier-grade NAT (RFC 6598)
blocked.addSubnet('127.0.0.0', 8); // loopback
blocked.addSubnet('169.254.0.0', 16); // link-local
blocked.addSubnet('172.16.0.0', 12); // private
blocked.addSubnet('192.0.0.0', 24); // IETF protocol assignments
blocked.addSubnet('192.0.2.0', 24); // TEST-NET-1 (documentation)
blocked.addSubnet('192.168.0.0', 16); // private
blocked.addSubnet('198.18.0.0', 15); // benchmarking
blocked.addSubnet('198.51.100.0', 24); // TEST-NET-2 (documentation)
blocked.addSubnet('203.0.113.0', 24); // TEST-NET-3 (documentation)
blocked.addSubnet('224.0.0.0', 4); // multicast
blocked.addSubnet('240.0.0.0', 4); // reserved (incl. 255.255.255.255 broadcast)

// IPv6 reserved / non-routable ranges
blocked.addAddress('::', 'ipv6'); // unspecified
blocked.addAddress('::1', 'ipv6'); // loopback
blocked.addSubnet('64:ff9b::', 96, 'ipv6'); // well-known NAT64
blocked.addSubnet('100::', 64, 'ipv6'); // discard prefix
blocked.addSubnet('2001:db8::', 32, 'ipv6'); // documentation
blocked.addSubnet('fc00::', 7, 'ipv6'); // unique-local
blocked.addSubnet('fe80::', 10, 'ipv6'); // link-local
blocked.addSubnet('ff00::', 8, 'ipv6'); // multicast

/**
 * Returns true only for IP addresses that are public/routable on the Internet.
 * Rejects loopback, RFC1918 private, link-local, multicast, documentation,
 * unspecified, and other reserved ranges in both IPv4 and IPv6.
 *
 * Used to prevent attacker-controlled DNS referrals from forcing the
 * authoritative resolver to send DNS traffic to internal hosts.
 */
export const isPublicIp = (ip: string): boolean => {
  const version = isIP(ip);
  if (!version) return false;
  if (version === 4) return !blocked.check(ip, 'ipv4');
  // For IPv6, also apply IPv4 policy to catch IPv4-mapped addresses like
  // ::ffff:10.0.0.1; BlockList.check coerces them to their IPv4 form.
  return !blocked.check(ip, 'ipv6') && !blocked.check(ip, 'ipv4');
};
