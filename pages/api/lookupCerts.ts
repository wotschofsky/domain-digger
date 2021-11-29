import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import isFQDN from 'validator/lib/isFQDN';

export type CertLookupResponse = {
  certificates: {
    id: string;
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
    !isFQDN(req.query.domain)
  ) {
    res.status(400).json({
      error: true,
      message: 'Bad Request',
    });
    return;
  }

  const response = await axios('https://crt.sh', {
    params: {
      Identity: req.query.domain,
      output: 'json',
    },
  });

  res.json({
    certificates: response.data.map((c: Record<string, string | number>) => ({
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
