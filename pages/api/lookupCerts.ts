import type { NextApiRequest, NextApiResponse } from 'next';
import isValidDomain from 'is-valid-domain';
import fetch from 'node-fetch';

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

export type CertsLookupErrorResponse = { error: true; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CertLookupResponse | CertsLookupErrorResponse>
) {
  if (
    !req.query.domain ||
    typeof req.query.domain === 'object' ||
    !isValidDomain(req.query.domain)
  ) {
    res.status(400).json({
      error: true,
      message: 'Bad Request',
    });
    return;
  }

  const response = await fetch(
    'https://crt.sh?' +
      new URLSearchParams({
        Identity: req.query.domain,
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

  res.json({
    certificates: data.map((c) => ({
      id: c.id,
      loggedAt: c.entry_timestamp,
      notBefore: c.not_before,
      notAfter: c.not_after,
      commonName: c.common_name,
      matchingIdentities: c.name_value,
      issuerName: c.issuer_name,
    })),
  });
}
