import type { NextApiRequest, NextApiResponse } from 'next';
import isValidDomain from 'is-valid-domain';
// @ts-ignore
import whois from 'whois';

export type WhoisLookupResponse = {
  data: string;
};

export type WhoisLookupErrorResponse = { error: true; message: string };

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<WhoisLookupResponse | WhoisLookupErrorResponse>
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

  whois.lookup(req.query.domain, function (err: any, data: string) {
    if (err) {
      console.error(err);
      res.status(500).json({
        error: true,
        message: 'Internal Server Error',
      });
      return;
    }

    res.json({
      data,
    });
  });
}
