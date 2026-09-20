import type { DnskeyData, DsData } from 'dns-packet';

// RFC 4034 Appendix B worked example: dskey.example.com.
export const RFC_KEY: DnskeyData = {
  flags: 256,
  algorithm: 5, // RSASHA1
  key: Buffer.from(
    'AQOeiiR0GOMYkDshWoSKz9XzfwJr1AYtsmx3TGkJaNXVbfi/2pHm822aJ5iI9BMz' +
      'NXxeYCmZDRD99WYwYqUSdjMmmAphXdvxegXd/M5+X7OrzKBaMbCVdFLUUh6DhweJ' +
      'BjEVv5f2wwjM9XzcnOf+EPbtG9DMBmADjFDc2w/rljwvFw==',
    'base64',
  ),
};
export const RFC_DS: DsData = {
  keyTag: 60485,
  algorithm: 5,
  digestType: 1, // SHA-1
  digest: Buffer.from('2BB183AF5F22588179A53B0A98631FAD1A292118', 'hex'),
};
