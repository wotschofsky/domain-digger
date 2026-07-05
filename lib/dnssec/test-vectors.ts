import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

// Golden vectors: real DNSKEY RRsets + their DNSKEY RRSIGs, captured with
// `dig +dnssec DNSKEY`. `now` is pinned inside each signature's validity window
// so these never flake. They verify the canonical encoding against independent,
// real-world signers (RSASHA256, ECDSAP256).

const dnskey = (
  flags: number,
  algorithm: number,
  keyB64: string,
): DnskeyData => ({
  flags,
  algorithm,
  key: Buffer.from(keyB64, 'base64'),
});

// Root zone (RSASHA256), signed by the IANA KSK, key tag 20326.
export const ROOT_DNSKEYS: DnskeyData[] = [
  dnskey(
    256,
    8,
    'AwEAAeCYD6Z7WWKVLeuWgowKP+3g+Gs1cnLKq7a3CaQxQpv8bfuFVI0WnG33qaSH/Mw9IBgifrdzf4XY/DQLnyBJ9MfaOyAWuEaEmYJ+GQPiwVVfstGwSA1McfFJUttTgq2Huu74KARhtA8wPo/N3XcyYQtNhz+qCM5NBb3ecx/naw6sYab9LxS6f2cU0q03++BP5Ks0Uef8WJCa/1izCYE+vMkwoltV+tENa3hpXiZ7jle/xdgaZrPi5ZGmyLVI34g1XVYrNlsCCTmNvFQIfzW5STFQFsQpizczyFn9r3LzSxxPCNwdlCG84bER0BmdwqbF6Tanv+FxMOavrahkj4wIy5k=',
  ),
  dnskey(
    257,
    8,
    'AwEAAaz/tAm8yTn4Mfeh5eyI96WSVexTBAvkMgJzkKTOiW1vkIbzxeF3+/4RgWOq7HrxRixHlFlExOLAJr5emLvN7SWXgnLh4+B5xQlNVz8Og8kvArMtNROxVQuCaSnIDdD5LKyWbRd2n9WGe2R8PzgCmr3EgVLrjyBxWezF0jLHwVN8efS3rCj/EWgvIWgb9tarpVUDK/b58Da+sqqls3eNbuv7pr+eoZG+SrDK6nWeL3c6H5Apxz7LjVc1uTIdsIXxuOLYA4/ilBmSVIzuDWfdRUfhHdY6+cn8HFRm+2hM8AnXGXws9555KrUB5qihylGa8subX2Nn6UwNR1AkUTV74bU=',
  ),
  dnskey(
    256,
    8,
    'AwEAAb5dDYffpgAJ8VUGLwQtWXPlQWsjIFJtCM00/XaKU+8ln+ofah3q2KxEIjvzQg+nqdxRj+8emtPne1mtYcbFWP4Q9E+DniOJLK09R05FuzvGbrG7DDdRDUX/cedFdV7O8pFEAYpJqYNR9BCTIAV973DO2biauKSA31b7I2lK/woxoR1tf5cqJ4SMbJUviuHicAEoUi2ATswloZNWd5T5thmEFZnxFx7D5UgKCY7oflS7+GU7dNJwEtmFnWYVETHN0kHXVz6aguouaAZp706YXNIoR/iTgQhmsR7XX+wL0Z8QM2LxQIyU6vRZ06IyuJMGRMiwkSuGElbumyBt12JZbrU=',
  ),
  dnskey(
    257,
    8,
    'AwEAAa96jeuknZlaeSrvyAJj6ZHv28hhOKkx3rLGXVaC6rXTsDc449/cidltpkyGwCJNnOAlFNKF2jBosZBU5eeHspaQWOmOElZsjICMQMC3aeHbGiShvZsx4wMYSjH8e7Vrhbu6irwCzVBApESjbUdpWWmEnhathWu1jo+siFUiRAAxm9qyJNg/wOZqqzL/dL/q8PkcRU5oUKEpUge71M3ej2/7CPqpdVwuMoTvoB+ZOT4YeGyxMvHmbrxlFzGOHOijtzN+u1TQNatX2XBuzZNQ1K+s2CXkPIZo7s6JgZyvaBevYtxPvYLw4z9mR7K2vaF18UYH9Z9GNUUeayffKC73PYc=',
  ),
];
export const ROOT_DNSKEY_RRSIG: RrsigData = {
  typeCovered: 'DNSKEY',
  algorithm: 8,
  labels: 0,
  originalTTL: 172800,
  expiration: 1784678400, // 2026-07-22 00:00:00 UTC
  inception: 1782864000, // 2026-07-01 00:00:00 UTC
  keyTag: 20326,
  signersName: '.',
  signature: Buffer.from(
    'PIWRr97cYGmtOj+ITFeA8BqCHizd3FW/RykfcnMqVXQ7OqcE3lACjOoYfj+aj1iZfAP59iNsOWJz/J7AUAqxb7CpPIO9bJxllbhHyRkKEJhCO4M/MvlYAMmc6G8gnI4yBZEIiRPaFOP0Ux04kX/CMk4KoM89Rv4sQy02hsF7HeQb7GAowyKSW3hy0TazdwGeRyC00SjDCVZMVNCc8gPF4ZZsWgSmkpDDj3H1V5JSzLiu/mtf0k/6oHTi0IrsaBKywdQO9JgAOvayfW0hhySQ2FoQSrZC5Hb1btjvkzj49LxGTy0qvoRdHLjmnrsk8BqNlekAhJoLtIB+HEla/s1/DQ==',
    'base64',
  ),
};
export const ROOT_NOW = 1782950400; // within the window

// wsky.dev (ECDSAP256SHA256), signed by its KSK, key tag 2371.
export const WSKY_DNSKEYS: DnskeyData[] = [
  dnskey(
    257,
    13,
    'mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ==',
  ),
  dnskey(
    256,
    13,
    'oJMRESz5E4gYzS/q6XDrvU1qMPYIjCWzJaOau8XNEZeqCYKD5ar0IRd8KqXXFJkqmVfRvMGPmM1x8fGAa2XhSA==',
  ),
];
export const WSKY_DNSKEY_RRSIG: RrsigData = {
  typeCovered: 'DNSKEY',
  algorithm: 13,
  labels: 2,
  originalTTL: 3600,
  expiration: 1787564388,
  inception: 1782293988,
  keyTag: 2371,
  signersName: 'wsky.dev',
  signature: Buffer.from(
    'bWnpt80RbJPgeMeaIM+Q+XMuXAgewTsW04P9ltGSdyZEtexlICuObJiACCFjcH4lhVZjza37kRluO+CvtZtruw==',
    'base64',
  ),
};
export const WSKY_NOW = 1782380388; // within the window

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
