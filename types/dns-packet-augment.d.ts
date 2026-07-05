import 'dns-packet';

declare module 'dns-packet' {
  interface Packet {
    // dns-packet decodes the response code (e.g. 'NXDOMAIN') but @types/dns-packet omits it.
    rcode?: string;
  }
}
