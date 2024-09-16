import type { RecordType } from './resolvers/base';

export const REGIONS: Record<
  string,
  { name: string; lat: number; lng: number }
> = {
  arn: { lat: 59.652222, lng: 17.918611, name: '🇸🇪 Stockholm, Sweden' },
  bom: { lat: 19.088744, lng: 72.867905, name: '🇮🇳 Mumbai, India' },
  cdg: { lat: 49.009691, lng: 2.547925, name: '🇫🇷 Paris, France' },
  cle: { lat: 41.405772, lng: -81.849769, name: '🇺🇸 Cleveland, USA' },
  cpt: { lat: -33.964806, lng: 18.601667, name: '🇿🇦 Cape Town, South Africa' },
  dub: { lat: 53.421333, lng: -6.270075, name: '🇮🇪 Dublin, Ireland' },
  fra: { lat: 50.033333, lng: 8.570556, name: '🇩🇪 Frankfurt, Germany' },
  gru: { lat: -23.435556, lng: -46.473056, name: '🇧🇷 São Paulo, Brazil' },
  hkg: { lat: 22.308046, lng: 113.91848, name: '🇭🇰 Hong Kong' },
  hnd: { lat: 35.553333, lng: 139.781111, name: '🇯🇵 Tokyo, Japan' },
  iad: { lat: 38.944, lng: -77.456, name: '🇺🇸 Washington, USA' },
  icn: { lat: 37.4625, lng: 126.439167, name: '🇰🇷 Seoul, South Korea' },
  kix: { lat: 34.434167, lng: 135.232778, name: '🇯🇵 Osaka, Japan' },
  lhr: { lat: 51.477, lng: -0.461, name: '🇬🇧 London, UK' },
  pdx: { lat: 45.5875, lng: -122.593333, name: '🇺🇸 Portland, USA' },
  sfo: { lat: 37.618056, lng: -122.378611, name: '🇺🇸 San Francisco, USA' },
  sin: { lat: 1.356944, lng: 103.988611, name: '🇸🇬 Singapore' },
  syd: { lat: -33.946111, lng: 151.177222, name: '🇦🇺 Sydney, Australia' },
};

export const EXAMPLE_DOMAINS = [
  'digger.tools',
  'google.com',
  'wikipedia.org',
  'microsoft.com',
  'tiktok.com',
  'reddit.com',
  'baidu.com',
  'x.com',
  'discord.com',
];

export const ALL_RECORD_TYPES = [
  'A',
  'AAAA',
  'CAA',
  'CNAME',
  'DNSKEY',
  'DS',
  'MX',
  'NAPTR',
  'NS',
  'PTR',
  'RRSIG',
  'SOA',
  'SRV',
  'TXT',
] as const;

export const RECORD_TYPES_BY_DECIMAL = {
  1: 'A',
  28: 'AAAA',
  257: 'CAA',
  5: 'CNAME',
  48: 'DNSKEY',
  43: 'DS',
  15: 'MX',
  35: 'NAPTR',
  2: 'NS',
  12: 'PTR',
  46: 'RRSIG',
  6: 'SOA',
  33: 'SRV',
  16: 'TXT',
} as const;

type RecordInsights = {
  [key in RecordType]: Array<{
    test: RegExp;
    description: string;
    url: string;
  }>;
};

