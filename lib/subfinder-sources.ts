// Display label + canonical user-facing URL for each of subfinder's source IDs
// (as listed by `subfinder -ls`). Falls back to the raw code with no URL when
// a new source ships upstream before this map is updated.
type Source = { label: string; url?: string };

const SOURCES: Record<string, Source> = {
  alienvault: { label: 'AlienVault', url: 'https://otx.alienvault.com/' },
  anubis: { label: 'Anubis', url: 'https://jonlu.ca/anubis/' },
  bevigil: { label: 'BeVigil', url: 'https://bevigil.com/' },
  bufferover: { label: 'BufferOver', url: 'https://tls.bufferover.run/' },
  builtwith: { label: 'BuiltWith', url: 'https://builtwith.com/' },
  c99: { label: 'C99', url: 'https://api.c99.nl/' },
  censys: { label: 'Censys', url: 'https://search.censys.io/' },
  certspotter: {
    label: 'CertSpotter',
    url: 'https://sslmate.com/certspotter/',
  },
  chaos: { label: 'Chaos', url: 'https://chaos.projectdiscovery.io/' },
  chinaz: { label: 'Chinaz', url: 'https://my.chinaz.com/' },
  commoncrawl: { label: 'Common Crawl', url: 'https://commoncrawl.org/' },
  crtsh: { label: 'crt.sh', url: 'https://crt.sh/' },
  digitalyama: { label: 'DigitalYama', url: 'https://digitalyama.com/' },
  digitorus: { label: 'Digitorus', url: 'https://certificatedetails.com/' },
  dnsdb: { label: 'DNSDB', url: 'https://www.dnsdb.info/' },
  dnsdumpster: { label: 'DNSDumpster', url: 'https://dnsdumpster.com/' },
  dnsrepo: { label: 'DNSRepo', url: 'https://dnsrepo.noc.org/' },
  domainsproject: {
    label: 'Domains Project',
    url: 'https://domainsproject.org/',
  },
  driftnet: { label: 'Driftnet', url: 'https://driftnet.io/' },
  fofa: { label: 'FOFA', url: 'https://fofa.info/' },
  fullhunt: { label: 'FullHunt', url: 'https://fullhunt.io/' },
  github: { label: 'GitHub', url: 'https://github.com/' },
  hackertarget: { label: 'HackerTarget', url: 'https://hackertarget.com/' },
  hudsonrock: { label: 'Hudson Rock', url: 'https://www.hudsonrock.com/' },
  intelx: { label: 'IntelX', url: 'https://intelx.io/' },
  leakix: { label: 'LeakIX', url: 'https://leakix.net/' },
  merklemap: { label: 'MerkleMap', url: 'https://www.merklemap.com/' },
  netlas: { label: 'Netlas', url: 'https://netlas.io/' },
  onyphe: { label: 'ONYPHE', url: 'https://www.onyphe.io/' },
  profundis: { label: 'ProFundis', url: 'https://profundis.io/' },
  pugrecon: { label: 'PugRecon', url: 'https://pugrecon.com/' },
  quake: { label: 'Quake', url: 'https://quake.360.net/' },
  rapiddns: { label: 'RapidDNS', url: 'https://rapiddns.io/' },
  reconeer: { label: 'Reconeer', url: 'https://www.reconeer.com/' },
  redhuntlabs: { label: 'RedHunt Labs', url: 'https://redhuntlabs.com/' },
  robtex: { label: 'Robtex', url: 'https://www.robtex.com/' },
  rsecloud: { label: 'RSE Cloud', url: 'https://rsecloud.com/' },
  securitytrails: {
    label: 'SecurityTrails',
    url: 'https://securitytrails.com/',
  },
  shodan: { label: 'Shodan', url: 'https://www.shodan.io/' },
  sitedossier: { label: 'SiteDossier', url: 'http://www.sitedossier.com/' },
  submd: { label: 'Subdomain Center', url: 'https://www.subdomain.center/' },
  thc: { label: 'THC', url: 'https://ip.thc.org/' },
  threatbook: { label: 'ThreatBook', url: 'https://threatbook.io/' },
  threatcrowd: { label: 'ThreatCrowd', url: 'https://threatcrowd.org/' },
  urlscan: { label: 'urlscan.io', url: 'https://urlscan.io/' },
  virustotal: { label: 'VirusTotal', url: 'https://www.virustotal.com/' },
  waybackarchive: {
    label: 'Wayback Machine',
    url: 'https://web.archive.org/',
  },
  whoisxmlapi: { label: 'WHOIS XML API', url: 'https://www.whoisxmlapi.com/' },
  windvane: { label: 'Windvane', url: 'https://windvane.lichoin.com/' },
  zoomeyeapi: { label: 'ZoomEye', url: 'https://www.zoomeye.org/' },
};

export const getSource = (code: string): Source =>
  SOURCES[code] ?? { label: code };

export const getSourceLabel = (code: string) => getSource(code).label;
