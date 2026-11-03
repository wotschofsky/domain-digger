// IPv4 root hints from https://www.internic.net/domain/named.root
// Verified 2026-11-04 against root-zone version 2026110301. Keep this list
// current with dependency maintenance; DNS resolution must not need an HTTP
// fetch before it can contact a root server. The transport currently uses IPv4.
export const ROOT_SERVER_IPS = [
  '198.41.0.4',
  '170.247.170.2',
  '192.33.4.12',
  '199.7.91.13',
  '192.203.230.10',
  '192.5.5.241',
  '192.112.36.4',
  '198.97.190.53',
  '192.36.148.17',
  '192.58.128.30',
  '193.0.14.129',
  '199.7.83.42',
  '202.12.27.33',
] as const;