export const RECORD_INSIGHTS: RecordInsights = {
  A: [
    {
      // 35.71.142.77 or 52.223.52.2
      test: /^(?:35\.71\.142\.77|52\.223\.52\.2)$/,
      description: 'Framer',
      url: 'https://www.framer.com',
    },
    {
      // 75.2.70.75 or 99.83.190.102
      test: /^(?:75\.2\.70\.75|99\.83\.190\.102)$/,
      description: 'Webflow',
      url: 'https://www.webflow.com',
    },
  ],
  AAAA: [],
  CAA: [
    {
      test: /"(amazon|amazontrust|awstrust|amazonaws)\.com("|;)/,
      description: 'AWS Certificate Manager',
      url: 'https://aws.amazon.com/certificate-manager/',
    },
    {
      test: /"digicert\.com("|;)/,
      description: 'DigiCert',
      url: 'https://www.digicert.com',
    },
    {
      test: /"certainly\.com("|;)/,
      description: 'Fastly Certainly',
      url: 'https://docs.fastly.com/products/certainly',
    },
    {
      test: /"globalsign\.com("|;)/,
      description: 'GlobalSign',
      url: 'https://shop.globalsign.com/en/ssl',
    },
    {
      test: /"pki\.goog("|;)/,
      description: 'Google Trust Services',
      url: 'https://pki.goog',
    },
    {
      test: /"letsencrypt\.org("|;)/,
      description: 'Let’s Encrypt',
      url: 'https://letsencrypt.org',
    },
    {
      test: /"(sectigo|trust-provider|usertrust|comodoca)\.com("|;)/,
      description: 'Sectigo',
      url: 'https://sectigo.com',
    },
  ],
  CNAME: [
    {
      test: /\.(akadns|akamai|akamaiedge|edgekey|edgesuite)\.net$/,
      description: 'Akamai',
      url: 'https://www.akamai.com',
    },
    {
      test: /\.cloudfront\.net$/,
      description: 'Amazon CloudFront',
      url: 'https://aws.amazon.com/cloudfront/',
    },
    {
      test: /\.elb\.[a-z]+-[a-z]+-\d+\.amazonaws\.com$/,
      description: 'AWS Elastic Load Balancing',
      url: 'https://aws.amazon.com/elasticloadbalancing/',
    },
    {
      test: /\.cdn\.cloudflare\.net$/,
      description: 'Cloudflare',
      url: 'https://www.cloudflare.com',
    },
    {
      test: /\.map\.fastly.net$/,
      description: 'Fastly',
      url: 'https://www.fastly.com',
    },
    {
      test: /^sites\.framer\.app$/,
      description: 'Framer',
      url: 'https://www.framer.com',
    },
    {
      test: /\.github\.io$/,
      description: 'GitHub Pages',
      url: 'https://pages.github.com',
    },
    {
      test: /^ghs\.googlehosted\.com$/,
      description: 'Google Cloud',
      url: 'https://cloud.google.com',
    },
    {
      test: /\.netlify\.app$/,
      description: 'Netlify',
      url: 'https://www.netlify.com',
    },
    {
      test: /^proxy-ssl\.webflow\.com$/,
      description: 'Webflow',
      url: 'https://www.webflow.com',
    },
  ],
  DNSKEY: [],
  DS: [],
  MX: [
    {
      test: /\.mxrecord\.(mx|io)$/,
      description: 'Cloudflare Area 1',
      url: 'https://developers.cloudflare.com/email-security/',
    },
    {
      test: /in\d\-smtp.messagingengine\.com$/,
      description: 'Fastmail',
      url: 'https://www.fastmail.com',
    },
    {
      test: /(aspmx\.l\.google|aspmx\d\.googlemail)\.com$/,
      description: 'Google Workspace',
      url: 'https://workspace.google.com',
    },
    {
      test: /work-mx\.app\.hey\.com$/,
      description: 'HEY',
      url: 'https://www.hey.com',
    },
    {
      test: /mail\.protection\.outlook\.com$/,
      description: 'Microsoft 365',
      url: 'https://www.microsoft.com/microsoft-365',
    },
    {
      test: /eforward\d\.registrar-servers\.com$/,
      description: 'Namecheap Forwarding',
      url: 'https://www.namecheap.com',
    },
    {
      test: /\.privateemail\.com$/,
      description: 'Namecheap Private Email',
      url: 'https://privateemail.com',
    },
    {
      test: /\.pphosted\.com$/,
      description: 'Proofpoint',
      url: 'https://www.proofpoint.com',
    },
  ],
  NAPTR: [],
  NS: [
    {
      test: /^ns-\d{1,4}\.awsdns-\d{1,2}\.(com|net|org|co\.uk)$/,
      description: 'Amazon Route 53',
      url: 'https://aws.amazon.com/route53/',
    },
    {
      test: /^(coco|kiki)\.bunny\.net$/,
      description: 'Bunny DNS',
      url: 'https://bunny.net/dns/',
    },
    {
      test: /^[a-z]+\.ns\.cloudflare\.com$/,
      description: 'Cloudflare',
      url: 'https://www.cloudflare.com',
    },
    {
      test: /^ns\d\.messagingengine\.com$/,
      description: 'Fastmail',
      url: 'https://www.fastmail.com/',
    },
    {
      test: /^ns\d{2}\.domaincontrol\.com$/,
      description: 'GoDaddy',
      url: 'https://www.godaddy.com',
    },
    {
      test: /\.googledomains\.com$/,
      description: 'Google Cloud DNS',
      url: 'https://cloud.google.com/dns',
    },
    {
      test: /^ns\d-\d{1,2}\.azure-dns\.(com|info|net|org)$/,
      description: 'Microsoft Azure DNS',
      url: 'https://azure.microsoft.com/services/dns/',
    },
    {
      test: /^dns\d\.registrar-servers\.com$/,
      description: 'Namecheap',
      url: 'https://www.namecheap.com',
    },
    {
      test: /^freedns\d\.registrar-servers\.com$/,
      description: 'Namecheap FreeDNS',
      url: 'https://www.namecheap.com/domains/freedns/',
    },
    {
      test: /^pdns\d\.registrar-servers\.com$/,
      description: 'Namecheap PremiumDNS',
      url: 'https://www.namecheap.com/security/premiumdns/',
    },
    {
      test: /^dns\d\.p\d{2}\.nsone\.net$/,
      description: 'NS1',
      url: 'https://ns1.com',
    },
    {
      test: /\.ultradns\.(biz|com|net|org)$/,
      description: 'Vercara UltraDNS',
      url: 'https://vercara.com/authoritative-dns',
    },
    {
      test: /^.+\.vercel-dns\.com$/,
      description: 'Vercel',
      url: 'https://vercel.com',
    },
  ],
  PTR: [],
  RRSIG: [],
  SOA: [],
  SRV: [],
  TXT: [
    {
      test: /include:amazonses\.com/,
      description: 'Amazon SES',
      url: 'https://aws.amazon.com/ses/',
    },
    {
      test: /include:_spf\.google\.com/,
      description: 'Google Workspace',
      url: 'https://workspace.google.com',
    },
    {
      test: /include:\d+\.spf\d{1,2}\.hubspotemail\.net/,
      description: 'HubSpot',
      url: 'https://www.hubspot.com',
    },
    {
      test: /include:servers\.mcsv\.net/,
      description: 'Mailchimp',
      url: 'https://mailchimp.com',
    },
    {
      test: /include:mailgun\.org/,
      description: 'Mailgun',
      url: 'https://www.mailgun.com',
    },
    {
      test: /include:spf\.protection\.outlook\.com/,
      description: 'Microsoft 365',
      url: 'https://www.microsoft.com/microsoft-365',
    },
    {
      test: /include:spf-([a-z]|[0-9])+\.pphosted\.com/,
      description: 'Proofpoint',
      url: 'https://www.proofpoint.com',
    },
    {
      test: /include:_spf\.salesforce\.com/,
      description: 'Salesforce',
      url: 'https://www.salesforce.com',
    },
    {
      test: /include:sendgrid\.net/,
      description: 'Twilio SendGrid',
      url: 'https://sendgrid.com',
    },
    {
      test: /include:mail\.zendesk\.com/,
      description: 'Zendesk',
      url: 'https://www.zendesk.com',
    },
  ],
};
