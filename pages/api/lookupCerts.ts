import type { NextRequest } from 'next/server';
import isValidDomain from 'is-valid-domain';

export type CertLookupResponse = {
  certificates: {
    id: number;
    issuerName: string;
    commonName: string;
    matchingIdentities: string;
    loggedAt: string;
    notBefore: string;
    notAfter: string;
  }[];
};

export const config = {
  runtime: 'experimental-edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');

  if (!domain || !isValidDomain(domain || '')) {
    return new Response(
      JSON.stringify({
        error: true,
        message: '"domain" param missing or invalid',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const response = await fetch(
    'https://crt.sh?' +
      new URLSearchParams({
        Identity: domain,
        output: 'json',
      })
  );
  const data = (await response.json()) as {
    issuer_ca_id: number;
    issuer_name: string;
    common_name: string;
    name_value: string;
    id: number;
    entry_timestamp: string;
    not_before: string;
    not_after: string;
    serial_number: string;
  }[];

  return new Response(
    JSON.stringify({
      certificates: data.map((c) => ({
        id: c.id,
        loggedAt: c.entry_timestamp,
        notBefore: c.not_before,
        notAfter: c.not_after,
        commonName: c.common_name,
        matchingIdentities: c.name_value,
        issuerName: c.issuer_name,
      })),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
